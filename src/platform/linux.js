'use strict';
// Linux platform implementation.
// Notification: notify-send  |  Focus: xdotool / wmctrl

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Send a Linux desktop notification via notify-send.
 * On click, focus is handled by a background watcher written to a signal file.
 * @param {string} message
 * @param {string} focusScriptPath
 */
function notify(message, focusScriptPath) {
  const safeMsg = message.replace(/"/g, '\\"');
  const nodeBin = process.execPath;

  // notify-send doesn't support on-click execution natively.
  // Use dunstify if available (supports --action), otherwise notify-send.
  const hasDunst = exec('which dunstify') !== '';
  if (hasDunst) {
    // dunstify supports action callbacks
    spawnSync('bash', [
      '-c',
      `result=$(dunstify -A "focus,Go to Claude" "Claude Code" "${safeMsg}"); ` +
        `if [ "$result" = "focus" ]; then "${nodeBin}" "${focusScriptPath}"; fi`,
    ], { detached: true, stdio: 'ignore' });
  } else {
    // Basic notify-send — no click action, just the notification
    exec(`notify-send "Claude Code" "${safeMsg}" --icon=terminal`);
    // Still write the PID file so focus.js works if invoked manually
  }
}

/**
 * Ring the terminal bell on the given TTY device.
 * @param {string} ttyDevice
 */
function ringBell(ttyDevice) {
  try {
    fs.writeFileSync(ttyDevice, '\x07');
  } catch {}
}

/**
 * Focus terminal by PID using xdotool (preferred) or wmctrl.
 * @param {number} terminalPid
 */
function focus(terminalPid) {
  const hasXdotool = exec('which xdotool') !== '';
  if (hasXdotool) {
    const windowId = exec(`xdotool search --pid ${terminalPid} | head -1`);
    if (windowId) {
      exec(`xdotool windowactivate --sync ${windowId}`);
      return;
    }
  }
  // Fallback: wmctrl
  const hasWmctrl = exec('which wmctrl') !== '';
  if (hasWmctrl) {
    exec(`wmctrl -ia $(wmctrl -lp | awk '/\\b${terminalPid}\\b/{print $1}' | head -1)`);
  }
}

module.exports = { notify, ringBell, focus };
