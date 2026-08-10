const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5433/loteria?schema=public'
  });
  try {
    await client.connect();
    const live = await client.query('SELECT * FROM "LiveEvent"');
    console.log("LiveEvent rows:", JSON.stringify(live.rows, null, 2));
    const config = await client.query('SELECT * FROM "SystemConfig"');
    console.log("SystemConfig rows:", JSON.stringify(config.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}

check();
