#!/usr/bin/env node
'use strict';
// SessionStart hook: eagerly saves the terminal PID for this session.
// This backs up the PID so focus.js works even if notify.js can't walk
// the process tree later (e.g. after Claude forks into a subshell).

const fs = require('fs');
const path = require('path');
const os = require('os');

const { findTerminalPid } = require('./pid');

const { terminalPid } = findTerminalPid();
if (terminalPid) {
  fs.writeFileSync(path.join(os.tmpdir(), 'claude_terminal_pid'), String(terminalPid));
}
