'use strict';
// macOS platform implementation.
// Notification: terminal-notifier  |  Focus: open -a <AppName> via wrapper script

const { execSync } = require('child_process');
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
 * Send a macOS notification via terminal-notifier.
 *
 * Two fixes vs the old implementation:
 *  1. -ignoreDnD  — sends as a persistent alert; banner-style notifications
 *     dismiss before the user can click, so -execute never fires.
 *  2. Wrapper script  — terminal-notifier -execute only works reliably with a
 *     simple executable path, not a compound shell command like '"node" "file"'.
 *     We write a tiny #!/bin/bash wrapper that embeds the node path + args.
 *
 * @param {string} message
 * @param {number|null} terminalPid
 * @param {string|null} appName - e.g. "Ghostty", passed to focus/darwin.js
 */
function notify(message, terminalPid, appName) {
  const safeMsg = message.replace(/"/g, '\\"');
  const nodeBin = process.execPath;
  const focusScript = path.join(__dirname, '../focus/darwin.js');

  // Build args line: pid and appName are optional but improve focus reliability
  const pidArg  = terminalPid ? ` "${terminalPid}"` : '';
  const appArg  = appName     ? ` "${appName}"`     : '';

  // Write a minimal shell wrapper — terminal-notifier -execute runs it directly
  const wrapperPath = path.join(
    os.tmpdir(),
    `claude_focus_${process.pid}_${Date.now()}.sh`
  );
  fs.writeFileSync(
    wrapperPath,
    `#!/bin/bash\nexec "${nodeBin}" "${focusScript}"${pidArg}${appArg}\n`
  );
  fs.chmodSync(wrapperPath, 0o755);

  exec(
    `terminal-notifier -message "${safeMsg}" -title "Claude Code" -sound Basso -ignoreDnD -execute "${wrapperPath}"`
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
 * Focus the terminal process by PID.
 * Used as a fallback when focus/darwin.js cannot determine the app name.
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
