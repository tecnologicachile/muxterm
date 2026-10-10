#!/bin/bash
# Change the rollout percentage of a channel's current manifest and publish it.
#
#   scripts/set-rollout.sh <channel> <percent> <private-key-file>
#
# The manifests live on the `channels` branch (CI writes them on every
# release). Lowering the percentage stops a release from reaching more
# installations: at 0 nobody new takes it; raising it continues the rollout.
# Installations decide with hash(installId) mod 100 < rollout, so a given
# install is always on the same side as the number grows.
set -euo pipefail
CH=$1; PCT=$2; KEY=$3
REPO=${MUXTERM_REPO:-tecnologicachile/muxterm}
[ "$PCT" -ge 0 ] && [ "$PCT" -le 100 ] || { echo "percent must be 0-100"; exit 1; }
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --branch channels "https://github.com/$REPO.git" "$TMP/channels"
cd "$TMP/channels"
[ -f "$CH.json" ] || { echo "no manifest for channel $CH"; exit 1; }
node -e "const f='$CH.json';const m=JSON.parse(require('fs').readFileSync(f));m.rollout=$PCT;require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')"
rm -f "$CH.json.sig"
bash "$ROOT/scripts/sign-release.sh" sign "$KEY" "$CH.json" >/dev/null
bash "$ROOT/scripts/sign-release.sh" verify "$CH.json" >/dev/null
git add "$CH.json" "$CH.json.sig"
git -c user.name=muxterm-release -c user.email=release@muxterm commit -q -m "$CH: rollout $PCT% for $(node -p "require('./$CH.json').version")"
git push -q origin channels
echo "$CH now at $PCT% (version $(node -p "require('./$CH.json').version"))"
