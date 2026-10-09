# Release signing

Every file published in a GitHub release of MuxTerm (the packages, the update
manifest `stable.json`) carries an OpenSSH signature made with the project's
release key. `allowed_signers` in this directory holds the public half; the
private half exists only in the CI secret `RELEASE_SIGNING_KEY` and in the
team's password manager.

Verify a download with nothing but ssh:

```bash
ssh-keygen -Y verify -f release/allowed_signers -I release@muxterm \
  -n muxterm-release -s muxterm-1.2.3-linux-x64.tar.gz.sig < muxterm-1.2.3-linux-x64.tar.gz
```

`scripts/sign-release.sh verify <file>...` does the same for several files.

Rotating the key: generate a new ed25519 pair (`ssh-keygen -t ed25519 -C
release@muxterm`), add the new public key as a second line here (keep the old
one until every installation has seen a release signed by both), update the
secret, and remove the old line one release later.
