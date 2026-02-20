#!/usr/bin/env node
'use strict';
// Called when the desktop notification is clicked.
// Reads the saved terminal PID and brings that window to the front.

const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = require('./platform/' + process.platform);

function main() {
  const pidFile = path.join(os.tmpdir(), 'claude_terminal_pid');
  let terminalPid = null;
  try {
    terminalPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
  } catch {}

  if (terminalPid && !isNaN(terminalPid)) {
    platform.focus(terminalPid);
  }
}

main();
