import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const apply = process.argv.includes("--apply");
const storagePath = process.env.STORAGE_PATH;
if (!storagePath) throw new Error("STORAGE_PATH must be set explicitly");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function sha256File(filename) {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filename)
      .on("error", reject)
      .on("data", chunk => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

let updated = 0;
let missing = 0;
try {
  const videos = await prisma.video.findMany({
    where: { hash_sha256: null },
    select: { id: true, filename: true },
  });
  console.log(`${apply ? "Applying" : "Dry run for"} ${videos.length} media records`);
  for (const video of videos) {
    const filePath = path.join(storagePath, path.basename(video.filename));
    try {
      await access(filePath);
    } catch {
      missing += 1;
      console.error(`Missing: ${filePath}`);
      continue;
    }
    const digest = await sha256File(filePath);
    if (apply) {
      await prisma.video.update({ where: { id: video.id }, data: { hash_sha256: digest } });
      updated += 1;
    }
    console.log(`${video.filename}: ${digest}`);
  }
  console.log(JSON.stringify({ apply, found: videos.length, updated, missing }));
  if (missing) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
