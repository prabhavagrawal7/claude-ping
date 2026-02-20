'use strict';
// Cross-platform process tree utilities.
// Walks the PPID chain to find the nearest GUI ancestor (the terminal/IDE).

const { execSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function getParentPid(pid) {
  if (process.platform === 'win32') {
    const out = exec(
      `powershell -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').ParentProcessId"`
    );
    return parseInt(out) || null;
  }
  const out = exec(`ps -p ${pid} -o ppid=`);
  return parseInt(out) || null;
}

function getProcessPath(pid) {
  if (process.platform === 'win32') {
    return exec(
      `powershell -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path"`
    );
  }
  return exec(`ps -p ${pid} -o comm=`);
}

function isGuiApp(pid, processPath) {
  switch (process.platform) {
    case 'darwin':
      // Every macOS GUI app runs from *.app/Contents/MacOS/*
      return processPath.includes('.app/Contents/MacOS/');

    case 'linux':
      // Check if process has DISPLAY or WAYLAND_DISPLAY (it's a GUI app)
      try {
        const environ = require('fs').readFileSync(`/proc/${pid}/environ`, 'latin1');
        return environ.includes('DISPLAY=') || environ.includes('WAYLAND_DISPLAY=');
      } catch {
        return false;
      }

    case 'win32':
      // Check if process has a visible main window (non-zero MainWindowHandle)
      const out = exec(
        `powershell -Command "$p = Get-Process -Id ${pid} -EA SilentlyContinue; if ($p -and $p.MainWindowHandle -ne 0) { 'yes' }"`
      );
      return out === 'yes';

    default:
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
  let pid = process.ppid;
  for (let i = 0; i < 20; i++) {
    const ppid = getParentPid(pid);
    if (!ppid || ppid <= 1) break;
    const parentPath = getProcessPath(ppid);
    if (isGuiApp(ppid, parentPath)) {
      return { sessionPid: pid, terminalPid: ppid };
    }
    pid = ppid;
  }
  return { sessionPid: null, terminalPid: null };
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
