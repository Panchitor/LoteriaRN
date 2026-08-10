import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Animated, NativeModules } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Network from 'expo-network';
import { WebView } from 'react-native-webview';

import { MarqueeTicker } from '../components/MarqueeTicker';
import { fetchWithFailover, getPrimaryApiUrl, saveServerUrls } from '../services/apiClient';

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
  media_type?: 'video' | 'image';
  display_duration?: number;
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
  const [emergency, setEmergency] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [localFiles, setLocalFiles] = useState<Record<string, string>>({});
  const [currentOfflineIndex, setCurrentOfflineIndex] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('');
  const [updateVersion, setUpdateVersion] = useState('');
  const [isDownloadingVideos, setIsDownloadingVideos] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(10000);
  const [networkState, setNetworkState] = useState<Network.NetworkState | null>(null);
  
  const [liveRetryKey, setLiveRetryKey] = useState(0);
  const [liveHasError, setLiveHasError] = useState(false);
  const [isLiveReady, setIsLiveReady] = useState(false);
  
  const lastAttemptedUpdateRef = useRef<string | null>(null);
  const missedLiveCountRef = useRef<number>(0);

  const loopVideoRef = useRef<Video>(null);
  const liveVideoRef = useRef<Video>(null);
  
  // Watchdog refs
  const lastPositionRef = useRef<number>(0);
  const lastPositionTimeRef = useRef<number>(Date.now());
  
  const liveLastPositionRef = useRef<number>(0);
  const liveLastPositionTimeRef = useRef<number>(Date.now());
  
  const currentAppVersion = Constants.expoConfig?.version || '1.0.0';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liveFadeAnim = useRef(new Animated.Value(0)).current;

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

  const downloadAndInstallUpdate = async (apkUrl: string, newVersion: string) => {
    if (isUpdating || lastAttemptedUpdateRef.current === newVersion) return;
    
    try {
      setIsUpdating(true);
      setUpdateVersion(newVersion);
      setUpdateStatusText(`Se encontró una nueva actualización (v${newVersion}). Descargando paquete...`);
      sendRemoteLog('info', `Iniciando descarga OTA v${newVersion}`);
      
      let finalUrl = apkUrl;
      if (finalUrl.includes('localhost')) {
        finalUrl = await getPrimaryApiUrl(finalUrl.replace('http://localhost:3000', ''));
      }
      
      const fileUri = FileSystem.documentDirectory + 'update.apk';
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      const downloadResumable = FileSystem.createDownloadResumable(
        finalUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const percentage = (progress * 100).toFixed(0);
          setUpdateStatusText(`Se encontró una nueva actualización (v${newVersion}). Descargando paquete: ${percentage}%`);
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult) throw new Error("Fallo la descarga de la APK");
      const { uri } = downloadResult;
      lastAttemptedUpdateRef.current = newVersion;
      
      const cleanPath = uri.replace('file://', '');
      setUpdateStatusText(`Descarga completada (v${newVersion}). Aplicando actualización en segundo plano (su / pm)...`);

      try {
        if (SilentInstall && SilentInstall.installApk) {
          const res = await SilentInstall.installApk(cleanPath);
          sendRemoteLog('info', `Instalación silenciosa ejecutada con éxito (${res})`);
          setUpdateStatusText(`Actualización v${newVersion} instalada correctamente en segundo plano.`);
        } else {
          throw new Error("Módulo de instalación silenciosa no registrado");
        }
      } catch (silentErr: any) {
        sendRemoteLog('warn', `Instalación silenciosa en reintento: ${silentErr?.message}`);
        setUpdateStatusText(`DETALLE ERROR (v${newVersion}): ${silentErr?.message || silentErr}`);
      }

      setTimeout(() => {
        setIsUpdating(false);
        setUpdateStatusText('');
      }, 8000);
      
    } catch (e: any) {
      sendRemoteLog('error', `Error en instalación OTA: ${e?.message}`);
      setUpdateStatusText(`Error al actualizar: ${e?.message || 'Error desconocido'}`);
      setTimeout(() => {
        setIsUpdating(false);
      }, 5000);
    }
  };

  const syncVideos = async (manifestVideos: ManifestVideo[]) => {
    if (isDownloadingVideos || isUpdating) return;
    setIsDownloadingVideos(true);
    let newLocalFiles = { ...localFiles };
    let hasChanges = false;

    try {
      const cachedFiles = await FileSystem.readDirectoryAsync(VIDEO_DIR);
      const manifestFilenames = manifestVideos.map(v => v.filename);
      
      for (const file of cachedFiles) {
        if (!manifestFilenames.includes(file)) {
           await FileSystem.deleteAsync(VIDEO_DIR + file, { idempotent: true });
           delete newLocalFiles[file];
           hasChanges = true;
        }
      }

      for (const video of manifestVideos) {
        const fileUri = VIDEO_DIR + video.filename;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
           sendRemoteLog('info', `Descargando contenido: ${video.filename}`);
           const remoteUrl = await getPrimaryApiUrl(`/api/videos/${encodeURIComponent(video.filename)}`);
           await FileSystem.downloadAsync(remoteUrl, fileUri);
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

        let targetUrl = liveStatus.url || 'https://loteriarn.b-cdn.net/Forquera2/video.m3u8';

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
              playbackStatus: emergency.active ? 'emergency' : liveStatus.live ? 'live' : 'offline',
              freeSpace: freeDiskSpace,
              appVersion: currentAppVersion,
              hardwareId: Constants.installationId || token,
              downloadedVideos: currentDownloadedFiles
            })
          });
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
              message: dataLive.emergencyMessage || ''
            });
          }

          if (dataLive.latestApkVersion && isVersionNewer(dataLive.latestApkVersion, currentAppVersion)) {
            if (dataLive.latestApkUrl && lastAttemptedUpdateRef.current !== dataLive.latestApkVersion) {
               downloadAndInstallUpdate(dataLive.latestApkUrl, dataLive.latestApkVersion);
               return; // PAUSA OTRAS DESCARGAS MIENTRAS SE ACTUALIZA EL APK
            }
          }
        } catch (telemetryErr) {
          // VPS unreachable: device will continue autonomously
        }

        // 2. Fetch manifest if VPS is available
        try {
          const resManifest = await fetchWithFailover(`/api/manifest?_t=${Date.now()}`);
          const dataManifest = await resManifest.json();
          if (isMounted) {
            if (dataManifest.tickers) {
               setTickers(dataManifest.tickers);
            }
            if (dataManifest.videos) {
               setPlaylist(dataManifest.videos);
               syncVideos(dataManifest.videos);
            }
          }
        } catch (_) {}

        // 3. Autonomous Client-Side Stream Verification
        // Each device directly checks if Flussonic stream is broadcasting (HTTP 200)
        const isStreamOnline = await checkStreamUrlDirectly(targetUrl);
        
        if (isMounted) {
          if (isStreamOnline) {
            missedLiveCountRef.current = 0;
            if (!liveStatus.live || liveStatus.url !== targetUrl) {
              setLiveHasError(false);
              setLiveStatus({ live: true, url: targetUrl });
            }
          } else {
            missedLiveCountRef.current = 0;
            setLiveHasError(false);
            if (liveStatus.live || liveStatus.url !== targetUrl) {
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
        setCurrentOfflineIndex((prev) => (prev + 1) % playlist.length);
      });
    }, Math.max(0, durationMs - 600));

    return () => clearTimeout(timer);
  }, [currentOfflineIndex, isImageItem, liveStatus.live, emergency.active, playlist.length]);

  const onOfflineVideoEnd = async (status: any) => {
    if (status.isLoaded) {
      // Normal end logic
      if (status.didJustFinish) {
        if (currentItem) {
          sendPlaybackStat(currentItem.filename, 'end', true);
        }
        fadeOutAndNext(async () => {
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
      if (status.isBuffering) {
        // Si se queda cargando/bufferizando más de 20 segundos
        if (Date.now() - liveLastPositionTimeRef.current > 20000) {
            sendRemoteLog('warn', `Live stream buffering timeout. Reconectando...`);
            setLiveRetryKey(prev => prev + 1);
            liveLastPositionTimeRef.current = Date.now();
        }
      } else if (status.isPlaying) {
        liveLastPositionTimeRef.current = Date.now();
      }
    } else if (status.error) {
       sendRemoteLog('error', `Live stream error: ${status.error}`);
       setLiveRetryKey(prev => prev + 1);
       liveLastPositionTimeRef.current = Date.now();
    }
  };

  const currentVideoFilename = currentItem?.filename;
  const localUri = currentVideoFilename ? localFiles[currentVideoFilename] : null;
  const offlineSrc = localUri ? { uri: localUri } : null;

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
      <View style={[styles.container, { backgroundColor: '#7f1d1d', justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Text style={{ color: '#ef4444', fontSize: 72, fontWeight: '900', marginBottom: 20 }}>
          🚨 EMERGENCIA
        </Text>
        <Text style={{ color: 'white', fontSize: 36, textAlign: 'center', fontWeight: 'bold', lineHeight: 50 }}>
          {emergency.message || 'Atención: Mensaje de Emergencia en Pantalla'}
        </Text>
      </View>
    );
  }

  const isLiveActive = liveStatus.live && liveStatus.url !== '' && !liveHasError;

  return (
    <View style={styles.container}>
      
      {/* OFFLINE LOOP PLAYER (VIDEO & IMAGE) - ALWAYS MOUNTED IN BACKGROUND */}
      <View style={styles.playerWrapper}>
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
               key={currentVideoFilename}
               source={offlineSrc}
               style={StyleSheet.absoluteFill}
               useNativeControls={false}
               resizeMode={ResizeMode.CONTAIN}
               isLooping={playlist.length === 1}
               shouldPlay={!isLiveActive || !isLiveReady} 
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
           <View style={styles.emptyPlaylist}>
             <ActivityIndicator color="#ffffff" />
             <Text style={styles.emptyText}>
               {playlist.length > 0 ? 'Descargando contenido institucionales...' : 'Esperando Institucional de Panel...'}
             </Text>
           </View>
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
  emptyPlaylist: { justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', marginTop: 10 },
  liveTag: { position: 'absolute', top: 30, right: 30, backgroundColor: 'rgba(220, 38, 38, 0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  liveTagText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  debugOverlay: { position: 'absolute', bottom: 20, right: 20, opacity: 0.3 },
  debugText: { color: 'white', fontSize: 10 }
});
