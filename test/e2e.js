'use strict';
// E2E tests for the claude-ping notifier pipeline.
//
// Layer 1 — Pipeline (fully automated, no UI):
//   Pipe mock hook JSON to notify.js, check all side effects.
//
// Layer 2 — Focus script (automated, requires a GUI session):
//   Run focus/darwin.js with the detected terminal PID; verify no crash.
//
// Layer 3 — Click simulation (interactive, skipped in CI):
//   Send a real terminal-notifier toast with -execute pointing at a marker
//   script.  Poll for the marker for 30 s.  Pass = user clicked; timeout =
//   skip (not fail).
//
// Usage:
//   node test/e2e.js              # interactive (prompts for click)
//   CI=true node test/e2e.js      # skip interactive tests
//   SKIP_INTERACTIVE=true node test/e2e.js

const assert = require('assert');
const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT   = path.join(__dirname, '..');
const PLUGIN = path.join(ROOT, 'plugin');
const SRC    = path.join(PLUGIN, 'src');

const SKIP_INTERACTIVE =
  process.env.CI === 'true' || process.env.SKIP_INTERACTIVE === 'true';

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === 'SKIP') {
      console.log(`  - ${name} (skipped)`);
      skipped++;
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// ── Temp file paths ───────────────────────────────────────────────────────────
const pidFile = path.join(os.tmpdir(), 'claude_terminal_pid');

function findWrapperFile() {
  return fs.readdirSync(os.tmpdir())
    .filter(f => /^claude_focus_\d+_\d+\.sh$/.test(f))
    .map(f => ({ f, mt: fs.statSync(path.join(os.tmpdir(), f)).mtimeMs }))
    .sort((a, b) => b.mt - a.mt)
    .map(({ f }) => path.join(os.tmpdir(), f))[0] || null;
}

// ── Layer 1: notify.js pipeline ──────────────────────────────────────────────
console.log('\nLayer 1 — notify.js pipeline (mock JSON → side effects)');

// Clear stale test artefacts so tests are not contaminated by previous runs
try { fs.unlinkSync(pidFile); } catch {}
fs.readdirSync(os.tmpdir())
  .filter(f => /^claude_focus_\d+_\d+\.sh$/.test(f))
  .forEach(f => { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {} });

const mockStopJson = JSON.stringify({
  hook_event_name: 'Stop',
  last_assistant_message: 'E2E test — please ignore this notification',
});

// Run notify.js once and capture result for all subsequent assertions
const notifyResult = spawnSync(
  process.execPath,
  [path.join(SRC, 'notify.js')],
  { input: mockStopJson, encoding: 'utf8', timeout: 20000 }
);

test('notify.js exits with status 0', () => {
  assert.strictEqual(
    notifyResult.status, 0,
    `Exit ${notifyResult.status}\nstderr: ${notifyResult.stderr}`
  );
});

test('notify.js writes claude_terminal_pid', () => {
  assert.ok(fs.existsSync(pidFile), `Expected ${pidFile} to exist`);
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
  assert.ok(pid > 1, `Expected a real PID, got: ${pid}`);
});

test('notify.js writes claude_focus wrapper script', () => {
  const wrapperFile = findWrapperFile();
  assert.ok(wrapperFile && fs.existsSync(wrapperFile), `Expected a claude_focus_*.sh file in ${os.tmpdir()}`);
});

test('claude_focus wrapper starts with #!/bin/bash shebang', () => {
  const wrapperFile = findWrapperFile();
  const content = fs.readFileSync(wrapperFile, 'utf8');
  assert.ok(content.startsWith('#!/bin/bash'), `Got: ${content.slice(0, 40)}`);
});

test('claude_focus wrapper exec-calls node with focus/darwin.js', () => {
  const wrapperFile = findWrapperFile();
  const content = fs.readFileSync(wrapperFile, 'utf8');
  assert.ok(
    content.includes('exec "') && content.includes('focus/darwin.js"'),
    `wrapper content:\n${content}`
  );
});

test('claude_focus wrapper embeds the terminal PID as an argument', () => {
  const terminalPid = fs.readFileSync(pidFile, 'utf8').trim();
  const wrapperFile = findWrapperFile();
  const content = fs.readFileSync(wrapperFile, 'utf8');
  assert.ok(
    content.includes(`"${terminalPid}"`),
    `Wrapper does not embed PID ${terminalPid}\nWrapper:\n${content}`
  );
});

test('claude_focus wrapper is executable (mode has 0o111)', () => {
  const wrapperFile = findWrapperFile();
  const mode = fs.statSync(wrapperFile).mode;
  assert.ok(mode & 0o111, `Mode ${(mode & 0o777).toString(8)} is not executable`);
});

// ── Layer 2: focus/darwin.js invocation ──────────────────────────────────────
console.log('\nLayer 2 — focus/darwin.js invocation');

if (process.platform !== 'darwin') {
  console.log('  (skipped — not macOS)');
} else {
  const terminalPid = (() => {
    try { return fs.readFileSync(pidFile, 'utf8').trim(); } catch { return null; }
  })();

  test('focus/darwin.js runs without crash (no args)', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(SRC, 'focus/darwin.js')],
      { encoding: 'utf8', timeout: 8000 }
    );
    assert.ok(r.error === undefined, `Spawn error: ${r.error}`);
    // Script exits 0 even if no PID found (graceful no-op)
    assert.strictEqual(r.status, 0, `Non-zero exit: ${r.status}\n${r.stderr}`);
  });

  test('focus/darwin.js runs without crash (with terminal PID)', () => {
    if (!terminalPid) {
      // No PID detected (headless environment) — just test the script loads
      const r = spawnSync(
        process.execPath,
        ['-e', `require('${path.join(SRC, 'focus/darwin.js')}')`],
        { encoding: 'utf8', timeout: 5000 }
      );
      assert.ok(r.error === undefined, `Module load error: ${r.error}`);
      return;
    }
    const r = spawnSync(
      process.execPath,
      [path.join(SRC, 'focus/darwin.js'), terminalPid],
      { encoding: 'utf8', timeout: 8000 }
    );
    assert.ok(r.error === undefined, `Spawn error: ${r.error}`);
    assert.strictEqual(r.status, 0, `Non-zero exit: ${r.status}\n${r.stderr}`);
  });

  test('claude_focus wrapper runs focus/darwin.js without crash', () => {
    const wrapperFile = findWrapperFile();
    if (!wrapperFile || !fs.existsSync(wrapperFile)) {
      throw new Error('wrapper not present — Layer 1 must have failed');
    }
    const r = spawnSync('bash', [wrapperFile], { encoding: 'utf8', timeout: 10000 });
    assert.ok(r.error === undefined, `Spawn error: ${r.error}`);
    assert.strictEqual(r.status, 0, `Non-zero exit: ${r.status}\n${r.stderr}`);
  });
}

