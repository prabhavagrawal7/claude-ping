#!/usr/bin/env node
'use strict';
// Entry point for Stop and Notification hooks.
// Reads Claude's message from stdin JSON, finds the terminal PID,
// rings the bell on the active TTY, and sends a desktop notification.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { findTerminalPid, getTtyDevice } = require('./pid');
const platform = require('./platform/' + process.platform);

function readStdin() {
  try {
    // fd 0 works cross-platform (Windows doesn't have /dev/stdin)
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const raw = readStdin();
  let hookData = {};
  try { hookData = JSON.parse(raw); } catch {}

  // Extract the message from whichever hook fired
  let text = '';
  if (hookData.hook_event_name === 'Stop') {
    text = hookData.last_assistant_message || '';
  } else {
    text = hookData.message || '';
  }

  const message = text.length > 100
    ? text.slice(0, 100) + '…'
    : (text || 'Claude needs your attention');

  // Walk the process tree to find the host terminal
  const { sessionPid, terminalPid } = findTerminalPid();

  // Persist the terminal PID so focus.js can read it on notification click
  if (terminalPid) {
    fs.writeFileSync(path.join(os.tmpdir(), 'claude_terminal_pid'), String(terminalPid));
  }

  // Ring the bell to highlight the tab before the notification arrives
  if (sessionPid) {
    const tty = getTtyDevice(sessionPid);
    if (tty) platform.ringBell(tty);
  }

  // Send the notification; clicking it will run focus.js
  const focusScript = path.join(__dirname, 'focus.js');
  platform.notify(message, focusScript);
}

main();
