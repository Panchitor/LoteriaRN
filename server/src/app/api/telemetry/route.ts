import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";
import { authenticateDevice } from "@/lib/deviceAuth";
import { enforceRateLimit, opaqueRateKey, readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

type TelemetryBody = {
  token?: string;
  playbackStatus?: string;
  freeSpace?: number;
  appVersion?: string;
  hardwareId?: string;
  downloadedVideos?: string | string[];
  androidVersion?: string;
  deviceModel?: string;
  deviceSerial?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<TelemetryBody>(req, 64 * 1024);
    const { token, playbackStatus, freeSpace, appVersion, hardwareId, downloadedVideos, androidVersion, deviceModel, deviceSerial } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    const limited = enforceRateLimit(req, "telemetry", opaqueRateKey(token), 30, 60 * 1000);
    if (limited) return limited;

    // 1. Update the Device (Heartbeat)
    let videosStr = undefined;
    if (downloadedVideos) {
      videosStr = typeof downloadedVideos === 'string' ? downloadedVideos : JSON.stringify(downloadedVideos);
    }

    const authorizedDevice = await authenticateDevice(token);
    if (!authorizedDevice) {
      return NextResponse.json({ error: "DEVICE_REVOKED" }, { status: 401 });
    }

    await prisma.device.update({
      where: { id: authorizedDevice.id },
      data: {
        last_seen: new Date(),
        playback_status: playbackStatus || "unknown",
        free_space: freeSpace ? Math.floor(freeSpace) : 0, 
        app_version: appVersion || undefined,
        hw_id: hardwareId || undefined,
        android_version: androidVersion || undefined,
        device_model: deviceModel || undefined,
        device_serial: deviceSerial || undefined,
        downloaded_videos: videosStr,
      }
    });
    // 2. Fetch the Master Live Status
    let liveEvent = await prisma.liveEvent.findFirst();
    if (!liveEvent) {
      liveEvent = { id: "default", is_active: false, url: "http://canal10str.ddns.net:8088/Forquera2/video.m3u8", created_at: new Date() };
    }

    // 3. Fetch Latest APK Version, Emergency, and Failover Server URLs from SystemConfig
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['LATEST_APK_VERSION', 'LATEST_APK_URL', 'LATEST_APK_SHA256', 'PILOT_APK_VERSION', 'PILOT_APK_URL', 'PILOT_APK_SHA256', 'FLUSSONIC_POLL_INTERVAL', 'EMERGENCY_ACTIVE', 'EMERGENCY_MESSAGE', 'PRIMARY_API_URL', 'SECONDARY_API_URL'] } }
    });
    const stableApkVersion = configs.find(c => c.key === 'LATEST_APK_VERSION')?.value || null;
    const stableApkUrl = configs.find(c => c.key === 'LATEST_APK_URL')?.value || null;
    const stableApkSha256 = configs.find(c => c.key === 'LATEST_APK_SHA256')?.value || null;
    const pilotApkVersion = configs.find(c => c.key === 'PILOT_APK_VERSION')?.value || null;
    const pilotApkUrl = configs.find(c => c.key === 'PILOT_APK_URL')?.value || null;
    const pilotApkSha256 = configs.find(c => c.key === 'PILOT_APK_SHA256')?.value || null;
    const usePilot = authorizedDevice.update_channel === 'PILOT' && Boolean(pilotApkVersion && pilotApkUrl && pilotApkSha256);
    const latestApkVersion = usePilot ? pilotApkVersion : stableApkVersion;
    const latestApkUrl = usePilot ? pilotApkUrl : stableApkUrl;
    const latestApkSha256 = usePilot ? pilotApkSha256 : stableApkSha256;
    const pollInterval = parseInt(configs.find(c => c.key === 'FLUSSONIC_POLL_INTERVAL')?.value || '10', 10);
    const emergencyActive = configs.find(c => c.key === 'EMERGENCY_ACTIVE')?.value || 'false';
    const emergencyMessage = configs.find(c => c.key === 'EMERGENCY_MESSAGE')?.value || '';
    const primaryApiUrl = configs.find(c => c.key === 'PRIMARY_API_URL')?.value || null;
    const secondaryApiUrl = configs.find(c => c.key === 'SECONDARY_API_URL')?.value || null;

    return NextResponse.json({
      live: liveEvent.is_active,
      url: liveEvent.url,
      timestamp: Date.now(),
      latestApkVersion,
      latestApkUrl,
      latestApkSha256,
      updateChannel: usePilot ? 'PILOT' : 'STABLE',
      pollInterval,
      emergency: emergencyActive === 'true',
      emergencyMessage,
      primaryApiUrl,
      secondaryApiUrl,
      screenshotRequested: authorizedDevice.screenshot_requested,
      restartRequested: authorizedDevice.restart_requested,
    });

  } catch (error: unknown) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    console.error("TELEMETRY ROUTE ERROR:", errorMessage(error));
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
