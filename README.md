# MuxTerm - Web-based Terminal & Remote Desktop Multiplexer

[![GitHub stars](https://img.shields.io/github/stars/tecnologicachile/muxterm?style=social)](https://github.com/tecnologicachile/muxterm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MuxTerm is a web-based workspace that combines local terminals, SSH, RDP, VNC, and SFTP in a single interface. Access and manage all your servers from any browser with persistent sessions and multi-user support.

## Features

- **Local Terminals** - Split workspace into multiple terminal panels powered by tmux + ttyd
- **SSH Connections** - Connect to remote servers via SSH with password or key authentication
- **RDP (Remote Desktop)** - Connect to Windows machines via Apache Guacamole (guacd)
- **VNC** - Control remote desktops via VNC protocol through the same Guacamole stack
- **SFTP File Browser** - Visual file manager for uploading, downloading, and managing remote files
- **Bitwarden/Vaultwarden Integration** - Pull SSH, RDP, VNC, and SFTP credentials directly from your vault
- **Persistent Sessions** - Terminal sessions survive server restarts via tmux
- **Multi-User with Admin Panel** - User management with admin roles, password reset, promote/demote
- **Mobile Friendly** - Responsive design with touch trackpad for RDP, special keys toolbar, pill navigator
- **HTTPS** - Auto-detection of mkcert certificates
- **Auto-Update** - Checks GitHub Releases for new versions with one-click update
- **Docker Support** - Full Dockerfile with multi-stage build

## Quick Start

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

MuxTerm starts automatically at `https://localhost:3002`

Default credentials: `admin` / `admin` (password change required on first login)

### Docker

> **Note:** Native installation is recommended over Docker. With native install, terminal sessions (tmux) persist across updates and restarts. Docker containers lose tmux sessions when recreated.

```bash
git clone https://github.com/tecnologicachile/muxterm.git
cd muxterm
docker build -t muxterm:latest .
docker run -d --name muxterm \
  -e NODE_ENV=production \
  -p 3002:3002 -p 4823:4823 \
  -v muxterm-db:/app/db \
  -v muxterm-data:/app/data \
  -v muxterm-logs:/app/logs \
  muxterm:latest
```

Or with Docker Compose:

```bash
docker-compose up -d
```

### Manual Installation

```bash
git clone https://github.com/tecnologicachile/muxterm.git
cd muxterm
npm install
cd client && npm install && npm run build && cd ..
npm start
```

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React + Material-UI | Single-page workspace UI |
| Backend | Node.js + Express | API, auth, terminal management |
| Terminals | tmux + ttyd | Persistent local/SSH shell sessions |
| RDP/VNC | guacd + guacamole-lite | Remote desktop protocol proxy |
| SFTP | ssh2-sftp-client | File transfer over SSH |
| Database | SQLite (better-sqlite3) | Users, connections, workspace layouts |
| Real-time | Socket.IO | WebSocket communication |
| Auth | JWT + bcrypt | Token-based authentication |
| Vault | Bitwarden CLI (bw) | Credential management |
| HTTPS | mkcert | Local SSL certificates |

### Ports

| Port | Service |
|------|---------|
| 3002 | MuxTerm web server (HTTP/HTTPS) |
| 4822 | guacd (internal, RDP/VNC proxy daemon) |
| 4823 | Guacamole WebSocket proxy (WSS) |

## Usage

### Workspace

After login, MuxTerm opens your workspace. Each user has one workspace with unlimited panels:

- Click **+ Terminal** to add a new panel (Local, SSH, RDP, VNC, or SFTP)
- Drag panel borders to resize
- Use the sidebar (Ctrl+B or hover left edge) to navigate panels
- Minimize panels to keep them running in background

### Bitwarden Integration

1. Open **Settings** (gear icon)
2. Enter your Vaultwarden/Bitwarden server URL, email, and master password
3. Select your organization and the "Remote Access" collection
4. When creating connections, search your vault credentials directly from the dialog

Credentials with `ssh://`, `rdp://`, `vnc://`, or `sftp://` URIs are automatically recognized.

### Mobile

- **Swipe** between panels
- **Pill indicator** at bottom shows active panel
- **Special keys toolbar** adapts per panel type (terminal shortcuts vs RDP keysyms)
- **Touch trackpad** for RDP: drag to move cursor, tap to click, long-press for right-click

### Admin Panel

The first user created is admin. From **Settings > User Management**, admins can:

- List all users
- Reset passwords
- Promote/demote admin roles
- Delete users

Emergency CLI: `node scripts/reset-password.js <username> <password>`

## HTTPS Setup

MuxTerm auto-detects SSL certificates in the `certs/` directory:

```bash
# Install mkcert
mkcert -install
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 YOUR_IP
```

## Configuration

### Environment Variables (.env)

```env
PORT=3002
NODE_ENV=production
JWT_SECRET=auto-generated-on-first-run
GUAC_SECRET=auto-generated-on-first-run
SESSION_SECRET=auto-generated-on-first-run
VAULTWARDEN_URL=https://vault.example.com
```

Secrets are auto-generated on first run if not provided.

### Database

SQLite database at `db/webssh.db` stores users, connections, and workspace layouts. Persisted across updates.

## Updating

MuxTerm checks GitHub Releases automatically. When an update is available:

1. A notification appears in the header
2. Click the version chip to see changelog
3. Click **Update Now** or run manually:

```bash
cd /path/to/muxterm
git pull origin main
npm install
cd client && npm install && npm run build && cd ..
# Restart the server
```

Terminal sessions (tmux) survive updates.

## System Requirements

- **OS**: Ubuntu/Debian 20.04+, Fedora, CentOS, Arch Linux, or WSL
- **Memory**: 1GB minimum (2GB recommended)
- **Node.js**: 18+
- **Dependencies**: tmux, ttyd, guacd (for RDP/VNC)

## Security

- Passwords hashed with bcrypt
- JWT tokens with auto-generated secrets
- AES-256-CBC encryption for Guacamole tokens
- Per-user session isolation
- Bitwarden credentials fetched on demand, never stored locally
- Admin role system with root protection

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/tecnologicachile/muxterm/issues) for bugs and feature requests
- Star the project if you find it useful!
