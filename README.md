# MuxTerm - Web-based Terminal Multiplexer

MuxTerm is a web-based terminal multiplexer that provides persistent SSH sessions with tmux-like features. Access your terminals from anywhere with full session persistence.

## Features

- 🖥️ **Multiple Terminals** - Split your workspace into multiple terminal panels
- 💾 **Persistent Sessions** - Sessions survive server restarts and browser refreshes
- 🔄 **Auto-Reconnect** - Automatically reconnect to your sessions
- 👥 **Multi-User Support** - Each user has independent sessions
- 📱 **Mobile Friendly** - Responsive design works on all devices
- ⚡ **Real-time Sync** - See updates across all connected clients
- 🤖 **Auto-Yes Feature** - Automatically respond to CLI prompts
- 🗂️ **Session Management** - Name, organize, and manage your sessions

## Quick Start

### One-Line Install (Linux/WSL)

**Using curl:**
```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

**Using wget:**
```bash
wget -qO- https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

**Note**: MuxTerm will start automatically after installation.

**Non-interactive install** (for scripts/automation):
```bash
# With curl
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash -s -- --yes

# With wget  
wget -qO- https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash -s -- --yes
```

**WSL Users**: Run from Linux filesystem, not Windows:
```bash
cd ~  # Important: Move to Linux home first
# Then use either curl or wget command above
```

### Docker Install

```bash
# Using Docker Compose
curl -O https://raw.githubusercontent.com/tecnologicachile/muxterm/main/docker-compose.yml
docker-compose up -d

# Or using Docker directly
docker run -d -p 3002:3002 -v muxterm-data:/app/data ghcr.io/tecnologicachile/muxterm
```

### Manual Installation

#### Prerequisites

- Node.js 16+ 
- tmux (for session persistence)
- Git

```bash
# Clone the repository
git clone https://github.com/tecnologicachile/muxterm.git
cd muxterm

# Run installer
./install.sh

# Or install manually
npm install
cd client && npm install && npm run build && cd ..
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
npm start
```

The server will start on `http://localhost:3002`

Default credentials:
- Username: `test`
- Password: `test123`

**Important**: The default user is created automatically on first run. For production use, create a new admin user:

```bash
npm run create-user
```

## Architecture

MuxTerm uses:
- **Frontend**: React with Material-UI
- **Backend**: Node.js with Express
- **Terminal**: node-pty with tmux integration
- **WebSocket**: Socket.io for real-time communication
- **Database**: SQLite for session persistence
- **Terminal UI**: xterm.js

## Usage

### Creating Sessions
1. Login with your credentials
2. Click "New Session" and give it a name
3. Your session is now persistent

### Managing Panels
- **Split Horizontal/Vertical**: Create new terminal panels with the split button
- **Drag to Resize**: Adjust panel sizes by dragging borders
- **Minimize**: Hide panels to a dock at the bottom
- **Rename**: Click rename button to give panels custom names
- **Auto-Yes**: Toggle per-terminal automatic confirmations

### Auto-Yes Feature
Enable Auto-Yes on any terminal to automatically respond to CLI prompts from tools like:
- Claude CLI
- GitHub Copilot CLI
- npm/yarn confirmations
- Other interactive CLIs

## Updating

To update MuxTerm while preserving your data:

```bash
./update.sh
```

This will:
- Backup your database
- Pull latest changes
- Update dependencies
- Rebuild the client
- Preserve all sessions

## Development

```bash
# Run in development mode
npm run dev

# Run client in development
cd client && npm start

# Run tests
npm test
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3002
JWT_SECRET=your-secret-key
NODE_ENV=production
```

### Database

SQLite database is stored in `data/webssh.db`. It contains:
- User accounts
- Session metadata
- Terminal layouts
- Panel configurations

### tmux Configuration

Custom tmux config is in `.tmux.webssh.conf` for invisible operation.

## Security

- Passwords are hashed with bcrypt
- JWT tokens for authentication
- Session secrets for secure sessions
- Sessions isolated per user
- No SSH keys stored on server
- UTF-8 locale support for international characters

### Creating Users

For production environments, create admin users:

```bash
npm run create-user
```

### Installation in Containers

MuxTerm works in Docker/LXC containers. For root installations:

```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash -s -- --yes
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [xterm.js](https://xtermjs.org/)
- Terminal persistence via [tmux](https://github.com/tmux/tmux)
- Inspired by traditional terminal multiplexers

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/tecnologicachile/muxterm/issues) page.