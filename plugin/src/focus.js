#!/usr/bin/env node
'use strict';
// Called when the desktop notification is clicked.
// Reads the saved terminal PID and brings that window to the front.

const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = require('./platform/' + process.platform);

/**
 * Extract a PID from a claude-ping: protocol URI.
 * e.g. "claude-ping:focus?pid=12345" → 12345
 * @param {string} uri
 * @returns {number|null}
 */
function parsePidFromUri(uri) {
  const m = /[?&]pid=(\d+)/.exec(uri);
  return m ? parseInt(m[1], 10) : null;
}

function main() {
  let terminalPid = null;

  // Windows click path: protocol URI passed as argv[2]
  const arg = process.argv[2] || '';
  if (arg.startsWith('claude-ping:')) {
    terminalPid = parsePidFromUri(arg);
  }

  // macOS / Linux path: read PID from temp file
  if (!terminalPid) {
    const pidFile = path.join(os.tmpdir(), 'claude_terminal_pid');
    try {
      terminalPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    } catch {}
  }

  if (terminalPid && !isNaN(terminalPid)) {
    platform.focus(terminalPid);
  }
}

// Export for testing
module.exports = { parsePidFromUri };

main();
