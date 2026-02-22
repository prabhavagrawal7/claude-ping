'use strict';
// Windows platform implementation.
// Notification: WinRT toast via PowerShell (no external modules needed)
// Focus: SetForegroundWindow + AttachThreadInput trick

const { spawnSync } = require('child_process');

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
 * Registers a `claude-ping:` custom URI protocol in HKCU so that clicking the
 * toast launches `node focus.js "claude-ping:focus?pid=<PID>"`, which brings
 * the correct terminal window to the foreground.
 *
 * @param {string} message
 * @param {number|null} terminalPid  PID of the terminal window to focus on click
 * @param {string|null} appName      Unused on Windows (kept for uniform signature)
 */
function notify(message, terminalPid, appName) {
  const focusScriptPath = require('path').join(__dirname, '../focus/win32.js');
  // Sanitise for XML and for PowerShell single-quoted string
  const xmlSafe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const psSafe = xmlSafe.replace(/'/g, "''");

  // Protocol handler: conhost --headless runs node.exe without a visible
  // console window (available since Windows 10 1903).
  const handlerCmd = `conhost.exe --headless "${process.execPath}" "${focusScriptPath || ''}" "%1"`;
  const handlerCmdPS = handlerCmd.replace(/'/g, "''");

  // Toast attributes: if we have a PID, make clicking the toast launch the
  // claude-ping: protocol URI; otherwise fall back to a plain toast.
  let toastAttrs = '';
  if (terminalPid) {
    toastAttrs = ` activationType="protocol" launch="claude-ping:focus?pid=${terminalPid}"`;
  }

  // Single PowerShell invocation: register protocol handler + send toast.
  ps(`
    # --- Register claude-ping: protocol handler in HKCU (idempotent, no admin) ---
    $protoKey = 'HKCU:\\Software\\Classes\\claude-ping'
    if (-not (Test-Path $protoKey)) { New-Item -Path $protoKey -Force | Out-Null }
    Set-ItemProperty -Path $protoKey -Name '(Default)' -Value 'URL:claude-ping'
    Set-ItemProperty -Path $protoKey -Name 'URL Protocol' -Value ''
    $cmdKey = "$protoKey\\shell\\open\\command"
    if (-not (Test-Path $cmdKey)) { New-Item -Path $cmdKey -Force | Out-Null }
    Set-ItemProperty -Path $cmdKey -Name '(Default)' -Value '${handlerCmdPS}'

    # --- Send WinRT toast notification ---
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $xml = '<toast${toastAttrs}><visual><binding template="ToastGeneric"><text>Claude Code</text><text>${psSafe}</text></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>'
    $doc = [Windows.Data.Xml.Dom.XmlDocument]::new()
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    $aumid = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($aumid).Show($toast)
  `);
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
