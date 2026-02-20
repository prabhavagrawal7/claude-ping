'use strict';
// Smoke tests that run on all platforms in CI.
// These don't require any system tools (terminal-notifier, osascript, etc.)
// — they just verify the module wiring is correct.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGIN = path.join(ROOT, 'plugin');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── JSON files are valid ────────────────────────────────────────────────────
console.log('\nJSON validation');

test('plugin/hooks/hooks.json is valid JSON', () => {
  const raw = fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'), 'utf8');
  JSON.parse(raw);
});

test('plugin/hooks/hooks.json has required hook events', () => {
  const h = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'), 'utf8'));
  assert.ok(h.hooks.Stop, 'missing Stop hook');
  assert.ok(h.hooks.Notification, 'missing Notification hook');
  assert.ok(h.hooks.SessionStart, 'missing SessionStart hook');
  assert.ok(h.hooks.SessionEnd, 'missing SessionEnd hook');
});

test('hooks commands reference node + CLAUDE_PLUGIN_ROOT (no escaped quotes)', () => {
  const h = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'), 'utf8'));
  const allCommands = [
    ...h.hooks.Stop[0].hooks,
    ...h.hooks.Notification[0].hooks,
    ...h.hooks.SessionStart[0].hooks,
    ...h.hooks.SessionEnd[0].hooks,
  ].map(hook => hook.command);

  for (const cmd of allCommands) {
    assert.ok(cmd.startsWith('node '), `command should start with "node ": ${cmd}`);
    assert.ok(cmd.includes('${CLAUDE_PLUGIN_ROOT}'), `command should use CLAUDE_PLUGIN_ROOT: ${cmd}`);
    assert.ok(!cmd.includes('\\"'), `command should not contain escaped quotes: ${cmd}`);
  }
});

test('plugin/.claude-plugin/plugin.json is valid JSON', () => {
  const raw = fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8');
  const p = JSON.parse(raw);
  assert.ok(p.name, 'missing name');
  assert.ok(p.version, 'missing version');
});

test('.claude-plugin/marketplace.json is valid JSON with ./plugin source', () => {
  const raw = fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8');
  const m = JSON.parse(raw);
  assert.ok(m.name, 'missing marketplace name');
  assert.ok(Array.isArray(m.plugins), 'plugins should be an array');
  assert.ok(m.plugins.length > 0, 'plugins array is empty');
  assert.strictEqual(m.plugins[0].source, './plugin', 'source should be ./plugin');
});

// ── Module loading ──────────────────────────────────────────────────────────
console.log('\nModule loading');

test('plugin/src/pid.js exports findTerminalPid and getTtyDevice', () => {
  const pid = require(path.join(PLUGIN, 'src/pid'));
  assert.strictEqual(typeof pid.findTerminalPid, 'function');
  assert.strictEqual(typeof pid.getTtyDevice, 'function');
});

test('plugin/src/platform/darwin.js exports notify, focus, ringBell', () => {
  const m = require(path.join(PLUGIN, 'src/platform/darwin'));
  assert.strictEqual(typeof m.notify, 'function');
  assert.strictEqual(typeof m.focus, 'function');
  assert.strictEqual(typeof m.ringBell, 'function');
});

test('plugin/src/platform/linux.js exports notify, focus, ringBell', () => {
  const m = require(path.join(PLUGIN, 'src/platform/linux'));
  assert.strictEqual(typeof m.notify, 'function');
  assert.strictEqual(typeof m.focus, 'function');
  assert.strictEqual(typeof m.ringBell, 'function');
});

test('plugin/src/platform/win32.js exports notify, focus, ringBell', () => {
  const m = require(path.join(PLUGIN, 'src/platform/win32'));
  assert.strictEqual(typeof m.notify, 'function');
  assert.strictEqual(typeof m.focus, 'function');
  assert.strictEqual(typeof m.ringBell, 'function');
});

test(`correct platform module loads for ${process.platform}`, () => {
  const m = require(path.join(PLUGIN, 'src/platform/' + process.platform));
  assert.strictEqual(typeof m.notify, 'function');
});

// ── pid.js logic ────────────────────────────────────────────────────────────
console.log('\npid.js logic');

test('findTerminalPid returns an object with sessionPid and terminalPid keys', () => {
  const { findTerminalPid } = require(path.join(PLUGIN, 'src/pid'));
  const result = findTerminalPid();
  assert.ok(typeof result === 'object', 'should return an object');
  assert.ok('sessionPid' in result, 'missing sessionPid');
  assert.ok('terminalPid' in result, 'missing terminalPid');
});

test('getTtyDevice returns null or a string', () => {
  const { getTtyDevice } = require(path.join(PLUGIN, 'src/pid'));
  const result = getTtyDevice(1);
  assert.ok(result === null || typeof result === 'string');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
