const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compile(file, localRequire = require) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', output)(mod.exports, mod, localRequire);
  return mod.exports;
}

const status = compile(path.join(__dirname, '../src/lib/deviceStatus.ts'));
const availability = compile(
  path.join(__dirname, '../src/lib/deviceAvailability.ts'),
  request => request === './deviceStatus' ? status : require(request),
);

const hour = 60 * 60 * 1000;
const now = new Date('2026-11-19T12:00:00.000Z').getTime();

test('reports a continuously connected device as fully available', () => {
  const metrics = availability.calculateDeviceAvailability({
    id: 'device-1',
    last_seen: new Date(now - 10_000),
    availability_started_at: new Date(now - 24 * hour),
    availability_tracking_since: new Date(now - 24 * hour),
  }, [], now);

  assert.equal(metrics.day.percent, 100);
  assert.equal(metrics.day.interruptions, 0);
  assert.equal(metrics.day.downtimeMs, 0);
});

test('combines completed and active sessions and counts interruptions', () => {
  const metrics = availability.calculateDeviceAvailability({
    id: 'device-1',
    last_seen: new Date(now - 10_000),
    availability_started_at: new Date(now - 10 * hour),
    availability_tracking_since: new Date(now - 24 * hour),
  }, [{
    device_id: 'device-1',
    started_at: new Date(now - 24 * hour),
    ended_at: new Date(now - 12 * hour),
  }], now);

  assert.equal(metrics.day.percent, 91.7);
  assert.equal(metrics.day.interruptions, 1);
  assert.equal(metrics.day.downtimeMs, 2 * hour);
});

test('uses only the period observed since history tracking began', () => {
  const metrics = availability.calculateDeviceAvailability({
    id: 'device-1',
    last_seen: new Date(now),
    availability_started_at: new Date(now - hour),
    availability_tracking_since: new Date(now - hour),
  }, [], now);

  assert.equal(metrics.month.percent, 100);
  assert.equal(metrics.month.observedMs, hour);
});

test('builds a readable outage history including an ongoing outage', () => {
  const device = {
    id: 'device-1',
    last_seen: new Date(now - 2 * hour),
    availability_started_at: new Date(now - 10 * hour),
    availability_tracking_since: new Date(now - 24 * hour),
  };
  const outages = availability.calculateRecentOutages(device, [{
    device_id: 'device-1',
    started_at: new Date(now - 24 * hour),
    ended_at: new Date(now - 12 * hour),
  }], now);

  assert.equal(outages.length, 2);
  assert.equal(outages[0].endedAt, null);
  assert.equal(outages[1].durationMs, 2 * hour);
});
