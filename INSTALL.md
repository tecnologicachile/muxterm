# MuxTerm Installation Guide

## 🚀 Quick Install Methods

### 1. One-Line Install (Recommended)

**Option A - Using curl:**
```bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

**Option B - Using wget:**
```bash
wget -qO- https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
```

**Note**: Most systems have either `curl` or `wget` pre-installed. Try `curl` first, if not available use `wget`. MuxTerm will start automatically after installation.

### 2. Docker
```bash
docker run -d -p 3002:3002 -v muxterm-data:/app/data ghcr.io/tecnologicachile/muxterm
```

### 3. Docker Compose
```bash
curl -O https://raw.githubusercontent.com/tecnologicachile/muxterm/main/docker-compose.yml
docker-compose up -d
```

### 4. Package Managers (Coming Soon)

#### Debian/Ubuntu (DEB)
```bash
wget https://github.com/tecnologicachile/muxterm/releases/download/v1.0.0/muxterm_1.0.0_amd64.deb
sudo dpkg -i muxterm_1.0.0_amd64.deb
```

#### Fedora/RHEL (RPM)
```bash
wget https://github.com/tecnologicachile/muxterm/releases/download/v1.0.0/muxterm-1.0.0-1.noarch.rpm
sudo rpm -i muxterm-1.0.0-1.noarch.rpm
```

#### Snap
```bash
sudo snap install muxterm
```

#### Homebrew (macOS/Linux)
```bash
brew tap tecnologicachile/muxterm
brew install muxterm
```

## 📋 System Requirements

- **OS**: Linux, macOS, Windows (WSL)
- **Node.js**: 16.x or higher
- **tmux**: 2.0 or higher
- **RAM**: 512MB minimum
- **Disk**: 200MB for installation

## 🔧 Manual Installation

### Dependencies

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y nodejs npm tmux git build-essential
```

#### Fedora/RHEL
```bash
sudo dnf install -y nodejs npm tmux git gcc-c++ make
```

#### Arch Linux
```bash
sudo pacman -S nodejs npm tmux git base-devel
```

#### macOS
```bash
brew install node tmux git
```

### Build from Source
```bash
# Clone repository
git clone https://github.com/tecnologicachile/muxterm.git
cd muxterm

# Install dependencies
npm install

# Build client
cd client
npm install
npm run build
cd ..

# Configure
cp .env.example .env
# Edit .env with your settings

# Start
npm start
```

## 🐳 Docker Deployment

### Basic Docker Run
```bash
docker run -d \
  --name muxterm \
  -p 3002:3002 \
  -v muxterm-data:/app/data \
  -v muxterm-sessions:/tmp/muxterm \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  ghcr.io/tecnologicachile/muxterm
```

### Docker Compose with Nginx
```yaml
version: '3.8'
services:
  muxterm:
    image: ghcr.io/tecnologicachile/muxterm
    volumes:
      - ./data:/app/data
      - ./sessions:/tmp/muxterm
    environment:
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - muxterm
```

## 🔒 Production Setup

### 1. Systemd Service
```bash
sudo systemctl enable muxterm
sudo systemctl start muxterm
```

### 2. Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name muxterm.example.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. SSL with Let's Encrypt
```bash
sudo certbot --nginx -d muxterm.example.com
```

## 🔄 Updating

### Using Update Script
```bash
cd /path/to/muxterm
./update.sh
```

### Docker Update
```bash
docker pull ghcr.io/tecnologicachile/muxterm
docker-compose down && docker-compose up -d
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3002
sudo lsof -i :3002
# Kill the process
sudo kill -9 <PID>
```

### tmux Not Found
```bash
# Install tmux
sudo apt install tmux  # Debian/Ubuntu
sudo dnf install tmux  # Fedora
brew install tmux      # macOS
```

### Permission Denied
```bash
# Fix permissions
sudo chown -R $USER:$USER /path/to/muxterm
```

### Can't Connect to Server
1. Check if service is running: `systemctl status muxterm`
2. Check logs: `journalctl -u muxterm -f`
3. Verify port: `netstat -tlnp | grep 3002`

## 📚 Configuration

### Environment Variables
- `PORT`: Server port (default: 3002)
- `JWT_SECRET`: Secret for JWT tokens (required)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_PATH`: SQLite database location

### Data Directories
- `data/`: SQLite database
- `logs/`: Application logs  
- `sessions/`: tmux session sockets

## 🆘 Getting Help

- GitHub Issues: https://github.com/tecnologicachile/muxterm/issues
- Documentation: https://github.com/tecnologicachile/muxterm/wiki
- Community Discord: Coming soon