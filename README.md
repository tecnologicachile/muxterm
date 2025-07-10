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

### Prerequisites

- Node.js 16+ 
- tmux (for session persistence)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/tecnologicachile/muxterm.git
cd muxterm

# Install dependencies
npm install

# Install client dependencies
cd client
npm install
npm run build
cd ..

# Create .env file
echo "JWT_SECRET=your-secret-key-here" > .env

# Start the server
npm start
```

The server will start on `http://localhost:3002`

Default test credentials:
- Username: `test`
- Password: `test123`

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
- **Split Horizontal/Vertical**: Create new terminal panels
- **Drag to Resize**: Adjust panel sizes
- **Minimize**: Hide panels to a dock
- **Rename**: Give panels custom names

### Keyboard Shortcuts
- `Ctrl+Shift+H`: Split horizontal
- `Ctrl+Shift+V`: Split vertical
- `Ctrl+Shift+N`: New terminal
- `Ctrl+Tab`: Next panel
- `Ctrl+W`: Close panel

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
- Sessions isolated per user
- No SSH keys stored on server

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