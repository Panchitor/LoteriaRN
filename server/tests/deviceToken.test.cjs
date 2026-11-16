const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/deviceToken.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', compiled)(mod.exports, mod, require);

const DEVICE_ID = '123e4567-e89b-42d3-a456-426614174000';

test('creates an opaque credential bound to the device id', () => {
  const first = mod.exports.createDeviceToken(DEVICE_ID);
  const second = mod.exports.createDeviceToken(DEVICE_ID);
  assert.ok(first.token.startsWith(`${DEVICE_ID}.`));
  assert.equal(first.hash.length, 64);
  assert.notEqual(first.token, second.token);
  assert.equal(mod.exports.deviceIdFromToken(first.token), DEVICE_ID);
  assert.equal(mod.exports.verifyDeviceTokenHash(first.token, first.hash), true);
  assert.equal(mod.exports.verifyDeviceTokenHash(second.token, first.hash), false);
});

test('legacy ids are distinguishable and malformed tokens are rejected', () => {
  assert.equal(mod.exports.isLegacyDeviceToken(DEVICE_ID), true);
  assert.equal(mod.exports.isLegacyDeviceToken(`${DEVICE_ID}.secret`), false);
  assert.equal(mod.exports.deviceIdFromToken('not-a-device'), null);
  assert.equal(mod.exports.deviceIdFromToken('x'.repeat(201)), null);
  assert.equal(mod.exports.verifyDeviceTokenHash(DEVICE_ID, 'invalid'), false);
});
