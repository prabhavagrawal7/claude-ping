# claude-focus

A Claude Code plugin that sends a macOS notification when Claude needs your attention — and when you click it, **focuses the exact terminal window** where Claude is waiting.

## Demo

- Notification shows Claude's **actual question**, not a generic "needs attention" message
- Clicking the notification **brings the terminal to front** — works with any macOS terminal or IDE
- A **bell** highlights the tab even before you click

## How it works

1. **`SessionStart` hook** — saves the terminal app's PID when Claude starts
2. **`Stop` / `Notification` hooks** — reads Claude's last message from stdin, sends a macOS notification via `terminal-notifier`
3. **On click** — uses `System Events` to focus the terminal by its PID

The terminal is detected by walking up the process tree until a macOS `.app/Contents/MacOS/` process is found — no hardcoded terminal names, works universally.

## Compatibility

Works with **any macOS terminal or IDE** (tested: Ghostty, Zed, VS Code):

| App | Works |
|---|---|
| Ghostty | ✅ |
| Zed | ✅ |
| VS Code (integrated terminal) | ✅ |
| iTerm2 | ✅ |
| Terminal.app | ✅ |
| WezTerm, Kitty, Alacritty, … | ✅ |

## Requirements

- macOS
- [`terminal-notifier`](https://github.com/julienXX/terminal-notifier): `brew install terminal-notifier`
- `jq`: `brew install jq`
- macOS Accessibility permission for `osascript`:
  System Settings → Privacy & Security → Accessibility → enable for your terminal

## Installation

### Option A: Load directly (dev / personal use)

```bash
git clone https://github.com/prabhavagrawal/claude-focus
claude --plugin-dir ./claude-focus
```

### Option B: Install permanently

```
/plugin install /path/to/claude-focus
```

## Plugin structure

```
claude-focus/
├── .claude-plugin/
│   └── plugin.json          # plugin metadata
├── hooks/
│   └── hooks.json           # SessionStart, SessionEnd, Stop, Notification hooks
├── scripts/
│   ├── session_start.sh     # saves terminal PID at session start
│   ├── session_end.sh       # cleans up on session end
│   ├── notify.sh            # parses Claude's message, sends notification
│   └── focus_window.sh      # focuses the terminal on notification click
└── README.md
```

## How the PID trick works

Every macOS GUI app runs from `*.app/Contents/MacOS/*`. When a hook fires, the script walks up the `PPID` chain:

```
notification click
    → focus_window.sh
        → osascript: set frontmost of (process whose unix id is <PID>) to true

hook fires (Stop/Notification)
    → notify.sh walks: hook → zsh → claude → login → /Applications/App.app/Contents/MacOS/...
                                                       ^^^^^^^^^^^^ saved as TERMINAL_PID
```

No terminal name guessing. No hardcoded lists.
