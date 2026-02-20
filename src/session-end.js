#!/usr/bin/env node
'use strict';
// SessionEnd hook: cleans up the saved terminal PID file.

const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  fs.unlinkSync(path.join(os.tmpdir(), 'claude_terminal_pid'));
} catch {}
