const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('sidebar logo remains publicly readable for image rendering', () => {
  const proxy = fs.readFileSync(path.join(__dirname, '../src/proxy.ts'), 'utf8');
  const sidebar = fs.readFileSync(path.join(__dirname, '../src/components/Sidebar.tsx'), 'utf8');
  assert.match(proxy, /['"]\/logo-loteria-rn\.png['"]/);
  assert.match(sidebar, /logo-loteria-rn\.png/);
  assert.match(sidebar, /unoptimized/);
});
