#!/bin/bash
# Called when user clicks the terminal-notifier notification.
# Uses the saved terminal process PID to focus it — works for any terminal app.

TERMINAL_PID=$(cat "/tmp/claude_terminal_pid" 2>/dev/null | tr -d '\n')

if [ -n "$TERMINAL_PID" ]; then
    osascript -e "
    tell application \"System Events\"
        set termProc to first process whose unix id is $TERMINAL_PID
        set frontmost of termProc to true
    end tell
    "
    exit 0
fi

# Fallback: try common terminal apps
for app in Ghostty iTerm2 Terminal WezTerm kitty; do
    osascript -e "tell application \"$app\" to activate" 2>/dev/null && exit 0
done
