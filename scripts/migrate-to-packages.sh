#!/bin/bash
# Move an existing MuxTerm checkout to the packaged layout the updater uses.
#
#   sudo scripts/migrate-to-packages.sh [install-home] [manifest-url]
#
# Downloads the latest signed package for this machine into
# <home>/releases/<version>, points <home>/current at it, installs the boot
# guard in <home>/bin and rewrites the systemd unit (same account, same
# port). .env, data/ and certs/ stay where they are: the packaged server
# reads them from <home>. The old checkout files remain beside releases/ until
# you remove them; nothing reads them any more.
set -euo pipefail
HOME_DIR=${1:-/opt/muxterm}
MANIFEST=${2:-${MUXTERM_UPDATE_URL:-https://raw.githubusercontent.com/tecnologicachile/muxterm/channels/stable.json}}
UNIT=/etc/systemd/system/muxterm.service
PUBKEY='release@muxterm ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFuJHaCdZjoUDZm+YcDH45YpvGrEVhtuY1b1LktyjIHx'

[ "$(id -u)" -eq 0 ] || { echo "run as root (rewrites $UNIT)"; exit 1; }
[ -d "$HOME_DIR" ] || { echo "$HOME_DIR does not exist"; exit 1; }
[ -f "$UNIT" ] || { echo "$UNIT not found: nothing to migrate"; exit 1; }
command -v node >/dev/null || { echo "node is required"; exit 1; }

case "$(uname -m)" in x86_64) ARCH=linux-x64;; aarch64|arm64) ARCH=linux-arm64;; *) echo "unsupported arch"; exit 1;; esac
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo "Manifest: $MANIFEST"
curl -fsSL --max-time 30 "$MANIFEST" -o "$TMP/m.json"; curl -fsSL --max-time 30 "$MANIFEST.sig" -o "$TMP/m.json.sig"
SIGNERS="$HOME_DIR/release/allowed_signers"; [ -f "$SIGNERS" ] || { printf '%s\n' "$PUBKEY" > "$TMP/allowed_signers"; SIGNERS="$TMP/allowed_signers"; }
ssh-keygen -Y verify -f "$SIGNERS" -I release@muxterm -n muxterm-release -s "$TMP/m.json.sig" < "$TMP/m.json" >/dev/null || { echo "manifest signature does not verify"; exit 1; }
V=$(node -p "require('$TMP/m.json').version")
URL=$(node -p "(require('$TMP/m.json').assets['$ARCH']||{}).url||''"); SHA=$(node -p "(require('$TMP/m.json').assets['$ARCH']||{}).sha256||''"); SIG=$(node -p "(require('$TMP/m.json').assets['$ARCH']||{}).sig||''")
NODE_WANT=$(node -p "String(require('$TMP/m.json').node||'')"); NODE_HAVE=$(node -p 'process.versions.node.split(".")[0]')
[ -n "$URL" ] || { echo "no package for $ARCH in $V"; exit 1; }
[ -z "$NODE_WANT" ] || [ "$NODE_WANT" = "$NODE_HAVE" ] || { echo "package needs Node $NODE_WANT, this machine has $NODE_HAVE"; exit 1; }

echo "Downloading $V ($ARCH)..."
curl -fsSL --max-time 900 "$URL" -o "$TMP/pkg.tar.gz"; curl -fsSL --max-time 60 "$SIG" -o "$TMP/pkg.tar.gz.sig"
[ "$(sha256sum "$TMP/pkg.tar.gz" | cut -d' ' -f1)" = "$SHA" ] || { echo "checksum mismatch"; exit 1; }
ssh-keygen -Y verify -f "$SIGNERS" -I release@muxterm -n muxterm-release -s "$TMP/pkg.tar.gz.sig" < "$TMP/pkg.tar.gz" >/dev/null || { echo "package signature does not verify"; exit 1; }

mkdir -p "$HOME_DIR/releases/$V.tmp" "$HOME_DIR/bin" "$HOME_DIR/logs" "$HOME_DIR/data"
tar -xzf "$TMP/pkg.tar.gz" -C "$HOME_DIR/releases/$V.tmp" --strip-components=1
rm -rf "$HOME_DIR/releases/$V"; mv "$HOME_DIR/releases/$V.tmp" "$HOME_DIR/releases/$V"
ln -sfn "releases/$V" "$HOME_DIR/current.new" && mv -Tf "$HOME_DIR/current.new" "$HOME_DIR/current"
cp "$HOME_DIR/releases/$V/scripts/boot-guard.sh" "$HOME_DIR/bin/boot-guard.sh"; chmod +x "$HOME_DIR/bin/boot-guard.sh"

SVC_USER=$(sed -n 's/^User=//p' "$UNIT" | head -1); SVC_USER=${SVC_USER:-root}
chown -R "$SVC_USER" "$HOME_DIR/releases" "$HOME_DIR/bin" "$HOME_DIR/logs" "$HOME_DIR/data" "$HOME_DIR/current" 2>/dev/null || true
cp "$UNIT" "$UNIT.before-packages"
cat > "$UNIT" <<EOF
[Unit]
Description=MuxTerm - Web-based Terminal Multiplexer
After=network.target

[Service]
Type=simple
User=$SVC_USER
WorkingDirectory=$HOME_DIR/current
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=MUXTERM_HOME=$HOME_DIR
ExecStartPre=-$HOME_DIR/bin/boot-guard.sh $HOME_DIR
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
KillMode=process
StandardOutput=append:$HOME_DIR/logs/muxterm.log
StandardError=append:$HOME_DIR/logs/muxterm-error.log
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl restart muxterm
sleep 6
if systemctl is-active --quiet muxterm; then
  echo "MuxTerm $V running from $HOME_DIR/current as $SVC_USER (previous unit saved as $UNIT.before-packages)"
  curl -sk -m 5 "https://localhost:${PORT:-3002}/api/health" 2>/dev/null || curl -s -m 5 "http://localhost:${PORT:-3002}/api/health" 2>/dev/null; echo
else
  echo "service failed to start; restoring previous unit"; cp "$UNIT.before-packages" "$UNIT"; systemctl daemon-reload; systemctl restart muxterm; exit 1
fi
