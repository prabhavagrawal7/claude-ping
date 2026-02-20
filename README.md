# claude-ping

A Claude Code plugin that sends a desktop notification when Claude needs your attention — and when you click it, **focuses the exact terminal window or IDE pane** where Claude is waiting.

## Features

- Notification shows Claude's **actual question**, not a generic "needs attention" message
- Clicking the notification **brings the terminal to front** — works with any terminal or IDE
- A **bell** highlights the tab even before you click
- **Cross-platform**: macOS, Linux, and Windows

## How it works

1. **`SessionStart` hook** — saves the terminal app's PID when Claude starts
2. **`Stop` / `Notification` hooks** — reads Claude's last message from stdin JSON, rings the TTY bell, and sends a notification
3. **On click** — `focus.js` reads the saved PID and raises that window using platform-native APIs

The terminal is detected by walking up the `PPID` chain until a GUI app process is found — no hardcoded terminal names, works universally with any app.

## Platform support

| Platform | Notification | Focus |
|---|---|---|
| macOS | `terminal-notifier` | `osascript` / System Events |
| Linux | `dunstify` (with click) or `notify-send` | `xdotool` or `wmctrl` |
| Windows | BurntToast (PowerShell) | `SetForegroundWindow` WinAPI |

### Terminal compatibility (macOS, tested)

| App | Notification | Focus |
|---|---|---|
| Ghostty | ✅ | ✅ |
| Zed | ✅ | ✅ |
| VS Code (integrated terminal) | ✅ | ✅ |
| iTerm2 | ✅ | ✅ |
| Terminal.app | ✅ | ✅ |
| WezTerm, Kitty, Alacritty, … | ✅ | ✅ |

## Requirements

No `.zshrc` or shell config changes needed. The plugin inherits your terminal's environment when hooks run, and uses the full path to your Node.js binary for notification clicks — so PATH is never an issue.

### macOS
- Node.js ≥ 18
- [`terminal-notifier`](https://github.com/julienXX/terminal-notifier): `brew install terminal-notifier`
- Accessibility permission for `osascript`:
  System Settings → Privacy & Security → Accessibility → enable for your terminal app

### Linux
- Node.js ≥ 18
- `dunstify` (recommended, for click-to-focus) or `notify-send`
- `xdotool` (recommended) or `wmctrl` for window focus

### Windows
- Node.js ≥ 18
- PowerShell (built-in); BurntToast module is auto-installed on first run

## Installation

### Option A: Via Claude Code plugin marketplace

```
/plugin marketplace add prabhavagrawal7/claude-ping
/plugin install claude-ping@prabhavagrawal7
```

### Option B: Manual (dev / personal use)

```bash
git clone https://github.com/prabhavagrawal7/claude-ping
claude --plugin-dir ./claude-ping
```

## Project structure

```
claude-ping/
├── .claude-plugin/
│   └── marketplace.json     # marketplace catalog
├── plugin/                  # the installable plugin
│   ├── .claude-plugin/
│   │   └── plugin.json      # plugin metadata
│   ├── hooks/
│   │   └── hooks.json       # SessionStart, SessionEnd, Stop, Notification hooks
│   └── src/
│       ├── notify.js        # Stop/Notification hook: parses message, finds PID, notifies
│       ├── focus.js         # Notification click handler: focuses the terminal window
│       ├── session-start.js # SessionStart hook: saves terminal PID
│       ├── session-end.js   # SessionEnd hook: cleans up
│       ├── pid.js           # Cross-platform process tree walker
│       └── platform/
│           ├── darwin.js    # macOS: terminal-notifier + osascript
│           ├── linux.js     # Linux: dunstify/notify-send + xdotool/wmctrl
│           └── win32.js     # Windows: BurntToast + SetForegroundWindow
└── README.md
```

## How the PID trick works

Every macOS GUI app runs from `*.app/Contents/MacOS/*`. When a hook fires, `pid.js` walks up the `PPID` chain:

```
hook fires (subprocess of Claude)
  → node → zsh → login → /Applications/Ghostty.app/Contents/MacOS/ghostty
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                          detected as GUI app → saved as terminalPid
```

On Linux it checks `/proc/$pid/environ` for `DISPLAY=` or `WAYLAND_DISPLAY=`.
On Windows it checks `MainWindowHandle != 0` via PowerShell.

When you click the notification, `focus.js` reads the saved PID and calls the platform's focus function — no guessing, no hardcoded app names.
