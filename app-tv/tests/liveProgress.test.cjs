const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/liveProgress.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', compiled)(mod.exports, mod);
const { hasLiveProgress } = mod.exports;

test('continuous HLS progress survives buffering flags over multiple timeout windows', () => {
  let previous = 0;
  let lastProgress = 0;
  for (let now = 500; now <= 120000; now += 500) {
    const status = { positionMillis: now, isBuffering: true, isPlaying: false };
    if (hasLiveProgress(previous, status.positionMillis)) {
      previous = status.positionMillis;
      lastProgress = now;
    }
    assert.ok(now - lastProgress < 25000);
  }
});
test('a frozen position still expires and invalid values never count as progress', () => {
  assert.equal(hasLiveProgress(3000, 3000), false);
  assert.equal(hasLiveProgress(3000, undefined), false);
  assert.equal(hasLiveProgress(3000, NaN), false);
  assert.equal(hasLiveProgress(3000, 3100), false);
  assert.equal(hasLiveProgress(3000, 0), true); // HLS timeline reset is movement.
});
