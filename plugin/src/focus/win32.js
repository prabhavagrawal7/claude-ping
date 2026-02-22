#!/usr/bin/env node
'use strict';
// Windows focus entry point — launched by the claude-ping: protocol handler
// when the toast notification is clicked.
// argv[2] = "claude-ping:focus?pid=<N>"

const platform = require('../platform/win32');

function parsePidFromUri(uri) {
  const m = /[?&]pid=(\d+)/.exec(uri);
  return m ? parseInt(m[1], 10) : null;
}

function main() {
  const arg = process.argv[2] || '';
  if (!arg.startsWith('claude-ping:')) return;
  const terminalPid = parsePidFromUri(arg);
  if (terminalPid) platform.focus(terminalPid);
}

main();
