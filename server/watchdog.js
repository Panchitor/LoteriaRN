const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

try {
  require('dotenv').config();
} catch (e) {
  console.log("dotenv not loaded, using system env");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkStream(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { 
      method: 'GET', 
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    console.log(`[Watchdog] Stream check status for ${url}: ${res.status}`);
    return res.status === 200;
  } catch (e) {
    console.log(`[Watchdog] Stream check error: ${e.message}`);
    return false;
  }
}

async function loop() {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { key: 'FLUSSONIC_POLL_INTERVAL' }
    });
    const intervalSecs = config ? parseInt(config.value, 10) : 5;
    
    const urlConfig = await prisma.systemConfig.findFirst({
      where: { key: 'FLUSSONIC_BASE_URL' }
    });
    const url = urlConfig?.value || 'https://loteriarn.b-cdn.net/Forquera2/video.m3u8';

    let liveEvent = await prisma.liveEvent.findFirst();
    if (!liveEvent) {
      liveEvent = await prisma.liveEvent.create({
        data: {
          id: 'default',
          is_active: false,
          url: url
        }
      });
    }

    const isActive = await checkStream(url);

    if (liveEvent.is_active !== isActive || liveEvent.url !== url) {
      console.log(`[Watchdog] Updating DB live status: ${liveEvent.is_active} -> ${isActive}`);
      await prisma.liveEvent.update({
        where: { id: liveEvent.id },
        data: { is_active: isActive, url: url }
      });
    }

    setTimeout(loop, intervalSecs * 1000);
  } catch (error) {
    console.error("[Watchdog] Error in loop:", error);
    setTimeout(loop, 5000);
  }
}

console.log("[Watchdog] Starting Flussonic monitoring service...");
loop();
