#!/bin/bash
# Sign or verify release files with the project's release key.
#
#   scripts/sign-release.sh sign   <private-key-file> <file>...   -> <file>.sig
#   scripts/sign-release.sh verify <file>...                      (against release/allowed_signers)
#
# Signatures are OpenSSH signatures (`ssh-keygen -Y`): every Linux with ssh
# can verify them, no extra tool. The public key lives in
# release/allowed_signers; the private key only in CI's secret and in the
# password manager.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
NS=muxterm-release
ID=release@muxterm

case "${1:-}" in
  sign)
    KEY=$2; shift 2
    for f in "$@"; do
      ssh-keygen -Y sign -f "$KEY" -n "$NS" "$f" >/dev/null
      echo "signed $f"
    done ;;
  verify)
    shift
    for f in "$@"; do
      if ssh-keygen -Y verify -f "$ROOT/release/allowed_signers" -I "$ID" -n "$NS" -s "$f.sig" < "$f" >/dev/null 2>&1; then
        echo "OK  $f"
      else
        echo "BAD $f" >&2; exit 1
      fi
    done ;;
  *) echo "usage: $0 sign <key> <file>... | verify <file>..." >&2; exit 2 ;;
esac
