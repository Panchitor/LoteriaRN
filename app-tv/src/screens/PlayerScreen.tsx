import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Animated, NativeModules, AppState } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Network from 'expo-network';
import { WebView } from 'react-native-webview';

import { MarqueeTicker } from '../components/MarqueeTicker';
import { localRecoveryAction } from '../utils/localPlaybackRecovery';
import { fetchReadWithFailover, fetchWithFailover, getApiUrl, getPrimaryApiUrl, saveServerUrls } from '../services/apiClient';
import { hasLiveProgress } from '../utils/liveProgress';
import { MAINTENANCE_NOTICE, type ServerSource } from '../utils/failoverPolicy';

const { SilentInstall } = NativeModules;
const VIDEO_DIR = FileSystem.documentDirectory + 'videos/';

interface LiveStatus {
  live: boolean;
  url: string;
}

interface TickerItem {
  text: string;
  speed: number;
  position: 'top' | 'bottom';
  bg_color: string;
  text_color: string;
}

interface ManifestVideo {
  filename: string;
  original_name: string;
  size_bytes?: number;
  hash_sha256?: string | null;
  media_type?: 'video' | 'image';
  display_duration?: number;
}

interface StandbyImage {
  url: string;
  filename: string;
  hash_sha256?: string | null;
}

function isVersionNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const lParts = parse(latest);
  const cParts = parse(current);
  
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

