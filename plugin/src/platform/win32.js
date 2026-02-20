'use strict';
// Windows platform implementation.
// Notification: WinRT toast via PowerShell (no external modules needed)
// Focus: SetForegroundWindow + AttachThreadInput trick

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function ps(script, timeout = 12000) {
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', timeout }
  );
  return (result.stdout || '').trim();
}

/**
 * Send a native Windows toast notification via WinRT (PowerShell).
 * No external modules (BurntToast etc.) required.
 *
 * Windows security prevents running code on toast click without a registered
 * COM activator, so we attempt to focus the terminal immediately when the
 * notification fires instead.
 *
 * @param {string} message
 */
// focusScriptPath is unused on Windows — focus is handled synchronously above.
function notify(message, _focusScriptPath) {
  // Sanitise for XML and for PowerShell single-quoted string
  const xmlSafe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const psSafe = xmlSafe.replace(/'/g, "''");

  // WinRT toast — works on Windows 10/11 without any extra installs.
  // Uses PowerShell's own AUMID so Windows always recognises the notifier.
  ps(`
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $xml = '<toast><visual><binding template="ToastGeneric"><text>Claude Code</text><text>${psSafe}</text></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>'
    $doc = [Windows.Data.Xml.Dom.XmlDocument]::new()
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    $aumid = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($aumid).Show($toast)
  `);

  // Attempt to focus the terminal immediately.
  try {
    const pidFile = path.join(os.tmpdir(), 'claude_terminal_pid');
    const terminalPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    if (terminalPid && !isNaN(terminalPid)) focus(terminalPid);
  } catch {}
}

/**
 * Ring the bell — no-op on Windows (handled by notification sound).
 */
function ringBell(_ttyDevice) {}

/**
 * Focus terminal by PID.
 * Uses AttachThreadInput so SetForegroundWindow succeeds from a background process.
 * @param {number} terminalPid
 */
function focus(terminalPid) {
  // Build the C# type definition as a plain string to avoid PowerShell
  // here-string indentation constraints in embedded scripts.
  const cs = [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class WinFocus {',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);',
    '  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();',
    '  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);',
    '}',
  ].join('\n').replace(/'/g, "''"); // escape for PS single-quoted string

  ps(`
    if (-not ([System.Management.Automation.PSTypeName]'WinFocus').Type) {
      Add-Type -TypeDefinition '${cs}'
    }
    $proc = Get-Process -Id ${terminalPid} -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
      $hwnd = $proc.MainWindowHandle
      $fgHwnd = [WinFocus]::GetForegroundWindow()
      $fgTid = [uint32]0
      [WinFocus]::GetWindowThreadProcessId($fgHwnd, [ref]$fgTid) | Out-Null
      $myTid = [WinFocus]::GetCurrentThreadId()
      [WinFocus]::AttachThreadInput($myTid, $fgTid, $true)  | Out-Null
      [WinFocus]::ShowWindow($hwnd, 9)                       | Out-Null
      [WinFocus]::SetForegroundWindow($hwnd)                 | Out-Null
      [WinFocus]::AttachThreadInput($myTid, $fgTid, $false) | Out-Null
    }
  `);
}

module.exports = { notify, ringBell, focus };
