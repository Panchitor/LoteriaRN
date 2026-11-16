const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/failoverPolicy.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', compiled)(mod.exports, mod);

test('secondary failover is limited to read-only requests', () => {
  assert.equal(mod.exports.allowsSecondaryFailover(), true);
  assert.equal(mod.exports.allowsSecondaryFailover('GET'), true);
  assert.equal(mod.exports.allowsSecondaryFailover('head'), true);
  assert.equal(mod.exports.allowsSecondaryFailover('POST'), false);
  assert.equal(mod.exports.allowsSecondaryFailover('PUT'), false);
  assert.equal(mod.exports.allowsSecondaryFailover('DELETE'), false);
});

test('maintenance notice describes degraded update timing', () => {
  assert.match(mod.exports.MAINTENANCE_NOTICE, /servidor principal en mantenimiento/i);
  assert.match(mod.exports.MAINTENANCE_NOTICE, /pueden demorar/i);
});
