#!/usr/bin/env node
'use strict';
// Linux focus entry point — invoked on notification action click (dunstify)
// or directly. Reads terminal PID from temp file and focuses via xdotool/wmctrl.

const fs = require('fs');
const path = require('path');
const os = require('os');
const platform = require('../platform/linux');

function main() {
  let pid = parseInt(process.argv[2] || '', 10) || null;

  if (!pid) {
    try {
      pid = parseInt(fs.readFileSync(path.join(os.tmpdir(), 'claude_terminal_pid'), 'utf8').trim(), 10) || null;
    } catch {}
  }

  if (pid) platform.focus(pid);
}

main();
