#!/bin/bash
# Write the update manifest for a release from the packages in a directory.
#
#   scripts/make-manifest.sh <version> <dir-with-packages> [channel] [rollout]
#
# The manifest is what installations poll (see docs/design/actualizaciones.md):
# one file per channel, static, served from the release's assets. rollout is
# the percentage of installations that should take this version; lower it in
# a later edit of the asset to stop a bad release from spreading.
set -euo pipefail
VERSION=$1; DIR=$2; CHANNEL=${3:-stable}; ROLLOUT=${4:-100}
REPO=${MUXTERM_REPO:-tecnologicachile/muxterm}
BASE="https://github.com/$REPO/releases/download/v$VERSION"
NODE_MAJOR=""
assets=""
for f in "$DIR"/muxterm-"$VERSION"-linux-*.tar.gz; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  arch=${name#muxterm-$VERSION-}; arch=${arch%.tar.gz}
  sha=$(cut -d' ' -f1 "$f.sha256")
  [ -z "$NODE_MAJOR" ] && NODE_MAJOR=$(tar -xzOf "$f" muxterm/RELEASE.json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).node")
  assets="$assets    \"$arch\": { \"url\": \"$BASE/$name\", \"sha256\": \"$sha\", \"sig\": \"$BASE/$name.sig\" },\n"
done
[ -n "$assets" ] || { echo "no packages in $DIR" >&2; exit 1; }
assets=$(printf "%b" "$assets" | sed '$ s/,$//')
cat > "$DIR/$CHANNEL.json" <<EOF
{
  "channel": "$CHANNEL",
  "version": "$VERSION",
  "published": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "node": "$NODE_MAJOR",
  "minVersion": "1.1.50",
  "rollout": $ROLLOUT,
  "notes": "https://github.com/$REPO/releases/tag/v$VERSION",
  "assets": {
$assets
  }
}
EOF
echo "$DIR/$CHANNEL.json"
