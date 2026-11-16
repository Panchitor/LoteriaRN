const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/requestGuards.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', compiled)(mod.exports, mod, require);

test('rate limiter allows the quota and then returns a retry delay', () => {
  const scope = `test-${Date.now()}-${Math.random()}`;
  assert.equal(mod.exports.consumeRateLimit(scope, 'device', 2, 10_000), null);
  assert.equal(mod.exports.consumeRateLimit(scope, 'device', 2, 10_000), null);
  const retryAfter = mod.exports.consumeRateLimit(scope, 'device', 2, 10_000);
  assert.ok(retryAfter >= 1 && retryAfter <= 10);
});

test('opaque keys do not expose the credential', () => {
  const credential = 'sensitive-device-token';
  const key = mod.exports.opaqueRateKey(credential);
  assert.equal(key.length, 24);
  assert.equal(key.includes(credential), false);
});
