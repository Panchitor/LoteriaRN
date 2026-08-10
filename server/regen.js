const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function run() {
  try {
    const v = await p.video.findMany();
    const content = JSON.stringify(v, (k, val) => typeof val === "bigint" ? Number(val) : val);
    await p.manifest.create({ data: { content, is_active: true } });
    console.log("Created manifest!");
  } catch(e) {
    console.error(e);
  }
}
run();
