#!/usr/bin/env node
'use strict';
// macOS focus entry point — invoked by the wrapper shell script when the
// desktop notification is clicked.
// argv[2] = terminalPid, argv[3] = appName  (both optional, fall back to temp file)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function main() {
  // Primary: args embedded by darwin.notify() into the wrapper script
  let pid = parseInt(process.argv[2] || '', 10) || null;
  let app = process.argv[3] || null;

  // Fallback: temp file written by notify.js / session-start.js
  if (!pid) {
    try {
      pid = parseInt(fs.readFileSync(path.join(os.tmpdir(), 'claude_terminal_pid'), 'utf8').trim(), 10) || null;
    } catch {}
  }

  if (!pid) return;

  // Prefer open -a <AppName>: no Accessibility permission needed, works from
  // any execution context (including notification daemon).
  if (!app) {
    // Derive app name from live process path if not passed as arg
    const processPath = exec(`ps -p ${pid} -o comm=`);
    const m = processPath.match(/\/([^/]+)\.app\//);
    if (m) app = m[1];
  }

  if (app) {
    exec(`open -a "${app}"`);
    return;
  }

  // Last resort: System Events (requires Accessibility permission)
  exec(`osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true'`);
}

main();
