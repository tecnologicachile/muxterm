# Contributing to MuxTerm

Thanks for looking under the hood. This file tells you how to run MuxTerm from source, how the code is laid out and what makes a change easy to review.

## Run it from source

```bash
git clone https://github.com/tecnologicachile/muxterm.git && cd muxterm
npm install
cd client && npm install && cd ..
npm run dev          # server with nodemon on :3002
cd client && npm run dev   # Vite dev server on :5173, proxied to the API
```

You need `tmux` and `ttyd` on the machine for terminals, and `guacd` only if you work on RDP/VNC (`install.sh` shows how it is built). Without a certificate in `certs/` the dev server speaks plain HTTP, which is fine locally.

Default login is `admin` / `admin`.

## Where things live

| Path | What |
|---|---|
| `server/index.js` | Express app, routes, Socket.IO, startup |
| `server/ttyd-manager.js`, `server/tmux-*.js` | Terminal panels: tmux windows served by ttyd |
| `server/guacamole-manager.js` | RDP/VNC through guacd and guacamole-lite |
| `server/claude-transcript.js`, `server/claude-status.js`, `server/claude-activity.js` | Claude Code integration: transcript parsing, panel state, activity log |
| `server/updater.js`, `server/paths.js`, `scripts/boot-guard.sh` | Signed-package updater and rollback |
| `client/src/components/TerminalView.jsx` | The workspace page (large; most UI lives here) |
| `client/src/components/*.jsx` | Panels, dialogs, activity tray, updater panel |
| `install.sh`, `scripts/` | Installer, migration, release tooling |
| `docs/design/*.md` | Design notes written before each larger feature; read them before changing that area |
| `.github/workflows/release.yml` | Builds, signs and publishes packages on every `v*` tag |

## What lands fastest

- **Bug fixes with a reproduction.** Say which browser, which panel type, which OS, and what you expected.
- **Installer coverage.** A fix that makes `install.sh` work on a distro we did not test, with the exact commands you ran to verify it on a clean VM or container.
- **Responsive and mobile fixes.** We care a lot about the phone experience; a screenshot before and after helps.
- **Claude Code integration.** Claude Code's transcript format changes between versions. If the conversation view renders something badly, paste the raw JSONL lines (with secrets removed).
- **Translations.** The UI is a mix of English and Spanish today; making it consistent and translatable is welcome.

Bigger changes (a new panel type, a new storage backend, a redesign) are best started as an issue describing the problem and the intended approach, so we can agree before you write the code.

## Style

- Node.js 24, plain CommonJS on the server, React function components on the client.
- Keep comments to the *why*; the code says the what. Match the surrounding style.
- No new dependencies without a sentence explaining why the existing ones do not do the job.
- Do not commit `client/dist`, `.env`, `certs/` or anything under `data/` or `db/`.

## Testing a change

There is no large automated suite yet (help welcome). What we do before merging:

1. `node --check` on changed server files and `npm run build` in `client/`.
2. Run the server from source and exercise the affected panel type in a desktop browser and in a phone-sized viewport.
3. For installer or updater changes: a fresh Debian 12 or Ubuntu 24.04 container, running `install.sh` from your branch (`curl …/<branch>/install.sh | bash`).

Say in the PR what you ran. "Tested on Debian 12 LXC, fresh install, RDP to Windows 11" is exactly the right level of detail.

## Releases

Maintainers release by bumping `package.json` and `client/package.json`, tagging `vX.Y.Z` and pushing the tag. CI builds x64 and arm64 packages, signs them and publishes the manifest to the `channels` branch; installations pick it up within six hours. A tag containing a hyphen (`v1.2.0-beta.1`) goes to the beta channel. Details in [docs/design/actualizaciones.md](docs/design/actualizaciones.md).

## Conduct

Be kind, assume good faith, keep discussions about the code. Maintainers may close or lock anything that is not.
