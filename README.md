<div align="center">

# MuxTerm

**Your terminals, servers and Windows desktops in one browser tab. Works from a phone.**

[![Release](https://img.shields.io/github/v/release/tecnologicachile/muxterm?label=release)](https://github.com/tecnologicachile/muxterm/releases)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/tecnologicachile/muxterm/release.yml?label=build)](https://github.com/tecnologicachile/muxterm/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/tecnologicachile/muxterm)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/tecnologicachile/muxterm?style=social)](https://github.com/tecnologicachile/muxterm/stargazers)

[Install](#quickstart) · [Why](#why-this-project) · [Features](#feature-matrix) · [Claude Code](#built-for-claude-code) · [Contributing](CONTRIBUTING.md)

</div>

MuxTerm is a self-hosted web workspace that puts local terminals, SSH, RDP, VNC and SFTP side by side in a single page. Sessions live in tmux on the server, so you can close the laptop, pick up the phone and find everything exactly where you left it.

```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

One command on a fresh Debian or Ubuntu. Five minutes later you have HTTPS, a systemd service, RDP/VNC support and signed automatic updates. Default login `admin` / `admin`, changed on first use.

> **Screenshots and a short demo are coming to this section.** If you already use MuxTerm and want to share yours, open a PR with a PNG in `docs/screenshots/`.

## Why this project

We run a small IT company and spend the day between Linux servers, Windows machines over RDP and a handful of Claude Code sessions doing work for us. Nothing we tried did all of this at once:

- **Web terminals** (ttyd, Wetty, Shellngn) give you one shell per tab and no remote desktop.
- **Guacamole** does RDP and VNC well but is heavy to run, and its terminal is an afterthought.
- **tmux over SSH** is perfect on a laptop and painful on a phone.
- **Nothing was responsive.** Resizing a browser or opening the page on a phone broke every one of them.

MuxTerm is the tool we wanted: tmux-backed terminals that survive anything, Guacamole for RDP/VNC without running Guacamole's Java stack, a file browser for SFTP, credentials from your own Bitwarden, and a layout that works from a 6-inch screen to a 4K monitor. It also understands Claude Code: it knows when a session is working, waiting for you or done, and tells your phone.

## Feature matrix

| | What you get |
|---|---|
| **Local terminals** | Split the workspace into panels; each is a tmux window served by ttyd. Survives server restarts and updates. |
| **SSH** | Password or key auth, credentials from Bitwarden, same persistent tmux sessions. |
| **RDP** | Windows desktops through guacd. Touch trackpad on phones, special-keys toolbar, Ctrl+Alt+Del and friends. |
| **VNC** | Same Guacamole stack as RDP. |
| **SFTP** | Visual file manager: upload, download, rename, delete on any SSH host. |
| **Responsive** | Desktop: drag panel borders, sidebar. Phone: swipe between panels, pill navigator, toolbar that adapts to the panel type. The terminal re-fits on every resize, rotation and wake-up. |
| **Claude Code aware** | Conversation view of a running session, per-panel state (working / waiting / done), activity tray grouped by session, Web Push to your phone when Claude asks something or finishes. |
| **Credentials** | Bitwarden / Vaultwarden integration. `ssh://`, `rdp://`, `vnc://`, `sftp://` URIs recognised. Nothing stored in MuxTerm. |
| **Multi-user** | Admin panel: create users, reset passwords, promote and demote. Per-user workspaces. |
| **HTTPS** | Self-signed certificate on install; drop in mkcert or your own. |
| **Updates** | Signed release packages verified before install, health check after restart, automatic rollback if the new version does not start. Stable and beta channels, staged rollout. |
| **Installs on** | Debian 12, Ubuntu 24.04 (tested from scratch), other systemd distros, unprivileged Proxmox LXC, Docker. |

## Built for Claude Code

MuxTerm started as the place where our Claude Code sessions run, and it shows:

- **Conversation view.** Switch any terminal from raw output to a rendered view of the Claude Code transcript: messages, tool calls, narration, task notifications and messages from other sessions, with clickable links.
- **One answer per panel: what is this panel doing?** A unified state (idle, working, waiting for permission, waiting for input, done) computed from tmux and the transcript, shown as an indicator on every panel.
- **Activity tray.** Every question and completion from every session, grouped by session, with suggested replies you can send in one tap.
- **Push notifications.** Web Push to your phone when a session needs you, so you can leave Claude working and go for a walk.
- **Accents and special characters** pasted from the conversation view reach Claude intact.

## Quickstart

### Let Claude Code do it

Paste this into Claude Code on the machine (or in a shell on the target server) and let it drive:

```
Install MuxTerm from https://github.com/tecnologicachile/muxterm with its one-line installer,
then open https://<this-machine>:3002, log in as admin/admin and set a new password.
If the install fails, read install.sh and fix the environment rather than the script.
```

### One line

```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

MuxTerm starts at `https://localhost:3002` with a self-signed certificate (accept the browser warning once; see [HTTPS](#https) for a trusted one). The installer:

- downloads the latest **signed release package** for your architecture (x64 or arm64) and verifies the signature with a key embedded in the script; if no package is published for your platform it falls back to cloning and building;
- installs to `/opt/muxterm` as root (creating a `muxterm` service account) or `~/muxterm` as a regular user; set `MUXTERM_DIR` to choose;
- builds guacd for RDP/VNC (most of the 4 to 5 minutes), writes the systemd unit and starts the service.

Tested from scratch on Debian 12 and Ubuntu 24.04. Requires Node.js 24 for packaged installs; the installer sets it up.

### Docker

```bash
git clone https://github.com/tecnologicachile/muxterm.git && cd muxterm
docker compose up -d
```

guacd is bundled in the image, so RDP and VNC work out of the box. Put a certificate in `./certs` first or the container serves plain HTTP. Two caveats: tmux sessions do not survive recreating the container, and "local" terminals open shells inside the container, not on the host. For daily use we recommend the native install.

Inside an **unprivileged LXC** (Proxmox's default) recent Docker fails to start any container with `open sysctl net.ipv4.ip_unprivileged_port_start … permission denied`. Run on the host's network instead:

```yaml
# docker-compose.override.yml
services:
  muxterm:
    network_mode: host
    ports: !reset []
```

### From source

```bash
git clone https://github.com/tecnologicachile/muxterm.git && cd muxterm
npm install
cd client && npm install && npm run build && cd ..
npm start
```

A source checkout updates with `update.sh`; the signed-package updater only runs on packaged installs.

## What's new

### 1.1.63

First release with the new distribution pipeline:

- **Signed packages** for linux-x64 and linux-arm64 built in CI on every tag, with ed25519 signatures you can verify with `ssh-keygen -Y verify`.
- **Installer in package mode**: downloads and verifies the package instead of compiling; falls back to source when needed. Service account `muxterm` when run as root. `scripts/migrate-to-packages.sh` moves an existing checkout to the new layout in about ten seconds.
- **Updater with rollback**: `releases/<version>` directories and a `current` symlink, health check after restart, and a boot guard outside the release that turns back a version that cannot start. Failed versions are never retried.
- **Channels and rollout**: `stable` and `beta` manifests on the `channels` branch; a rollout percentage lets a release reach installations gradually. Settings shows version, channel, what is available and lets admins check, update or postpone.
- **Panel state and activity tray** for Claude Code sessions, Web Push notifications, conversation view fixes (narration blocks, task notifications, messages from other sessions, clickable URLs).

Earlier history is in the [releases page](https://github.com/tecnologicachile/muxterm/releases).

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React + Material-UI (Vite) | Single-page workspace UI |
| Backend | Node.js + Express + Socket.IO | API, auth, terminal management, real-time |
| Terminals | tmux + ttyd | Persistent local/SSH shell sessions |
| RDP/VNC | guacd + guacamole-lite | Remote desktop protocol proxy |
| SFTP | ssh2-sftp-client | File transfer over SSH |
| Database | SQLite (better-sqlite3) | Users, connections, layouts, activity |
| Auth | JWT + bcrypt | Token-based authentication |
| Vault | Bitwarden CLI (bw) | Credentials on demand |
| Updates | signed tarballs + manifest | See [docs/design/actualizaciones.md](docs/design/actualizaciones.md) |

| Port | Service |
|------|---------|
| 3002 | MuxTerm web server (HTTPS) |
| 4822 | guacd (internal) |
| 4823 | Guacamole WebSocket proxy (WSS) |

## Using it

**Workspace.** Click **+ Terminal** to add a panel (Local, SSH, RDP, VNC or SFTP). Drag borders to resize, use the sidebar (Ctrl+B or hover the left edge) to jump between panels, minimise panels to keep them running in the background.

**Phone.** Swipe between panels. The pill at the bottom shows where you are. The special-keys toolbar changes with the panel type (terminal shortcuts, RDP keysyms). On RDP, drag to move the cursor, tap to click, long-press for right-click.

**Bitwarden.** Settings → enter your Vaultwarden/Bitwarden URL, email and master password, pick the organisation and collection. Connection dialogs then search your vault. Credentials are fetched on demand and never stored.

**Admins.** The first user is admin. Settings → User Management lists users, resets passwords, promotes and demotes. Emergency CLI: `node scripts/reset-password.js <user> <password>`.

**Updates.** Packaged installs check every six hours (with jitter), download and verify the new version, announce it to connected browsers, wait two minutes so you can save your work (or postpone an hour), restart, confirm health and keep the previous version around for rollback. Settings → *Versión y actualizaciones* shows the state and lets you switch to the beta channel.

## HTTPS

The installer creates a self-signed certificate in `certs/`. To replace it with one your devices trust, use mkcert (the key must end in `-key.pem`):

```bash
mkcert -install
mkcert -cert-file certs/muxterm.pem -key-file certs/muxterm-key.pem localhost 127.0.0.1 YOUR_IP
sudo systemctl restart muxterm
```

## Configuration

`.env` in the install directory:

```env
PORT=3002
NODE_ENV=production
JWT_SECRET=auto-generated-on-first-run
GUAC_SECRET=auto-generated-on-first-run
SESSION_SECRET=auto-generated-on-first-run
VAULTWARDEN_URL=https://vault.example.com
MUXTERM_UPDATE_URL=   # optional: your own mirror of the signed manifest
```

Data lives in `data/` and the SQLite database in `db/webssh.db`, both outside the release directories, so they persist across updates.

## Requirements

- Linux with systemd (Debian 12 and Ubuntu 24.04 tested), or Docker
- 1 GB RAM minimum, 2 GB recommended
- Node.js 24 (installed by the installer); source checkouts run on 18+
- tmux, ttyd, guacd (the installer builds guacd)

## Security

Passwords hashed with bcrypt. JWT secrets generated on first run. Guacamole tokens encrypted with AES-256-CBC. Per-user session isolation. Bitwarden credentials fetched on demand, never stored. Release packages signed with ed25519 and verified before install; the public key ships in `release/allowed_signers` and inside `install.sh`.

Found a vulnerability? Please email the maintainers through the address on the [organisation page](https://github.com/tecnologicachile) instead of opening a public issue.

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to run MuxTerm from source, where things live and what kind of changes land fastest. Good first contributions: distro coverage for the installer, translations of the UI, screenshots for this README.

If MuxTerm saves you time, a star helps other people find it.

## License

MIT. See [LICENSE](LICENSE).
