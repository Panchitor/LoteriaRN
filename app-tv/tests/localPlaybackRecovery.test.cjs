const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/localPlaybackRecovery.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', compiled)(mod.exports, mod);

test('local recovery escalates from resume to remount and then next item', () => {
  assert.equal(mod.exports.localRecoveryAction(7_999, 0, true), 'none');
  assert.equal(mod.exports.localRecoveryAction(8_000, 0, true), 'resume');
  assert.equal(mod.exports.localRecoveryAction(18_000, 1, true), 'remount');
  assert.equal(mod.exports.localRecoveryAction(30_000, 2, true), 'next');
});

test('a single frozen item is replayed instead of skipped', () => {
  assert.equal(mod.exports.localRecoveryAction(30_000, 2, false), 'replay');
});
