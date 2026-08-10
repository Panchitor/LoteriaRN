fetch("https://loteriarn.patagonialive.media/api/telemetry", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "123", playbackStatus: "offline", freeSpace: 1024, appVersion: "1.0.0" })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
