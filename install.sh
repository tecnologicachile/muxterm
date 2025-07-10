#!/bin/bash

# MuxTerm Installer Script
# Supports: Ubuntu, Debian, Fedora, CentOS, Arch, WSL

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║         MuxTerm Installer            ║"
    echo "║   Web-based Terminal Multiplexer     ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        echo -e "${RED}Cannot detect OS${NC}"
        exit 1
    fi
}

check_root() {
    if [ "$EUID" -eq 0 ]; then 
        echo -e "${YELLOW}Warning: Running as root. It's recommended to run as regular user.${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

install_dependencies() {
    echo -e "${BLUE}Installing system dependencies...${NC}"
    
    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y curl git tmux build-essential python3
            ;;
        fedora)
            sudo dnf install -y curl git tmux gcc-c++ make python3
            ;;
        centos|rhel)
            sudo yum install -y curl git tmux gcc-c++ make python3
            ;;
        arch|manjaro)
            sudo pacman -Syu --noconfirm curl git tmux base-devel python
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            echo "Please install manually: curl, git, tmux, build tools"
            exit 1
            ;;
    esac
}

install_nodejs() {
    echo -e "${BLUE}Checking Node.js...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 16 ]; then
            echo -e "${GREEN}Node.js $(node -v) already installed${NC}"
            return
        else
            echo -e "${YELLOW}Node.js version too old. Installing newer version...${NC}"
        fi
    fi
    
    # Install Node.js via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    
    case $OS in
        ubuntu|debian)
            sudo apt-get install -y nodejs
            ;;
        fedora|centos|rhel)
            sudo dnf install -y nodejs || sudo yum install -y nodejs
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm nodejs npm
            ;;
    esac
}

clone_repository() {
    echo -e "${BLUE}Cloning MuxTerm repository...${NC}"
    
    if [ -d "muxterm" ]; then
        echo -e "${YELLOW}Directory 'muxterm' already exists${NC}"
        read -p "Remove and re-clone? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf muxterm
        else
            cd muxterm
            git pull
            return
        fi
    fi
    
    git clone https://github.com/tecnologicachile/muxterm.git
    cd muxterm
}

setup_muxterm() {
    echo -e "${BLUE}Setting up MuxTerm...${NC}"
    
    # Install server dependencies
    echo "Installing server dependencies..."
    npm ci --production || npm install --production
    
    # Check for pre-built client
    echo -e "${BLUE}Checking for pre-built client...${NC}"
    RELEASE_URL="https://api.github.com/repos/tecnologicachile/muxterm/releases/latest"
    RELEASE_INFO=$(curl -s $RELEASE_URL)
    DOWNLOAD_URL=$(echo $RELEASE_INFO | grep -o '"browser_download_url": "[^"]*client-dist.tar.gz"' | cut -d'"' -f4 || true)
    
    if [ -n "$DOWNLOAD_URL" ]; then
        echo -e "${GREEN}Found pre-built client! Downloading...${NC}"
        curl -L -o client-dist.tar.gz "$DOWNLOAD_URL"
        mkdir -p client
        tar -xzf client-dist.tar.gz -C client/
        rm client-dist.tar.gz
        echo -e "${GREEN}Client downloaded successfully!${NC}"
    else
        echo -e "${YELLOW}No pre-built client found. Building from source...${NC}"
        echo -e "${YELLOW}This may take several minutes...${NC}"
        cd client
        npm ci --production || npm install --production
        npm run build
        cd ..
    fi
    
    # Create default .env
    if [ ! -f .env ]; then
        echo -e "${BLUE}Creating configuration file...${NC}"
        cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
PORT=3002
NODE_ENV=production
EOF
        echo -e "${GREEN}Configuration created${NC}"
    fi
    
    # Create data directories
    mkdir -p data logs sessions
}

create_systemd_service() {
    echo -e "${BLUE}Creating systemd service...${NC}"
    
    if [ -f /etc/systemd/system/muxterm.service ]; then
        echo -e "${YELLOW}Service already exists${NC}"
        return
    fi
    
    INSTALL_DIR=$(pwd)
    USER=$(whoami)
    
    sudo tee /etc/systemd/system/muxterm.service > /dev/null << EOF
[Unit]
Description=MuxTerm - Web-based Terminal Multiplexer
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$INSTALL_DIR/logs/muxterm.log
StandardError=append:$INSTALL_DIR/logs/muxterm-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    echo -e "${GREEN}Systemd service created${NC}"
}

setup_nginx() {
    echo -e "${BLUE}Would you like to setup Nginx reverse proxy?${NC}"
    read -p "(y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    # Install nginx if needed
    if ! command -v nginx &> /dev/null; then
        case $OS in
            ubuntu|debian)
                sudo apt-get install -y nginx
                ;;
            fedora|centos|rhel)
                sudo dnf install -y nginx || sudo yum install -y nginx
                ;;
            arch|manjaro)
                sudo pacman -S --noconfirm nginx
                ;;
        esac
    fi
    
    # Get domain
    read -p "Enter your domain name (e.g., muxterm.example.com): " DOMAIN
    
    # Create nginx config
    sudo tee /etc/nginx/sites-available/muxterm > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/muxterm /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    
    echo -e "${GREEN}Nginx configured for $DOMAIN${NC}"
    echo -e "${YELLOW}Don't forget to setup SSL with certbot!${NC}"
}

print_success() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════╗"
    echo "║    MuxTerm Installation Complete!    ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "Installation directory: $(pwd)"
    echo
    echo "To start MuxTerm:"
    echo "  1. As a service:    sudo systemctl start muxterm"
    echo "  2. Enable on boot:  sudo systemctl enable muxterm"
    echo "  3. Manual start:    npm start"
    echo
    echo "Access MuxTerm at: http://localhost:3002"
    echo
    echo "Default credentials:"
    echo "  Username: test"
    echo "  Password: test123"
    echo
    echo "To update: ./update.sh"
    echo
}

# Main installation flow
main() {
    print_banner
    detect_os
    check_root
    
    echo -e "${BLUE}Detected OS: $OS $VER${NC}"
    echo
    
    install_dependencies
    install_nodejs
    clone_repository
    setup_muxterm
    create_systemd_service
    setup_nginx
    print_success
}

# Run main
main