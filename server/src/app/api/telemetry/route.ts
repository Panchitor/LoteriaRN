import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      console.error("Failed to parse telemetry json body");
    }
    const { token, playbackStatus, freeSpace, appVersion, hardwareId, downloadedVideos, androidVersion, deviceModel, deviceSerial } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // 1. Update the Device (Heartbeat)
    let videosStr = undefined;
    if (downloadedVideos) {
      videosStr = typeof downloadedVideos === 'string' ? downloadedVideos : JSON.stringify(downloadedVideos);
    }

    const authorizedDevice = await prisma.device.findFirst({
      where: { id: token, revoked_at: null, installation_id: { not: null } },
      select: { id: true, screenshot_requested: true, restart_requested: true },
    });
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
      where: { key: { in: ['LATEST_APK_VERSION', 'LATEST_APK_URL', 'FLUSSONIC_POLL_INTERVAL', 'EMERGENCY_ACTIVE', 'EMERGENCY_MESSAGE', 'PRIMARY_API_URL', 'SECONDARY_API_URL'] } }
    });
    const latestApkVersion = configs.find(c => c.key === 'LATEST_APK_VERSION')?.value || null;
    const latestApkUrl = configs.find(c => c.key === 'LATEST_APK_URL')?.value || null;
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
      pollInterval,
      emergency: emergencyActive === 'true',
      emergencyMessage,
      primaryApiUrl,
      secondaryApiUrl,
      screenshotRequested: authorizedDevice.screenshot_requested,
      restartRequested: authorizedDevice.restart_requested,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err: any) {
    console.error("TELEMETRY ROUTE ERROR:", err);
    return NextResponse.json({ error: "Internal Error", details: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
