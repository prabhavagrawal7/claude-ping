'use strict';
// macOS platform implementation.
// Notification: terminal-notifier  |  Focus: osascript + System Events

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Send a macOS notification via terminal-notifier.
 * @param {string} message
 * @param {string} focusScriptPath - absolute path to focus.js
 */
function notify(message, focusScriptPath) {
  // Escape double quotes in the message
  const safeMsg = message.replace(/"/g, '\\"');
  const nodeBin = process.execPath;
  const execute = `"${nodeBin}" "${focusScriptPath}"`;
  exec(
    `terminal-notifier -message "${safeMsg}" -title "Claude Code" -sound Basso -execute '${execute}'`
  );
}

/**
 * Ring the terminal bell on the given TTY device to highlight the tab.
 * @param {string} ttyDevice - e.g. "/dev/ttys001"
 */
function ringBell(ttyDevice) {
  try {
    fs.writeFileSync(ttyDevice, '\x07');
  } catch {
    // Ignore — not writable
  }
}

/**
 * Focus the terminal process by PID using System Events.
 * @param {number} terminalPid
 */
function focus(terminalPid) {
  exec(`osascript -e "
    tell application \\"System Events\\"
      set termProc to first process whose unix id is ${terminalPid}
      set frontmost of termProc to true
    end tell
  "`);
}

module.exports = { notify, ringBell, focus };
