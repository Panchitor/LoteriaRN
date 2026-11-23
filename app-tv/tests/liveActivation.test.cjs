const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/liveActivation.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', output)(mod.exports, mod, require);

test('never probes or mounts live playback when the server disabled it', () => {
  assert.equal(mod.exports.shouldAttemptLivePlayback(false, 0, 1000), false);
});

test('honors the retry cooldown after a stream failure', () => {
  assert.equal(mod.exports.shouldAttemptLivePlayback(true, 2000, 1000), false);
  assert.equal(mod.exports.shouldAttemptLivePlayback(true, 2000, 2000), true);
});
