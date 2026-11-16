import AsyncStorage from '@react-native-async-storage/async-storage';
import { allowsSecondaryFailover, type ServerSource } from '../utils/failoverPolicy';

const DEFAULT_PRIMARY_URL = "https://loteriarn.patagonialive.media";
const DEFAULT_SECONDARY_URL = "https://loteriarn-bk.patagonialive.media";

const KEY_PRIMARY_URL = "PRIMARY_API_URL";
const KEY_SECONDARY_URL = "SECONDARY_API_URL";

export async function getStoredUrls(): Promise<{ primary: string; secondary: string }> {
  try {
    const primary = (await AsyncStorage.getItem(KEY_PRIMARY_URL)) || DEFAULT_PRIMARY_URL;
    const secondary = (await AsyncStorage.getItem(KEY_SECONDARY_URL)) || DEFAULT_SECONDARY_URL;
    return { primary, secondary };
  } catch {
    return { primary: DEFAULT_PRIMARY_URL, secondary: DEFAULT_SECONDARY_URL };
  }
}

export async function getPrimaryApiUrl(endpoint: string = ''): Promise<string> {
  const { primary } = await getStoredUrls();
  const cleanEndpoint = endpoint && !endpoint.startsWith('/') ? `/${endpoint}` : endpoint;
  return `${primary}${cleanEndpoint}`;
}

export async function getApiUrl(source: ServerSource, endpoint: string = ''): Promise<string> {
  const urls = await getStoredUrls();
  const cleanEndpoint = endpoint && !endpoint.startsWith('/') ? `/${endpoint}` : endpoint;
  return `${urls[source]}${cleanEndpoint}`;
}

export async function saveServerUrls(newPrimary?: string, newSecondary?: string) {
  try {
    if (newPrimary && newPrimary.startsWith("http")) {
      await AsyncStorage.setItem(KEY_PRIMARY_URL, newPrimary.replace(/\/+$/, ""));
    }
    if (newSecondary && newSecondary.startsWith("http")) {
      await AsyncStorage.setItem(KEY_SECONDARY_URL, newSecondary.replace(/\/+$/, ""));
    }
  } catch (e) {
    console.error("[FailoverStorage] Error guardando URLs de servidor:", e);
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchReadWithFailover(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 6000
): Promise<{ response: Response; source: ServerSource }> {
  const { primary, secondary } = await getStoredUrls();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const method = options.method || 'GET';

  if (!allowsSecondaryFailover(method)) {
    throw new Error(`FAILOVER_WRITE_BLOCKED: ${method} sólo puede enviarse al servidor principal.`);
  }

  try {
    const response = await fetchWithTimeout(`${primary}${cleanEndpoint}`, options, timeoutMs);
    if (response.ok) return { response, source: 'primary' };
    if (response.status === 401 || response.status === 403) return { response, source: 'primary' };
  } catch {
    console.warn(`[Failover] Falló servidor primario (${primary}${cleanEndpoint}). Intentando secundario...`);
  }

  try {
    const response = await fetchWithTimeout(`${secondary}${cleanEndpoint}`, options, timeoutMs);
    if (response.ok) {
      console.log(`[Failover] Respondió con éxito el servidor secundario (${secondary}${cleanEndpoint}).`);
      return { response, source: 'secondary' };
    }
  } catch {
    console.error(`[Failover] Ambos servidores (Primario y Secundario) no responden.`);
  }

  throw new Error("ERROR_SERVIDORES_INACCESIBLES: Ni el servidor primario ni el secundario respondieron.");
}

export async function fetchWithFailover(endpoint: string, options: RequestInit = {}, timeoutMs: number = 6000): Promise<Response> {
  const method = options.method || 'GET';
  if (allowsSecondaryFailover(method)) {
    return (await fetchReadWithFailover(endpoint, options, timeoutMs)).response;
  }

  const { primary } = await getStoredUrls();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetchWithTimeout(`${primary}${cleanEndpoint}`, options, timeoutMs);
}
