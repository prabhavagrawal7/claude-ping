'use strict';
// Windows platform implementation.
// Notification: BurntToast (PowerShell)  |  Focus: SetForegroundWindow (WinAPI)

const { execSync, spawnSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function ps(script) {
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  });
  return (result.stdout || '').trim();
}

/**
 * Send a Windows toast notification via BurntToast.
 * On click, runs focus.js via Node.
 * Requires: Install-Module BurntToast (auto-installs if missing)
 * @param {string} message
 * @param {string} focusScriptPath
 */
function notify(message, focusScriptPath) {
  const safeMsg = message.replace(/'/g, "''");
  const nodeBin = process.execPath.replace(/\\/g, '\\\\');
  const safeFocus = focusScriptPath.replace(/\\/g, '\\\\');

  ps(`
    if (-not (Get-Module -ListAvailable BurntToast)) {
      Install-Module BurntToast -Scope CurrentUser -Force -ErrorAction SilentlyContinue
    }
    Import-Module BurntToast -ErrorAction SilentlyContinue
    $onClick = { Start-Process '${nodeBin}' -ArgumentList '"${safeFocus}"' -WindowStyle Hidden }
    New-BurntToastNotification -Text 'Claude Code', '${safeMsg}' -ActivatedAction $onClick
  `);
}

/**
 * Ring the bell — no-op on Windows (handled by notification sound).
 */
function ringBell(_ttyDevice) {}

/**
 * Focus terminal by PID using SetForegroundWindow WinAPI.
 * @param {number} terminalPid
 */
function focus(terminalPid) {
  ps(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    $proc = Get-Process -Id ${terminalPid} -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne 0) {
      [Win32]::ShowWindow($proc.MainWindowHandle, 9)   # SW_RESTORE
      [Win32]::SetForegroundWindow($proc.MainWindowHandle)
    }
  `);
}

module.exports = { notify, ringBell, focus };