function getYouTubeEmbedUrl(url: string) {
  let videoId = '';
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('youtube.com/live/')) {
    videoId = url.split('live/')[1]?.split('?')[0];
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0];
  }
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0`;
}

export default function PlayerScreen({ token, onLogout }: { token: string, onLogout: () => void }) {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ live: false, url: '' });
  const [playlist, setPlaylist] = useState<ManifestVideo[]>([]);
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [emergency, setEmergency] = useState({
    active: false,
    title: 'EMERGENCIA',
    message: '',
    backgroundColor: '#7f1d1d',
    titleColor: '#ef4444',
    messageColor: '#ffffff',
  });
  const [localFiles, setLocalFiles] = useState<Record<string, string>>({});
  const [currentOfflineIndex, setCurrentOfflineIndex] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('');
  const [updateVersion, setUpdateVersion] = useState('');
  const [isDownloadingVideos, setIsDownloadingVideos] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(10000);
  const [networkState, setNetworkState] = useState<Network.NetworkState | null>(null);
  const [serverSource, setServerSource] = useState<ServerSource>('primary');
  const [standbyUri, setStandbyUri] = useState<string | null>(null);
  
  const [liveRetryKey, setLiveRetryKey] = useState(0);
  const [offlineRetryKey, setOfflineRetryKey] = useState(0);
  const [liveHasError, setLiveHasError] = useState(false);
  const [isLiveReady, setIsLiveReady] = useState(false);
  
  const lastAttemptedUpdateRef = useRef<string | null>(null);
  const missedLiveCountRef = useRef<number>(0);
  const remoteCommandBusyRef = useRef(false);
  const updateInProgressRef = useRef(false);
  const updateProgressRef = useRef(0);
  const manifestPlaylistRef = useRef<ManifestVideo[]>([]);
  const manifestLoadedRef = useRef(false);
  const currentFilenameRef = useRef<string | null>(null);
  const standbyHashRef = useRef<string | null>(null);
  const standbyLoadLoggedRef = useRef(false);
  const deviceInfoRef = useRef<{ androidVersion?: string; deviceModel?: string; deviceSerial?: string }>({});

  const loopVideoRef = useRef<Video>(null);
  const liveVideoRef = useRef<Video>(null);
  
  // Watchdog refs
  const lastPositionRef = useRef<number>(0);
  const lastPositionTimeRef = useRef<number>(Date.now());
  const localRecoveryStageRef = useRef<number>(0);
  
  const liveLastPositionRef = useRef<number>(0);
  const liveLastPositionTimeRef = useRef<number>(Date.now());
  const liveStatusRef = useRef<LiveStatus>(liveStatus);
  const emergencyRef = useRef(emergency);
  
  const currentAppVersion = Constants.expoConfig?.version || '1.0.0';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liveFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    liveStatusRef.current = liveStatus;
  }, [liveStatus]);

  useEffect(() => {
    emergencyRef.current = emergency;
  }, [emergency]);

  useEffect(() => {
    if (!SilentInstall?.getDeviceInfo) return;
    SilentInstall.getDeviceInfo()
      .then((info: any) => { deviceInfoRef.current = info || {}; })
      .catch((error: any) => sendRemoteLog('warn', `No se pudo leer identidad de hardware: ${error?.message}`));
  }, []);

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const fadeOutAndNext = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      callback();
    });
  };

  const liveFadeIn = () => {
    setIsLiveReady(true);
    Animated.timing(liveFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const liveFadeOut = (callback?: () => void) => {
    Animated.timing(liveFadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setIsLiveReady(false);
      if (callback) callback();
    });
  };
  const sendRemoteLog = async (level: 'info' | 'warn' | 'error', message: string) => {
    try {
      await fetchWithFailover('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, logs: [{ level, message }] }),
      });
    } catch (_) {}
  };

  const sendPlaybackStat = async (filename: string, event: 'start' | 'end', completed = false) => {
    try {
      await fetchWithFailover('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, filename, event, completed }),
      });
    } catch (_) {}
  };

  useEffect(() => {
    // Ensure video dir exists and index existing files
    const setupDir = async () => {
      const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
      } else {
        const cachedFiles = await FileSystem.readDirectoryAsync(VIDEO_DIR);
        const existingMap: Record<string, string> = {};
        const fallbackPlaylist: ManifestVideo[] = [];
        for (const file of cachedFiles) {
          existingMap[file] = VIDEO_DIR + file;
          fallbackPlaylist.push({
            filename: file,
            original_name: file,
            media_type: file.endsWith('.mp4') ? 'video' : 'image',
            display_duration: 10
          });
        }
        setLocalFiles(existingMap);
        setPlaylist(current => current.length === 0 ? fallbackPlaylist : current);
      }
    };
    setupDir();
    sendRemoteLog('info', `TV iniciado v${currentAppVersion}`);
  }, []);

  const downloadAndInstallUpdate = async (apkUrl: string, newVersion: string, expectedSha256?: string | null) => {
    if (updateInProgressRef.current || lastAttemptedUpdateRef.current === newVersion) return;
    if (!expectedSha256 || !/^[0-9a-f]{64}$/i.test(expectedSha256)) {
      sendRemoteLog('error', `Actualización OTA v${newVersion} rechazada: falta SHA-256 válido`);
      return;
    }
    updateInProgressRef.current = true;
    lastAttemptedUpdateRef.current = newVersion;
    updateProgressRef.current = 0;
    
    try {
      setIsUpdating(true);
      setUpdateVersion(newVersion);
      setUpdateStatusText(`Se encontró una nueva actualización (v${newVersion}). Descargando paquete...`);
      sendRemoteLog('info', `Iniciando descarga OTA v${newVersion}`);
      
      let finalUrl = apkUrl;
      if (finalUrl.includes('localhost')) {
        const parsedUrl = new URL(finalUrl);
        finalUrl = await getPrimaryApiUrl(parsedUrl.pathname + parsedUrl.search);
      }
      
      const fileUri = FileSystem.documentDirectory + 'update.apk';
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      const downloadResumable = FileSystem.createDownloadResumable(
        finalUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const expected = Math.max(downloadProgress.totalBytesExpectedToWrite, 1);
          const progress = Math.min(100, Math.round((downloadProgress.totalBytesWritten / expected) * 100));
          updateProgressRef.current = Math.max(updateProgressRef.current, progress);
          const percentage = updateProgressRef.current;
          setUpdateStatusText(`Se encontró una nueva actualización (v${newVersion}). Descargando paquete: ${percentage}%`);
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult || downloadResult.status !== 200) throw new Error("Falló la descarga de la APK");
      const { uri } = downloadResult;
      const cleanPath = uri.replace('file://', '');
      if (!SilentInstall?.sha256File) throw new Error('El dispositivo no puede verificar SHA-256 de la actualización');
      const actualSha256 = await SilentInstall.sha256File(cleanPath);
      if (typeof actualSha256 !== 'string' || actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        throw new Error('La firma de integridad SHA-256 de la APK no coincide');
      }
      sendRemoteLog('info', `APK v${newVersion} verificada por SHA-256`);
      setUpdateStatusText(`Descarga completada (v${newVersion}). Aplicando actualización en segundo plano (su / pm)...`);

      try {
        if (SilentInstall && SilentInstall.installApk) {
          const res = await SilentInstall.installApk(cleanPath);
          sendRemoteLog('info', `Solicitud de instalación enviada (${res})`);
          setUpdateStatusText(`Descarga: 100%. Instalación solicitada a Android. Si aparece una autorización, confirmá Instalar.`);
          if (SilentInstall.getInstallStatus) {
            let confirmed = false;
            for (let attempt = 0; attempt < 60; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              const status = await SilentInstall.getInstallStatus();
              if (status.version === newVersion) {
                confirmed = true;
                setUpdateStatusText(`Instalación confirmada: v${newVersion}. Reiniciando aplicación...`);
                await SilentInstall.restartApp();
                break;
              }
              if (status.result?.startsWith('ERROR:')) throw new Error(status.result);
              setUpdateStatusText(`Descarga: 100%. ${status.result === 'WAITING_USER' ? 'Android espera que confirmes Instalar.' : 'Esperando confirmación de instalación.'} ${(attempt + 1) * 2}s / 120s`);
            }
            if (!confirmed) throw new Error('Android no confirmó la actualización en 120 segundos. Revise permisos de instalación o instale la APK manualmente.');
          }
        } else {
          throw new Error("Módulo de instalación silenciosa no registrado");
        }
      } catch (silentErr: any) {
        sendRemoteLog('error', `Instalación OTA detenida: ${silentErr?.message}`);
        setUpdateStatusText(`DETALLE ERROR (v${newVersion}): ${silentErr?.message || silentErr}`);
        setTimeout(() => {
          updateInProgressRef.current = false;
          setIsUpdating(false);
        }, 10000);
      }

      // Salvaguarda por si el instalador del firmware no reinicia el proceso.
      setTimeout(() => {
        updateInProgressRef.current = false;
        setIsUpdating(false);
      }, 120000);
      
    } catch (e: any) {
      sendRemoteLog('error', `Error en instalación OTA: ${e?.message}`);
      setUpdateStatusText(`Error al actualizar: ${e?.message || 'Error desconocido'}`);
      updateInProgressRef.current = false;
      setTimeout(() => {
        setIsUpdating(false);
      }, 5000);
    }
  };

  const removeCachedFileWhenReleased = (filename: string, delayMs = 1500) => {
    setTimeout(async () => {
      if (currentFilenameRef.current === filename) return;
      try {
        await FileSystem.deleteAsync(VIDEO_DIR + filename, { idempotent: true });
        setLocalFiles(current => {
          if (!current[filename]) return current;
          const next = { ...current };
          delete next[filename];
          return next;
        });
      } catch (error: any) {
        sendRemoteLog('warn', `No se pudo liberar contenido retirado (${filename}): ${error?.message}`);
      }
    }, delayMs);
  };

  const syncVideos = async (manifestVideos: ManifestVideo[], source: ServerSource = 'primary') => {
    if (isDownloadingVideos || isUpdating) return;
    setIsDownloadingVideos(true);
    let newLocalFiles = { ...localFiles };
    let hasChanges = false;

    try {
      const cachedFiles = await FileSystem.readDirectoryAsync(VIDEO_DIR);
      const manifestFilenames = manifestVideos.map(v => v.filename);
      
      for (const file of cachedFiles) {
        // A standby manifest can be intentionally delayed. Never let it delete
        // newer content that was already downloaded from the primary server.
        if (source === 'primary' && !manifestFilenames.includes(file) && file !== currentFilenameRef.current) {
           // The native decoder can still hold the previous file briefly after
           // React changes item. Delete only after it is no longer active.
           removeCachedFileWhenReleased(file);
        }
      }

      for (const video of manifestVideos) {
        const fileUri = VIDEO_DIR + video.filename;
        let fileInfo = await FileSystem.getInfoAsync(fileUri);

        const isValidFile = async (uri: string, size?: number, sha256?: string | null) => {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) return false;
          if (size && 'size' in info && info.size !== size) return false;
          if (sha256 && SilentInstall?.sha256File) {
            const actualHash = await SilentInstall.sha256File(uri);
            return typeof actualHash === 'string' && actualHash.toLowerCase() === sha256.toLowerCase();
          }
          return true;
        };

        if (fileInfo.exists && !(await isValidFile(fileUri, video.size_bytes, video.hash_sha256))) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          delete newLocalFiles[video.filename];
          fileInfo = await FileSystem.getInfoAsync(fileUri);
          hasChanges = true;
          sendRemoteLog('warn', `Contenido local inválido descartado: ${video.filename}`);
        }
        
        if (!fileInfo.exists) {
           sendRemoteLog('info', `Descargando contenido: ${video.filename}`);
           const remoteUrl = await getApiUrl(source, `/api/videos/${encodeURIComponent(video.filename)}`);
           const temporaryUri = `${fileUri}.download`;
           await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
           await FileSystem.downloadAsync(remoteUrl, temporaryUri);
           if (!(await isValidFile(temporaryUri, video.size_bytes, video.hash_sha256))) {
             await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
             throw new Error(`Verificación SHA-256/tamaño fallida para ${video.filename}`);
           }
           await FileSystem.moveAsync({ from: temporaryUri, to: fileUri });
           newLocalFiles[video.filename] = fileUri;
           hasChanges = true;
        } else if (!newLocalFiles[video.filename]) {
           newLocalFiles[video.filename] = fileUri;
           hasChanges = true;
        }
      }

      if (hasChanges) {
         setLocalFiles(newLocalFiles);
      }
    } catch (e: any) {
      sendRemoteLog('error', `Error sincronizando contenido: ${e?.message}`);
    } finally {
      setIsDownloadingVideos(false);
    }
  };

  const syncStandby = async (standby: StandbyImage | null, source: ServerSource) => {
    if (!standby?.url) return;
    try {
      const extension = standby.filename.split('.').pop()?.toLowerCase() || 'png';
      const target = `${FileSystem.documentDirectory}standby.${extension}`;
      const current = await FileSystem.getInfoAsync(target);
      if (current.exists && standby.hash_sha256 && SilentInstall?.sha256File) {
        const hash = await SilentInstall.sha256File(target.replace('file://', ''));
        if (hash?.toLowerCase() === standby.hash_sha256.toLowerCase()) {
          standbyHashRef.current = standby.hash_sha256.toLowerCase();
          setStandbyUri(target);
          return;
        }
      }
      const remoteUrl = await getApiUrl(source, standby.url);
      const temporary = `${target}.download`;
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      await FileSystem.downloadAsync(remoteUrl, temporary);
      if (standby.hash_sha256 && SilentInstall?.sha256File) {
        const hash = await SilentInstall.sha256File(temporary.replace('file://', ''));
        if (hash?.toLowerCase() !== standby.hash_sha256.toLowerCase()) throw new Error('SHA-256 inválido');
      }
      await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.moveAsync({ from: temporary, to: target });
      standbyHashRef.current = standby.hash_sha256?.toLowerCase() || null;
      standbyLoadLoggedRef.current = false;
      setStandbyUri(target);
    } catch (error: any) {
      sendRemoteLog('warn', `No se pudo actualizar la imagen de espera: ${error?.message}`);
    }
  };

  // Poll central backend
  useEffect(() => {
    let isMounted = true;
    
    const checkStreamUrlDirectly = async (url: string): Promise<boolean> => {
      if (!url) return false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.status === 200;
      } catch (e) {
        return false;
      }
    };

    const fetchAPI = async () => {
      if (isUpdating) return; 
      
      try {
        const netState = await Network.getNetworkStateAsync();
        if (isMounted) setNetworkState(netState);

        if (!netState.isConnected || !netState.isInternetReachable) {
            return;
        }

        let targetUrl = liveStatusRef.current.url || 'https://loteriarn.b-cdn.net/Forquera2/video.m3u8';

        // 1. Telemetry and central control from VPS (if reachable)
        try {
          const freeDiskSpace = await FileSystem.getFreeDiskStorageAsync();
          let currentDownloadedFiles: string[] = [];
          try {
            currentDownloadedFiles = await FileSystem.readDirectoryAsync(VIDEO_DIR);
          } catch (_) {}

          const resLive = await fetchWithFailover('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              token: token,
              playbackStatus: emergencyRef.current.active ? 'emergency' : liveStatusRef.current.live ? 'live' : 'offline',
              freeSpace: freeDiskSpace,
              appVersion: currentAppVersion,
              hardwareId: Constants.installationId || token,
              androidVersion: deviceInfoRef.current.androidVersion,
              deviceModel: deviceInfoRef.current.deviceModel,
              deviceSerial: deviceInfoRef.current.deviceSerial,
              downloadedVideos: currentDownloadedFiles
            })
          });
          if (resLive.status === 401) {
            await onLogout();
            return;
          }
          const dataLive = await resLive.json();

          if (dataLive?.primaryApiUrl || dataLive?.secondaryApiUrl) {
            await saveServerUrls(dataLive.primaryApiUrl, dataLive.secondaryApiUrl);
          }

          if (dataLive?.url) {
            targetUrl = dataLive.url;
          }

          if (dataLive.pollInterval && dataLive.pollInterval > 0) {
            const newInterval = dataLive.pollInterval * 1000;
            if (newInterval !== pollIntervalMs) {
              setPollIntervalMs(newInterval);
            }
          }
          
          if (dataLive.emergency !== undefined) {
            setEmergency({
              active: dataLive.emergency,
              title: dataLive.emergencyTitle || 'EMERGENCIA',
              message: dataLive.emergencyMessage || '',
              backgroundColor: dataLive.emergencyBackgroundColor || '#7f1d1d',
              titleColor: dataLive.emergencyTitleColor || '#ef4444',
              messageColor: dataLive.emergencyMessageColor || '#ffffff',
            });
          }

          if (dataLive.restartRequested && !remoteCommandBusyRef.current) {
            remoteCommandBusyRef.current = true;
            try {
              await fetchWithFailover('/api/device-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'restart_ack' })
              });
              sendRemoteLog('info', 'Orden remota: reiniciando aplicacion');
              setTimeout(() => SilentInstall?.restartApp?.(), 750);
              return;
            } catch (commandError: any) {
              remoteCommandBusyRef.current = false;
              sendRemoteLog('error', `Fallo al aceptar reinicio remoto: ${commandError?.message}`);
            }
          } else if (dataLive.screenshotRequested && !remoteCommandBusyRef.current) {
            remoteCommandBusyRef.current = true;
            try {
              if (!SilentInstall?.captureScreen) throw new Error('Captura nativa no disponible');
              const imageBase64 = await SilentInstall.captureScreen();
              await fetchWithFailover('/api/device-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'screenshot', imageBase64 })
              }, 15000);
              sendRemoteLog('info', 'Captura remota enviada correctamente');
            } catch (commandError: any) {
              try {
                await fetchWithFailover('/api/device-control', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, action: 'screenshot', error: commandError?.message || 'Error desconocido' })
                });
              } catch (_) {}
              sendRemoteLog('error', `Fallo en captura remota: ${commandError?.message}`);
            } finally {
              remoteCommandBusyRef.current = false;
            }
          }

          if (dataLive.latestApkVersion && isVersionNewer(dataLive.latestApkVersion, currentAppVersion)) {
            if (dataLive.latestApkUrl && dataLive.latestApkSha256 && lastAttemptedUpdateRef.current !== dataLive.latestApkVersion) {
               downloadAndInstallUpdate(dataLive.latestApkUrl, dataLive.latestApkVersion, dataLive.latestApkSha256);
               return; // PAUSA OTRAS DESCARGAS MIENTRAS SE ACTUALIZA EL APK
            }
          }
        } catch (telemetryErr) {
          // VPS unreachable: device will continue autonomously
        }

        // 2. Fetch manifest if VPS is available
        try {
          const manifestResult = await fetchReadWithFailover(`/api/manifest?_t=${Date.now()}`);
          const resManifest = manifestResult.response;
          const dataManifest = await resManifest.json();
          if (isMounted) {
            setServerSource(manifestResult.source);
            if (dataManifest.tickers) {
               setTickers(dataManifest.tickers);
            }
            if (dataManifest.videos) {
               const nextPlaylist = dataManifest.videos as ManifestVideo[];
               manifestLoadedRef.current = true;
               manifestPlaylistRef.current = nextPlaylist;
               setPlaylist(current => {
                 const playing = currentFilenameRef.current;
                 const activeItem = playing ? current.find(item => item.filename === playing) : undefined;
                 // Keep the current playlist shape until the active item finishes;
                 // changing indices here could cut it even if its file is retained.
                 return activeItem && !nextPlaylist.some(item => item.filename === playing)
                   ? current
                   : nextPlaylist;
               });
               syncVideos(dataManifest.videos, manifestResult.source);
            }
            if (dataManifest.standby) syncStandby(dataManifest.standby, manifestResult.source);
          }
        } catch (_) {}

        // 3. Autonomous Client-Side Stream Verification
        // Each device directly checks if Flussonic stream is broadcasting (HTTP 200)
        const isStreamOnline = await checkStreamUrlDirectly(targetUrl);
        
        if (isMounted) {
          if (isStreamOnline) {
            missedLiveCountRef.current = 0;
            if (!liveStatusRef.current.live || liveStatusRef.current.url !== targetUrl) {
              setLiveHasError(false);
              liveStatusRef.current = { live: true, url: targetUrl };
              setLiveStatus({ live: true, url: targetUrl });
            }
          } else {
            missedLiveCountRef.current += 1;
            // A failed manifest probe must not interrupt a player still advancing.
            if (liveStatusRef.current.live && liveStatusRef.current.url === targetUrl &&
                (Date.now() - liveLastPositionTimeRef.current < 15000 || missedLiveCountRef.current < 3)) return;
            setLiveHasError(false);
            if (liveStatusRef.current.live || liveStatusRef.current.url !== targetUrl) {
              liveStatusRef.current = { live: false, url: targetUrl };
              setLiveStatus({ live: false, url: targetUrl });
            }
          }
        }
      } catch (err: any) {
        console.error("FETCH API ERROR:", err?.message || err);
      }
    };

    fetchAPI();
    const interval = setInterval(fetchAPI, pollIntervalMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, isUpdating, pollIntervalMs]);

  useEffect(() => {
    if (!liveStatus.live || !liveHasError) return;

    const timer = setTimeout(() => {
      setLiveHasError(false);
      setLiveRetryKey(prev => prev + 1);
    }, 30000);

    return () => clearTimeout(timer);
  }, [liveStatus.live, liveHasError]);

  useEffect(() => {
    const isLiveActiveCurrent = liveStatus.live && liveStatus.url !== '' && !liveHasError;
    if (!isLiveActiveCurrent) {
      liveFadeOut();
    } else {
      setIsLiveReady(false);
      liveFadeAnim.setValue(0);
    }
  }, [liveStatus.live, liveStatus.url, liveHasError, liveRetryKey]);

  useEffect(() => {
    if (currentOfflineIndex >= playlist.length && playlist.length > 0) {
      setCurrentOfflineIndex(0);
    }
  }, [playlist, currentOfflineIndex]);

  const currentItem = playlist[currentOfflineIndex];
  const isImageItem = currentItem?.media_type === 'image';

  // Handle timer for image items
  useEffect(() => {
    if (!isImageItem || liveStatus.live || emergency.active || playlist.length <= 1) return;

    const durationMs = (currentItem?.display_duration || 10) * 1000;
    sendPlaybackStat(currentItem.filename, 'start');

    const timer = setTimeout(() => {
      sendPlaybackStat(currentItem.filename, 'end', true);
      fadeOutAndNext(() => {
        const latestPlaylist = manifestPlaylistRef.current;
        if (manifestLoadedRef.current && !latestPlaylist.some(item => item.filename === currentItem.filename)) {
          const retiredFilename = currentItem.filename;
          setPlaylist(latestPlaylist);
          setCurrentOfflineIndex(0);
          removeCachedFileWhenReleased(retiredFilename, 2500);
          return;
        }
        setCurrentOfflineIndex((prev) => (prev + 1) % playlist.length);
      });
    }, Math.max(0, durationMs - 600));

    return () => clearTimeout(timer);
  }, [currentOfflineIndex, isImageItem, liveStatus.live, emergency.active, playlist.length]);

  const onOfflineVideoEnd = async (status: any) => {
    if (status.isLoaded) {
      if (status.isPlaying && Math.abs(status.positionMillis - lastPositionRef.current) >= 250) {
        lastPositionRef.current = status.positionMillis;
        lastPositionTimeRef.current = Date.now();
        localRecoveryStageRef.current = 0;
      }
      // Normal end logic
      if (status.didJustFinish) {
        lastPositionRef.current = 0;
        lastPositionTimeRef.current = Date.now();
        if (currentItem) {
          sendPlaybackStat(currentItem.filename, 'end', true);
        }
        fadeOutAndNext(async () => {
          const latestPlaylist = manifestPlaylistRef.current;
          const wasRemoved = manifestLoadedRef.current && currentItem && !latestPlaylist.some(item => item.filename === currentItem.filename);
          if (wasRemoved) {
            const retiredFilename = currentItem.filename;
            setPlaylist(latestPlaylist);
            setCurrentOfflineIndex(0);
            removeCachedFileWhenReleased(retiredFilename, 2500);
            return;
          }
          if (playlist.length > 1) {
            const nextIndex = (currentOfflineIndex + 1) % playlist.length;
            setCurrentOfflineIndex(nextIndex);
          } else if (playlist.length === 1) {
            await loopVideoRef.current?.replayAsync();
            fadeIn();
          }
        });
      }
    } else if (status.error) {
      sendRemoteLog('error', `Error en reproducción de video local (${currentItem?.filename}): ${status.error}`);
      if (playlist.length > 1) {
        const nextIndex = (currentOfflineIndex + 1) % playlist.length;
        setCurrentOfflineIndex(nextIndex);
      }
    }
  };

  const onLiveVideoStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      // Track real progress regardless of isBuffering/isPlaying flags from the firmware.
      // The watchdog below is the single timeout that recovers a stalled live player.
      if (hasLiveProgress(liveLastPositionRef.current, status.positionMillis)) {
        liveLastPositionRef.current = status.positionMillis;
        liveLastPositionTimeRef.current = Date.now();
      }
    } else if (status.error) {
       sendRemoteLog('error', `Live stream error: ${status.error}`);
       setLiveHasError(true);
    }
  };

  const currentVideoFilename = currentItem?.filename;
  const localUri = currentVideoFilename ? localFiles[currentVideoFilename] : null;
  const offlineSrc = localUri ? { uri: localUri } : null;

  useEffect(() => {
    currentFilenameRef.current = currentVideoFilename || null;
  }, [currentVideoFilename]);

  useEffect(() => {
    lastPositionRef.current = 0;
    lastPositionTimeRef.current = Date.now();
    localRecoveryStageRef.current = 0;
  }, [currentVideoFilename, liveStatus.live, liveStatus.url]);

  useEffect(() => {
    liveLastPositionRef.current = 0;
    liveLastPositionTimeRef.current = Date.now();
  }, [liveStatus.live, liveStatus.url, liveRetryKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isUpdating || emergency.active) return;

      const now = Date.now();
      const liveIsActive = liveStatus.live && liveStatus.url !== '' && !liveHasError;
      if (liveIsActive && now - liveLastPositionTimeRef.current > 25000) {
        sendRemoteLog('warn', 'Watchdog: transmision en vivo congelada. Reiniciando reproductor.');
        liveLastPositionRef.current = 0;
        liveLastPositionTimeRef.current = now;
        setLiveRetryKey(prev => prev + 1);
        return;
      }

      const localIsActive = !!localUri && !isImageItem && (!liveIsActive || !isLiveReady);
      if (localIsActive) {
        const stalledMs = now - lastPositionTimeRef.current;
        const action = localRecoveryAction(stalledMs, localRecoveryStageRef.current, playlist.length > 1);
        if (action === 'resume') {
          localRecoveryStageRef.current = 1;
          sendRemoteLog('warn', `Watchdog: video local pausado (${currentVideoFilename}). Reanudando automáticamente.`);
          loopVideoRef.current?.playAsync().catch(() => undefined);
        } else if (action === 'remount') {
          localRecoveryStageRef.current = 2;
          sendRemoteLog('warn', `Watchdog: video local sin avance (${currentVideoFilename}). Recargando reproductor.`);
          setOfflineRetryKey(prev => prev + 1);
        } else if (action === 'next') {
          localRecoveryStageRef.current = 3;
          sendRemoteLog('warn', `Watchdog: video local irrecuperable (${currentVideoFilename}). Pasando al siguiente.`);
          lastPositionRef.current = 0;
          lastPositionTimeRef.current = now;
          setCurrentOfflineIndex(prev => (prev + 1) % playlist.length);
        } else if (action === 'replay') {
          localRecoveryStageRef.current = 3;
          sendRemoteLog('warn', `Watchdog: reiniciando el único video local (${currentVideoFilename}).`);
          lastPositionRef.current = 0;
          lastPositionTimeRef.current = now;
          loopVideoRef.current?.replayAsync().catch(() => setOfflineRetryKey(prev => prev + 1));
        }
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [isUpdating, emergency.active, liveStatus.live, liveStatus.url, liveHasError, isLiveReady, localUri, isImageItem, currentVideoFilename, playlist.length]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;

      const now = Date.now();
      lastPositionTimeRef.current = now;
      liveLastPositionTimeRef.current = now;
      localRecoveryStageRef.current = 0;
      loopVideoRef.current?.playAsync().catch(() => undefined);
      if (liveStatus.live && liveStatus.url !== '' && !liveHasError) {
        setLiveRetryKey(prev => prev + 1);
      } else if (!isImageItem && localUri) {
        setOfflineRetryKey(prev => prev + 1);
      }
    });

    return () => subscription.remove();
  }, [liveStatus.live, liveStatus.url, liveHasError, isImageItem, localUri]);

  if (isUpdating) {
    return (
      <View style={styles.container}>
         <View style={styles.playerWrapper}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={{color: '#10b981', marginTop: 20, fontSize: 22, fontWeight: 'bold', textAlign: 'center'}}>
              Actualización de Sistema (v{updateVersion})
            </Text>
            <Text style={{color: 'white', marginTop: 10, fontSize: 16, textAlign: 'center', paddingHorizontal: 30}}>
              {updateStatusText}
            </Text>
         </View>
      </View>
    );
  }

  // EMERGENCY SCREEN
  if (emergency.active) {
    return (
      <View style={[styles.container, { backgroundColor: emergency.backgroundColor, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Text style={{ color: emergency.titleColor, fontSize: 72, fontWeight: '900', marginBottom: 20 }}>
          🚨 {emergency.title || 'EMERGENCIA'}
        </Text>
        <Text style={{ color: emergency.messageColor, fontSize: 36, textAlign: 'center', fontWeight: 'bold', lineHeight: 50 }}>
          {emergency.message || 'Atención: Mensaje de Emergencia en Pantalla'}
        </Text>
      </View>
    );
  }

  const isLiveActive = liveStatus.live && liveStatus.url !== '' && !liveHasError;

  return (
    <View style={styles.container}>
      <View style={styles.standbyLayer}>
        <Image
          source={standbyUri ? { uri: standbyUri } : require('../../assets/logo_official.png')}
          style={styles.standbyImage}
          resizeMode="contain"
          onLoad={() => {
            if (standbyLoadLoggedRef.current) return;
            standbyLoadLoggedRef.current = true;
            sendRemoteLog('info', `Imagen de espera visible (${standbyHashRef.current ? 'personalizada' : 'institucional'}).`);
          }}
          onError={(event) => {
            sendRemoteLog('error', `No se pudo mostrar la imagen de espera: ${event.nativeEvent.error}`);
            standbyHashRef.current = null;
            standbyLoadLoggedRef.current = false;
            setStandbyUri(null);
          }}
        />
      </View>
      
      {/* OFFLINE LOOP PLAYER (VIDEO & IMAGE) - ALWAYS MOUNTED IN BACKGROUND */}
      <View style={[styles.playerWrapper, !offlineSrc && styles.transparentPlayer]}>
         {offlineSrc ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
           {isImageItem ? (
             <Image
               source={{ uri: localUri! }}
               style={StyleSheet.absoluteFill}
               resizeMode="contain"
               onLoadEnd={() => fadeIn()}
             />
           ) : (
             <Video
               ref={loopVideoRef}
               key={`${currentVideoFilename}_${offlineRetryKey}`}
               source={offlineSrc}
               style={StyleSheet.absoluteFill}
               useNativeControls={false}
               resizeMode={ResizeMode.CONTAIN}
               isLooping={playlist.length === 1}
               shouldPlay={!isLiveActive}
               isMuted={isLiveActive}
               onPlaybackStatusUpdate={status => onOfflineVideoEnd(status)}
               onError={(err) => {
                 sendRemoteLog('error', `Error cargando video local (${currentItem?.filename}): ${JSON.stringify(err)}`);
                 if (playlist.length > 1) {
                   const nextIndex = (currentOfflineIndex + 1) % playlist.length;
                   setCurrentOfflineIndex(nextIndex);
                 }
               }}
               onLoad={() => {
                 fadeIn();
                 if (currentItem) sendPlaybackStat(currentItem.filename, 'start');
                 if (playlist.length > 1) {
                   loopVideoRef.current?.playAsync();
                 }
               }}
             />
           )}
          </Animated.View>
         ) : (
           <View style={styles.emptyPlaylist} />
         )}
      </View>

      {/* LIVE HLS PLAYER (MOUNTED ON TOP WHEN LIVE IS ACTIVE, FADES IN SMOOTHLY WHEN READY) */}
      {isLiveActive && (
        <Animated.View style={[styles.playerWrapper, { opacity: liveFadeAnim, zIndex: 10 }]}>
           <Video
             ref={liveVideoRef}
             key={liveStatus.url + '_' + liveRetryKey}
             source={{ uri: liveStatus.url }}
             style={StyleSheet.absoluteFill}
             useNativeControls={false}
             resizeMode={ResizeMode.CONTAIN}
             shouldPlay={isLiveActive} 
             isMuted={false}
             onReadyForDisplay={() => {
               liveFadeIn();
             }}
             onError={(error) => {
               sendRemoteLog('warn', `Error cargando live stream URL (${liveStatus.url}): ${JSON.stringify(error)}`);
               setLiveHasError(true);
               liveFadeOut();
             }}
             onPlaybackStatusUpdate={(status) => {
               onLiveVideoStatusUpdate(status);
               if (status.isLoaded) {
                 if ((status as any).error) {
                   setLiveHasError(true);
                   liveFadeOut();
                 } else if (status.isPlaying && status.positionMillis > 0 && !isLiveReady) {
                   liveFadeIn();
                 }
               }
             }}
           />
           <View style={styles.liveTag}>
             <Text style={styles.liveTagText}>🔴 EN VIVO</Text>
           </View>
        </Animated.View>
      )}

      {/* TICKERS / MARQUESINAS OVERLAY (Desplazamiento continuo) */}
      {tickers.map((t, idx) => (
        <MarqueeTicker
          key={idx}
          text={t.text}
          speed={t.speed}
          position={t.position}
          bgColor={t.bg_color}
          textColor={t.text_color}
        />
      ))}

      {serverSource === 'secondary' && (
        <MarqueeTicker
          text={MAINTENANCE_NOTICE}
          speed={42}
          position="bottom"
          bgColor="rgba(180, 83, 9, 0.96)"
          textColor="#FFFFFF"
        />
      )}
      
      {/* NO INTERNET / NO NETWORK OVERLAY (CORNER WIDGET) */}
      {networkState && (!networkState.isConnected || !networkState.isInternetReachable) && (
        <View style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: 15,
          borderRadius: 12,
          zIndex: 9999,
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 320,
          borderWidth: 2,
          borderColor: '#ef4444'
        }}>
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 10, textAlign: 'center', fontWeight: 'bold' }}>
            {!networkState.isConnected || networkState.type === Network.NetworkStateType.NONE 
              ? '❌ Sin conexión a Red (Wi-Fi / Cable)' 
              : '❌ Red conectada pero sin Internet'}
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}
            onPress={async () => {
              try {
                await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS);
              } catch (_) {
                try {
                  await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
                } catch (e) {}
              }
            }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
              Configurar Red / Wi-Fi
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  playerWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  transparentPlayer: { backgroundColor: 'transparent' },
  standbyLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  emptyPlaylist: { justifyContent: 'center', alignItems: 'center' },
  standbyImage: { width: '70%', height: '70%' },
  emptyText: { color: '#64748b', marginTop: 10 },
  liveTag: { position: 'absolute', top: 30, right: 30, backgroundColor: 'rgba(220, 38, 38, 0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  liveTagText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  debugOverlay: { position: 'absolute', bottom: 20, right: 20, opacity: 0.3 },
  debugText: { color: 'white', fontSize: 10 }
});