// ── Layer 3: click-to-focus simulation (interactive) ─────────────────────────
console.log('\nLayer 3 — click-to-focus simulation (interactive)');

test('terminal-notifier fires -execute when notification is clicked', () => {
  if (process.platform !== 'darwin') return 'SKIP';
  if (SKIP_INTERACTIVE) return 'SKIP';

  const hasTN = exec('which terminal-notifier') !== '';
  if (!hasTN) {
    console.log('    (terminal-notifier not found — install with: brew install terminal-notifier)');
    return 'SKIP';
  }

  const markerFile  = path.join(os.tmpdir(), 'claude_ping_e2e_marker');
  const clickScript = path.join(os.tmpdir(), 'claude_ping_e2e_click.sh');

  try { fs.unlinkSync(markerFile); } catch {}

  // Minimal script: write timestamp to marker on click
  fs.writeFileSync(clickScript, `#!/bin/bash\ndate +%s > "${markerFile}"\n`);
  fs.chmodSync(clickScript, 0o755);

  // Send a real notification; -ignoreDnD keeps it as an alert so the click registers
  exec(
    `terminal-notifier -message "Click me to pass E2E test" ` +
    `-title "claude-ping E2E" -sound Basso -ignoreDnD -execute "${clickScript}"`
  );

  console.log('    >>> A notification just appeared.  Click it now (waiting 30 s)...');

  // Wait up to 30 s for the marker file; use Atomics.wait as a sleep to avoid
  // spawning a Node.js process per iteration. fs.watchFile can't be used here
  // because Atomics.wait blocks the event loop, preventing its callbacks from firing.
  const deadline = Date.now() + 30_000;
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  let clicked = false;
  while (!clicked && Date.now() < deadline) {
    Atomics.wait(int32, 0, 0, 200);
    clicked = fs.existsSync(markerFile);
  }

  if (!clicked) {
    console.log('    (timed out waiting for click — marking as skip, not fail)');
    return 'SKIP';
  }

  const ts = fs.readFileSync(markerFile, 'utf8').trim();
  assert.ok(/^\d+$/.test(ts), `Unexpected marker content: ${ts}`);
  console.log(`    Click registered at unix time ${ts}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passed + failed + skipped;
console.log(`\n${total} tests: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
if (failed > 0) process.exit(1);
