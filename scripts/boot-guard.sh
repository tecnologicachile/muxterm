#!/bin/sh
# Boot guard for packaged installs: runs before the server (systemd
# ExecStartPre) from the install root, never from a release, so it still
# runs when the release that just got switched in cannot start at all.
#
#   boot-guard.sh <install-home>
#
# The updater leaves <home>/pending while a freshly switched version has not
# yet confirmed health. Each start of that version counts here; the third
# start means it crashed twice, and `current` goes back to the previous
# release. The updater itself handles the other failure (starts, but never
# healthy) from inside the running version.
HOME_DIR=${1:-${MUXTERM_HOME:-/opt/muxterm}}
PENDING="$HOME_DIR/pending"
[ -f "$PENDING" ] || exit 0

version=$(sed -n 's/^version=//p' "$PENDING")
previous=$(sed -n 's/^previous=//p' "$PENDING")
starts=$(sed -n 's/^starts=//p' "$PENDING"); starts=${starts:-0}
current=$(basename "$(readlink "$HOME_DIR/current" 2>/dev/null)")
[ "$current" = "$version" ] || exit 0

starts=$((starts + 1))
if [ "$starts" -le 2 ]; then
  sed -i "s/^starts=.*/starts=$starts/" "$PENDING" 2>/dev/null || printf 'version=%s\nprevious=%s\nstarts=%s\n' "$version" "$previous" "$starts" > "$PENDING"
  exit 0
fi

echo "muxterm boot-guard: $version failed to start $((starts - 1)) times; back to $previous" >&2
if [ -n "$previous" ] && [ -d "$HOME_DIR/releases/$previous" ]; then
  ln -sfn "releases/$previous" "$HOME_DIR/current.new" && mv -Tf "$HOME_DIR/current.new" "$HOME_DIR/current"
fi
printf '%s crashed %s times at start\n' "$version" "$((starts - 1))" >> "$HOME_DIR/failed"
rm -f "$PENDING"
exit 0
