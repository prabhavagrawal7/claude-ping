#!/bin/bash
# Claude Code SessionStart hook
# Saves the Ghostty window name AND the x-position of the focused split pane.

SESSION_PID=""
pid=$PPID
for _ in $(seq 1 15); do
    ppid=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
    [ -z "$ppid" ] || [ "$ppid" = "1" ] || [ "$ppid" = "0" ] && break
    parent_path=$(ps -p "$ppid" -o comm= 2>/dev/null)
    if [[ "$parent_path" == *".app/Contents/MacOS/"* ]]; then
        SESSION_PID=$pid
        break
    fi
    pid=$ppid
done

[ -z "$SESSION_PID" ] && exit 0

INFO=$(osascript << 'APPLESCRIPT'
tell application "System Events"
    tell process "Ghostty"
        tell window 1
            set winName to name of window 1 of process "Ghostty" of application "System Events"
            set allItems to entire contents
            repeat with el in allItems
                try
                    if role of el is "AXTextArea" and focused of el is true then
                        set paneX to item 1 of (position of el)
                        return winName & "|" & paneX
                    end if
                end try
            end repeat
            return winName & "|"
        end tell
    end tell
end tell
APPLESCRIPT
)

WINDOW_NAME=$(printf '%s' "$INFO" | cut -d'|' -f1)
PANE_X=$(printf '%s' "$INFO" | cut -d'|' -f2)

if [ -n "$WINDOW_NAME" ]; then
    mkdir -p "$HOME/.claude/sessions"
    printf '%s' "$WINDOW_NAME" > "$HOME/.claude/sessions/${SESSION_PID}.window"
    [ -n "$PANE_X" ] && printf '%s' "$PANE_X" > "$HOME/.claude/sessions/${SESSION_PID}.pane"
fi

exit 0
