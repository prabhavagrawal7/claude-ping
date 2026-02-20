#!/bin/bash
# Claude Code SessionEnd hook
# Cleans up the window-mapping file for this session.

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

[ -n "$SESSION_PID" ] && rm -f "$HOME/.claude/sessions/${SESSION_PID}.window" "$HOME/.claude/sessions/${SESSION_PID}.pane"
exit 0
