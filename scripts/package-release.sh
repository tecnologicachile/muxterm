#!/bin/bash
# Build the release package for this machine's architecture.
#
#   scripts/package-release.sh [version] [outdir]
#
# Produces outdir/muxterm-<version>-linux-<arch>.tar.gz: the server, the built
# client, production node_modules (native modules compiled here, for this
# architecture and this major of Node) and a RELEASE.json that says so.
# Nothing in it needs compiling on the machine that installs it. guacd, ttyd
# and tmux are system packages and stay out.
#
# CI runs this on one runner per architecture; it also works by hand on a
# developer machine (client/dist must exist: `cd client && npm run build`).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(node -p "require('$ROOT/package.json').version")}
OUT=${2:-"$ROOT/dist-release"}
case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")

[ -f "$ROOT/client/dist/index.html" ] || { echo "client/dist is missing: build the client first" >&2; exit 1; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
PKG="$STAGE/muxterm"
mkdir -p "$PKG/client"

# What the server needs at runtime, and nothing else.
cp -r "$ROOT/server" "$ROOT/db" "$ROOT/utils" "$ROOT/scripts" "$ROOT/release" "$PKG/"
cp -r "$ROOT/client/dist" "$PKG/client/dist"
[ -d "$ROOT/public" ] && cp -r "$ROOT/public" "$PKG/public"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/LICENSE" "$ROOT/README.md" "$ROOT/.tmux.webssh.conf" "$PKG/"
# The companion app's APK is served for download when present; its sources are not.
if ls "$ROOT"/android/*.apk >/dev/null 2>&1; then mkdir -p "$PKG/android" && cp "$ROOT"/android/*.apk "$PKG/android/"; fi
[ -f "$ROOT/CHANGELOG.md" ] && cp "$ROOT/CHANGELOG.md" "$PKG/"
rm -rf "$PKG/scripts/__pycache__"

# Production dependencies, compiled here.
( cd "$PKG" && npm ci --omit=dev --no-audit --no-fund --silent )

cat > "$PKG/RELEASE.json" <<EOF
{
  "version": "$VERSION",
  "arch": "linux-$ARCH",
  "node": "$NODE_MAJOR",
  "commit": "$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

mkdir -p "$OUT"
NAME="muxterm-$VERSION-linux-$ARCH.tar.gz"
tar -czf "$OUT/$NAME" -C "$STAGE" muxterm
( cd "$OUT" && sha256sum "$NAME" > "$NAME.sha256" )
echo "$OUT/$NAME ($(du -h "$OUT/$NAME" | cut -f1), node $NODE_MAJOR, $ARCH)"
