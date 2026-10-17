#!/bin/bash
# sync-overlay.sh <pi-agent-desktop-checkout> [overlay-repo-dir]
#
# Refresh this package from a working checkout of pi-agent-desktop, then copy
# everything into the public overlay repo.
#
# Why this exists (2026-10-17). `overlay/` carries full copies of a few upstream
# files, and the install order is: apply `upstream-file-patches.diff`, then copy
# `overlay/` on top. Two failures followed from that, and neither is visible by
# reading the files:
#
#   1. A stale copy in `overlay/` silently overwrites the patched version. Two
#      files had drifted and the published package no longer typechecked.
#   2. A brand-new file never appears in `git diff`, so a component that the
#      diff imports can be missing from the package entirely.
#
# Both are caught by the step that actually matters — apply the package to a
# clean checkout of the recorded baseline and run tsc + tests:
#
#   git worktree add --detach /tmp/verify v0.7.1
#   cd /tmp/verify
#   git apply <repo>/upstream-file-patches.diff
#   cp -R <repo>/overlay/. .
#   npx tsc --noEmit && npm test
#
# Run this script first, so the package you verify is the package that ships.
set -euo pipefail

WT="${1:?usage: sync-overlay.sh <pi-agent-desktop-checkout> [overlay-repo-dir]}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${2:-$HERE}"

[ -d "$WT/.git" ] || { echo "not a git checkout: $WT" >&2; exit 1; }
[ -d "$HERE/overlay" ] || { echo "no overlay/ next to this script" >&2; exit 1; }

echo "== 1) refresh overlay/ from $WT"
find "$HERE/overlay" -type f | while read -r file; do
  rel="${file#"$HERE/overlay/"}"
  if [ -f "$WT/$rel" ]; then
    cp "$WT/$rel" "$HERE/overlay/$rel"
  else
    echo "   !! $rel has no source in the checkout"
  fi
done

echo "== 2) untracked files in the checkout — are they part of the overlay?"
git -C "$WT" status --porcelain | awk '/^\?\?/{print $2}' | while read -r path; do
  [ -e "$HERE/overlay/$path" ] && echo "   in overlay/: $path" || echo "   NOT in overlay/: $path"
done

echo "== 3) regenerate upstream-file-patches.diff"
git -C "$WT" diff > "$HERE/upstream-file-patches.diff"

if [ "$REPO" != "$HERE" ]; then
  echo "== 4) copy into $REPO"
  cp -R "$HERE/overlay/." "$REPO/overlay/"
  cp "$HERE/PATCHES.md" "$HERE/upstream-file-patches.diff" "$REPO/"
fi

echo "== done — now verify against a clean checkout before pushing"
