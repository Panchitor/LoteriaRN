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
const commands = compile(path.join(__dirname, '../src/lib/remoteCommands.ts'), request => request === './deviceStatus' ? status : require(request));
const now = new Date('2026-11-23T20:00:00.000Z').getTime();

test('remote commands are accepted only for online linked devices', () => {
  const device = { last_seen: new Date(now - 10_000), is_active: true, installation_id: 'install', revoked_at: null, last_command_status: null, last_command_at: null };
  assert.equal(commands.canIssueRemoteCommand(device, now), true);
  assert.equal(commands.canIssueRemoteCommand({ ...device, last_seen: new Date(now - 5 * 60_000) }, now), false);
});

test('pending commands expire instead of running days later', () => {
  assert.equal(commands.isRemoteCommandFresh({ last_command_status: 'pending', last_command_at: new Date(now - 60_000) }, now), true);
  assert.equal(commands.isRemoteCommandFresh({ last_command_status: 'pending', last_command_at: new Date(now - 3 * 60_000) }, now), false);
});
