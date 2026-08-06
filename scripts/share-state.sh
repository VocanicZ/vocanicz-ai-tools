#!/bin/sh
# share-state.sh — make claude-acc managed accounts share state with ~/.claude.
#
# Symlinks skills/config/plugins/sessions/memory from each account dir to
# ~/.claude so every account sees the same setup; only .credentials.json and
# .claude.json (auth + identity) stay per-account.
#
# Idempotent — safe to re-run. If Claude Code ever replaces a symlinked file
# with a real file (e.g. /config rewriting settings.json), re-run this to
# re-assert the links; the divergent copy is stashed in .pre-share-backup/.
#
# Usage: share-state.sh <account> [<account> ...]

set -eu
SRC="$HOME/.claude"

# dirs + files worth sharing; guarded by existence in ~/.claude
ITEMS="skills agents commands output-styles plugins projects plans agent-memory \
file-history session-env sessions hooks statusbar contextbar \
CLAUDE.md settings.json settings.local.json statusline.sh history.jsonl \
.caveman-active .ponytail-active"

for acc in "$@"; do
    d="$HOME/.claude-switch/accounts/$acc"
    if [ ! -d "$d" ]; then
        echo "skip $acc: $d not found" >&2
        continue
    fi
    bak="$d/.pre-share-backup"
    for item in $ITEMS; do
        [ -e "$SRC/$item" ] || continue
        if [ -L "$d/$item" ] && [ "$(readlink "$d/$item")" = "$SRC/$item" ]; then
            continue
        fi
        if [ -e "$d/$item" ] || [ -L "$d/$item" ]; then
            mkdir -p "$bak"
            mv "$d/$item" "$bak/$item.$(date +%Y%m%d-%H%M%S)"
        fi
        ln -s "$SRC/$item" "$d/$item"
    done
    echo "linked $acc -> ~/.claude shared state"
done
