'use strict';
// Cross-platform process tree utilities.
// Walks the PPID chain to find the nearest GUI ancestor (the terminal/IDE).

const { execSync, spawnSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Windows: walk the entire PPID chain in a single PowerShell call.
 * Spawning powershell.exe per-iteration costs ~1 s each; one call is fast.
 */
function findTerminalPidWin32() {
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile', '-NonInteractive', '-Command',
      `
      $cur = ${process.ppid}
      for ($i = 0; $i -lt 20; $i++) {
        $row = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue
        if (-not $row) { break }
        $parentId = $row.ParentProcessId
        if (-not $parentId -or $parentId -le 1) { break }
        $proc = Get-Process -Id $parentId -ErrorAction SilentlyContinue
        if ($proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
          Write-Output "$cur $parentId"
          exit
        }
        $cur = $parentId
      }
      `,
    ],
    { encoding: 'utf8', timeout: 15000 }
  );

  const line = ((result.stdout || '').trim().split('\n')[0] || '').trim();
  if (line) {
    const parts = line.split(/\s+/);
    const sessionPid = parseInt(parts[0], 10) || null;
    const terminalPid = parseInt(parts[1], 10) || null;
    return { sessionPid, terminalPid };
  }
  return { sessionPid: null, terminalPid: null };
}

/**
 * Unix: walk PPID chain with ps(1), detect GUI app by platform heuristic.
 */
function findTerminalPidUnix() {
  let pid = process.ppid;
  for (let i = 0; i < 20; i++) {
    const ppidRaw = exec(`ps -p ${pid} -o ppid=`);
    const ppid = parseInt(ppidRaw, 10);
    if (!ppid || ppid <= 1) break;

    const parentPath = exec(`ps -p ${ppid} -o comm=`);

    if (isGuiAppUnix(ppid, parentPath)) {
      return { sessionPid: pid, terminalPid: ppid };
    }
    pid = ppid;
  }
  return { sessionPid: null, terminalPid: null };
}

function isGuiAppUnix(pid, processPath) {
  if (process.platform === 'darwin') {
    return processPath.includes('.app/Contents/MacOS/');
  }
  // Linux: process has a display server connection
  try {
    const environ = require('fs').readFileSync(`/proc/${pid}/environ`, 'latin1');
    return environ.includes('DISPLAY=') || environ.includes('WAYLAND_DISPLAY=');
  } catch {
    return false;
  }
}

/**
 * Walk the PPID chain from the current process upward.
 * Returns { sessionPid, terminalPid } where:
 *   terminalPid = the terminal/IDE app process
 *   sessionPid  = its direct child (unique per tab/pane)
 */
function findTerminalPid() {
  if (process.platform === 'win32') return findTerminalPidWin32();
  return findTerminalPidUnix();
}

/**
 * Get the TTY device path for a given PID (Unix only).
 * Returns e.g. "/dev/ttys001" or null.
 */
function getTtyDevice(pid) {
  if (process.platform === 'win32') return null;
  const ttyName = exec(`ps -p ${pid} -o tty=`);
  if (!ttyName || ttyName === '??') return null;
  return `/dev/${ttyName}`;
}

module.exports = { findTerminalPid, getTtyDevice };
