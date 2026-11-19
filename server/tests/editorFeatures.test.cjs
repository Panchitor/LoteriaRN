const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/editorFeatures.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', output)(mod.exports, mod, require);

test('preserves safe defaults for editor navigation', () => {
  assert.deepEqual(mod.exports.resolveEditorFeatures([]), { agencies: true, schedule: false });
});

test('admin configuration can independently toggle editor sections', () => {
  assert.deepEqual(mod.exports.resolveEditorFeatures([
    { key: 'EDITOR_SHOW_AGENCIES', value: 'false' },
    { key: 'EDITOR_SHOW_SCHEDULE', value: 'true' },
  ]), { agencies: false, schedule: true });
});
