#!/bin/bash
# Claude Code notification script.
# 1. Reads hook JSON from stdin to extract Claude's actual last message
# 2. Walks the PID tree to find the terminal process
# 3. Sends a terminal bell to highlight the tab
# 4. Sends a macOS notification (showing the question) that, on click,
#    focuses the terminal via its process ID — works for any terminal app.

SOUND="${1:-Basso}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOCUS_SCRIPT="$SCRIPT_DIR/focus_window.sh"

# ── Parse the question/message from hook JSON (stdin) ────────────────────────
HOOK_INPUT=$(cat)
HOOK_EVENT=$(printf '%s' "$HOOK_INPUT" | jq -r '.hook_event_name // ""')

if [ "$HOOK_EVENT" = "Stop" ]; then
    RAW=$(printf '%s' "$HOOK_INPUT" | jq -r '.last_assistant_message // ""')
else
    RAW=$(printf '%s' "$HOOK_INPUT" | jq -r '.message // ""')
fi

if [ -n "$RAW" ]; then
    MESSAGE="${RAW:0:100}"
    [ "${#RAW}" -gt 100 ] && MESSAGE="${MESSAGE}…"
else
    MESSAGE="Claude needs your attention"
fi

# ── Walk PID tree: find the nearest macOS .app ancestor ──────────────────────
# Any GUI app on macOS runs from *.app/Contents/MacOS/* — this catches
# Ghostty, iTerm2, VS Code (Electron), WezTerm, Terminal.app, etc.

SESSION_PID=""   # direct child of the terminal app (unique per tab/pane)
TERMINAL_PID=""  # the terminal / IDE app itself

pid=$PPID
for _ in $(seq 1 20); do
    ppid=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
    [ -z "$ppid" ] || [ "$ppid" = "1" ] || [ "$ppid" = "0" ] && break
    parent_path=$(ps -p "$ppid" -o comm= 2>/dev/null)
    if [[ "$parent_path" == *".app/Contents/MacOS/"* ]]; then
        SESSION_PID=$pid
        TERMINAL_PID=$ppid
        break
    fi
    pid=$ppid
done

# ── Bell to highlight the tab ─────────────────────────────────────────────────
if [ -n "$SESSION_PID" ]; then
    TTY_NAME=$(ps -p "$SESSION_PID" -o tty= 2>/dev/null | tr -d ' ')
    TTY_DEV="/dev/$TTY_NAME"
    [ -w "$TTY_DEV" ] && printf '\a' > "$TTY_DEV"
fi

# ── Save terminal PID for focus_window.sh ────────────────────────────────────
printf '%s' "$TERMINAL_PID" > /tmp/claude_terminal_pid

# ── Send macOS notification ───────────────────────────────────────────────────
terminal-notifier \
    -message "$MESSAGE" \
    -title "Claude Code" \
    -sound "$SOUND" \
    -execute "$FOCUS_SCRIPT"
