import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PRIMARY_URL = "https://loteriarn.patagonialive.media";
const DEFAULT_SECONDARY_URL = "https://backup.patagonialive.media";

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

export async function fetchWithFailover(endpoint: string, options: RequestInit = {}, timeoutMs: number = 6000): Promise<Response> {
  const { primary, secondary } = await getStoredUrls();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Intento 1: Servidor Primario
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${primary}${cleanEndpoint}`, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      return response;
    }
    if (response.status === 401 || response.status === 403) return response;
  } catch (primaryErr) {
    console.warn(`[Failover] Falló servidor primario (${primary}${cleanEndpoint}). Intentando secundario...`);
  }

  // Intento 2: Servidor Secundario (Fallback)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${secondary}${cleanEndpoint}`, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      console.log(`[Failover] Respondió con éxito el servidor secundario (${secondary}${cleanEndpoint}).`);
      return response;
    }
    if (response.status === 401 || response.status === 403) return response;
  } catch (secondaryErr) {
    console.error(`[Failover] Ambos servidores (Primario y Secundario) no responden.`);
  }

  // Si ambos fallaron, lanzamos error estructurado
  throw new Error("ERROR_SERVIDORES_INACCESIBLES: Ni el servidor primario ni el secundario respondieron.");
}
