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

# Variables
IS_ROOT=false
USE_SUDO=""
NON_INTERACTIVE=false
MINIMAL_INSTALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --yes|-y)
            NON_INTERACTIVE=true
            shift
            ;;
        --minimal)
            MINIMAL_INSTALL=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

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
        IS_ROOT=true
        echo -e "${YELLOW}Running as root user${NC}"
        # Don't use sudo when running as root
        USE_SUDO=""
    else
        # Check if sudo is available
        if command -v sudo &> /dev/null; then
            USE_SUDO="sudo"
        else
            echo -e "${RED}Error: 'sudo' command not found${NC}"
            echo "Please install sudo or run this script as root"
            exit 1
        fi
    fi
}

check_basic_deps() {
    echo -e "${BLUE}Checking basic dependencies...${NC}"
    
    # Check for curl/wget
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        echo -e "${YELLOW}Installing curl...${NC}"
        case $OS in
            ubuntu|debian)
                $USE_SUDO apt-get update -qq
                $USE_SUDO apt-get install -y curl
                ;;
            fedora|centos|rhel)
                $USE_SUDO yum install -y curl
                ;;
            arch|manjaro)
                $USE_SUDO pacman -Sy --noconfirm curl
                ;;
        esac
    fi
}

configure_locales() {
    echo -e "${BLUE}Configuring system locales...${NC}"
    
    # Only for Debian-based systems
    if [[ "$OS" =~ ^(ubuntu|debian)$ ]]; then
        export DEBIAN_FRONTEND=noninteractive
        
        # Check if locales package is installed
        if ! dpkg -l locales &> /dev/null; then
            $USE_SUDO apt-get update -qq
            $USE_SUDO apt-get install -y locales
        fi
        
        # Generate en_US.UTF-8 locale
        if ! locale -a | grep -q "en_US.utf8"; then
            $USE_SUDO locale-gen en_US.UTF-8
        fi
        
        export LANG=en_US.UTF-8
        export LC_ALL=en_US.UTF-8
    fi
}

check_memory() {
    if [ -f /proc/meminfo ]; then
        TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        TOTAL_MEM_MB=$((TOTAL_MEM / 1024))
        
        if [ "$TOTAL_MEM_MB" -lt 1024 ]; then
            echo -e "${YELLOW}⚠️  WARNING: System has only ${TOTAL_MEM_MB}MB RAM${NC}"
            echo -e "${YELLOW}Minimum 1GB recommended for building the client${NC}"
            echo -e "${YELLOW}Consider using --minimal flag or increasing memory${NC}"
            
            if [ "$NON_INTERACTIVE" = false ]; then
                read -p "Continue anyway? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
        fi
    fi
}

install_dependencies() {
    echo -e "${BLUE}Installing system dependencies...${NC}"
    
    case $OS in
        ubuntu|debian)
            $USE_SUDO apt-get update
            $USE_SUDO apt-get install -y curl git tmux build-essential python3 locales
            ;;
        fedora)
            $USE_SUDO dnf install -y curl git tmux gcc-c++ make python3 glibc-langpack-en
            ;;
        centos|rhel)
            $USE_SUDO yum install -y curl git tmux gcc-c++ make python3 glibc-langpack-en
            ;;
        arch|manjaro)
            $USE_SUDO pacman -Syu --noconfirm curl git tmux base-devel python
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            echo "Please install manually: curl, git, tmux, build tools"
            exit 1
            ;;
    esac
}

configure_locales() {
    echo -e "${BLUE}Configuring system locales...${NC}"
    
    # Only for Debian-based systems
    if [[ "$OS" =~ ^(ubuntu|debian)$ ]]; then
        export DEBIAN_FRONTEND=noninteractive
        
        # Check if locales package is installed
        if ! dpkg -l locales &> /dev/null; then
            $USE_SUDO apt-get update -qq
            $USE_SUDO apt-get install -y locales
        fi
        
        # Generate en_US.UTF-8 locale
        if ! locale -a 2>/dev/null | grep -q "en_US.utf8"; then
            $USE_SUDO locale-gen en_US.UTF-8
        fi
        
        export LANG=en_US.UTF-8
        export LC_ALL=en_US.UTF-8
    fi
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
    if [ "$IS_ROOT" = true ]; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_lts.x | $USE_SUDO -E bash -
    fi
    
    case $OS in
        ubuntu|debian)
            $USE_SUDO apt-get install -y nodejs
            ;;
        fedora|centos|rhel)
            $USE_SUDO dnf install -y nodejs || $USE_SUDO yum install -y nodejs
            ;;
        arch|manjaro)
            $USE_SUDO pacman -S --noconfirm nodejs npm
            ;;
    esac
}

clone_repository() {
    echo -e "${BLUE}Cloning MuxTerm repository...${NC}"
    
    # Check if we're in Windows filesystem (WSL)
    if [[ "$PWD" == /mnt/* ]]; then
        echo -e "${YELLOW}Warning: You're in Windows filesystem (/mnt/*)${NC}"
        echo -e "${YELLOW}WSL has permission issues here. Moving to Linux home directory...${NC}"
        cd ~
        echo -e "${GREEN}Changed to: $PWD${NC}"
    fi
    
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
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Error: git is not installed${NC}"
        echo "Please install git and run the installer again"
        exit 1
    fi
    
    # Clone with filemode disabled for WSL compatibility
    git clone -c core.filemode=false https://github.com/tecnologicachile/muxterm.git
    cd muxterm
    
    # Ensure git config is set correctly for WSL
    git config core.filemode false 2>/dev/null || true
}

setup_muxterm() {
    echo -e "${BLUE}Setting up MuxTerm...${NC}"
    
    # Install server dependencies
    echo "Installing server dependencies..."
    npm ci --production || npm install --production
    
    # Handle client build/download
    if [ "$MINIMAL_INSTALL" = true ]; then
        echo -e "${YELLOW}Minimal install mode - skipping client build${NC}"
        echo -e "${YELLOW}You can build the client later with: cd client && npm install && npm run build${NC}"
        mkdir -p client/dist
        echo "<html><body><h1>MuxTerm Client Not Built</h1><p>Run 'npm install && npm run build' in the client directory</p></body></html>" > client/dist/index.html
    else
        # Check for pre-built client
        echo -e "${BLUE}Checking for pre-built client...${NC}"
        RELEASE_URL="https://api.github.com/repos/tecnologicachile/muxterm/releases/latest"
        
        if command -v curl &> /dev/null; then
            RELEASE_INFO=$(curl -s $RELEASE_URL 2>/dev/null || echo "")
            DOWNLOAD_URL=$(echo $RELEASE_INFO | grep -o '"browser_download_url": "[^"]*client-dist.tar.gz"' | cut -d'"' -f4 || true)
        else
            DOWNLOAD_URL=""
        fi
        
        if [ -n "$DOWNLOAD_URL" ]; then
            echo -e "${GREEN}Found pre-built client! Downloading...${NC}"
            curl -L -o client-dist.tar.gz "$DOWNLOAD_URL"
            mkdir -p client
            tar -xzf client-dist.tar.gz -C client/
            rm client-dist.tar.gz
            echo -e "${GREEN}Client downloaded successfully!${NC}"
        else
            echo -e "${YELLOW}No pre-built client found. Building from source...${NC}"
            echo -e "${YELLOW}This may take 3-5 minutes...${NC}"
            cd client
            npm ci --silent || npm install --silent
            npm run build
            cd ..
        fi
    fi
    
    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        echo -e "${YELLOW}Warning: openssl not found, using fallback for secrets${NC}"
        JWT_SECRET="muxterm-jwt-secret-$(date +%s)-CHANGE-THIS"
        SESSION_SECRET="muxterm-session-secret-$(date +%s)-CHANGE-THIS"
    else
        JWT_SECRET=$(openssl rand -base64 32)
        SESSION_SECRET=$(openssl rand -base64 32)
    fi
    
    # Create default .env
    if [ ! -f .env ]; then
        echo -e "${BLUE}Creating configuration file...${NC}"
        cat > .env << EOF
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
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
    
    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        echo -e "${YELLOW}systemd not found, skipping service creation${NC}"
        echo -e "${YELLOW}You'll need to start MuxTerm manually${NC}"
        return
    fi
    
    if [ -f /etc/systemd/system/muxterm.service ]; then
        echo -e "${YELLOW}Service already exists${NC}"
        return
    fi
    
    INSTALL_DIR=$(pwd)
    USER=$(whoami)
    
    $USE_SUDO tee /etc/systemd/system/muxterm.service > /dev/null << EOF
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

    $USE_SUDO systemctl daemon-reload
    echo -e "${GREEN}Systemd service created${NC}"
    
    # Create global tmux config as fallback for production environments
    echo -e "${BLUE}Creating global tmux configuration...${NC}"
    $USE_SUDO tee /etc/tmux.conf > /dev/null << 'EOF'
# MuxTerm global tmux configuration
# Make tmux completely invisible and non-interactive

# Disable status bar
set -g status off

# Disable ALL tmux hotkeys
set -g prefix None
unbind-key -a
unbind-key -T copy-mode -a
unbind-key -T copy-mode-vi -a

# Disable tmux mouse completely
set -g mouse off

# No pane borders
set -g pane-border-style none
set -g pane-active-border-style none

# No visual notifications
set -g visual-activity off
set -g visual-bell off
set -g visual-silence off
set -g bell-action none

# Default shell
set -g default-shell /bin/bash
EOF
    echo -e "${GREEN}Global tmux config created${NC}"
}

setup_nginx() {
    if [ "$NON_INTERACTIVE" = true ]; then
        echo -e "${YELLOW}Skipping Nginx setup in non-interactive mode${NC}"
        return
    fi
    
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
                $USE_SUDO apt-get install -y nginx
                ;;
            fedora|centos|rhel)
                $USE_SUDO dnf install -y nginx || $USE_SUDO yum install -y nginx
                ;;
            arch|manjaro)
                $USE_SUDO pacman -S --noconfirm nginx
                ;;
        esac
    fi
    
    # Get domain
    read -p "Enter your domain name (e.g., muxterm.example.com): " DOMAIN
    
    # Create nginx config
    $USE_SUDO tee /etc/nginx/sites-available/muxterm > /dev/null << EOF
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
    $USE_SUDO ln -sf /etc/nginx/sites-available/muxterm /etc/nginx/sites-enabled/
    $USE_SUDO nginx -t && $USE_SUDO systemctl reload nginx
    
    echo -e "${GREEN}Nginx configured for $DOMAIN${NC}"
    echo -e "${YELLOW}Don't forget to setup SSL with certbot!${NC}"
}

start_service() {
    echo -e "${BLUE}Starting MuxTerm service...${NC}"
    
    # Try to start with systemd
    if command -v systemctl &> /dev/null && [ -f /etc/systemd/system/muxterm.service ]; then
        $USE_SUDO systemctl daemon-reload
        $USE_SUDO systemctl start muxterm
        
        # Wait for service to start
        sleep 2
        
        if systemctl is-active --quiet muxterm; then
            echo -e "${GREEN}MuxTerm service started successfully!${NC}"
            STARTED_WITH_SYSTEMD=true
        else
            echo -e "${YELLOW}Systemd service failed to start. Starting manually...${NC}"
            STARTED_WITH_SYSTEMD=false
        fi
    else
        STARTED_WITH_SYSTEMD=false
    fi
    
    # Start manually if systemd failed
    if [ "$STARTED_WITH_SYSTEMD" = false ]; then
        echo -e "${BLUE}Starting MuxTerm in background...${NC}"
        nohup npm start > logs/muxterm.log 2>&1 &
        MUXTERM_PID=$!
        sleep 3
        
        if kill -0 $MUXTERM_PID 2>/dev/null; then
            echo -e "${GREEN}MuxTerm started successfully! (PID: $MUXTERM_PID)${NC}"
            echo $MUXTERM_PID > muxterm.pid
        else
            echo -e "${RED}Failed to start MuxTerm${NC}"
            return 1
        fi
    fi
}

check_tmux() {
    if ! command -v tmux &> /dev/null; then
        echo -e "${YELLOW}⚠️  WARNING: tmux is not installed!${NC}"
        echo -e "${YELLOW}Sessions will not persist without tmux.${NC}"
        echo -e "${YELLOW}Please install tmux for full functionality.${NC}"
        echo
    fi
}

print_success() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════╗"
    echo "║    MuxTerm Installation Complete!    ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    
    # Check if MuxTerm is actually running
    MUXTERM_RUNNING=false
    if systemctl is-active --quiet muxterm 2>/dev/null; then
        MUXTERM_RUNNING=true
    elif [ -f muxterm.pid ] && kill -0 $(cat muxterm.pid) 2>/dev/null; then
        MUXTERM_RUNNING=true
    fi
    
    # Get IP addresses
    LOCAL_IP="localhost"
    if command -v hostname &> /dev/null; then
        HOSTNAME=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$HOSTNAME" ]; then
            LOCAL_IP=$HOSTNAME
        fi
    fi
    
    if [ "$MUXTERM_RUNNING" = true ]; then
        echo -e "${BLUE}▶ MuxTerm is running!${NC}"
        echo
        echo "Access MuxTerm at:"
        echo -e "  ${GREEN}http://localhost:3002${NC}"
        if [ "$LOCAL_IP" != "localhost" ]; then
            echo -e "  ${GREEN}http://$LOCAL_IP:3002${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ MuxTerm is installed but NOT running${NC}"
        echo
        echo "To start MuxTerm:"
        echo -e "  ${GREEN}cd ~/muxterm && npm start${NC}"
        echo "  OR"
        echo -e "  ${GREEN}sudo systemctl start muxterm${NC}"
    fi
    
    echo
    echo "Default credentials:"
    echo -e "  Username: ${YELLOW}test${NC}"
    echo -e "  Password: ${YELLOW}test123${NC}"
    echo
    echo "Useful commands:"
    if [ "$MUXTERM_RUNNING" = true ]; then
        echo "  Stop:    sudo systemctl stop muxterm"
        echo "  Restart: sudo systemctl restart muxterm"
        echo "  Logs:    journalctl -u muxterm -f"
    else
        echo "  Start:   cd ~/muxterm && npm start"
        echo "  Service: sudo systemctl start muxterm"
    fi
    echo "  Update:  cd ~/muxterm && ./update.sh"
    echo
    if [ -f muxterm.pid ]; then
        echo "Manual stop: kill \$(cat muxterm.pid)"
    fi
    echo
}

# Main installation flow
main() {
    print_banner
    detect_os
    check_root
    
    echo -e "${BLUE}Detected OS: $OS $VER${NC}"
    echo
    
    # New checks before installing
    check_basic_deps
    configure_locales
    check_memory
    
    install_dependencies
    install_nodejs
    clone_repository
    setup_muxterm
    create_systemd_service
    
    # Auto-start MuxTerm without asking
    echo
    echo -e "${BLUE}Starting MuxTerm service...${NC}"
    start_service
    
    setup_nginx
    check_tmux
    print_success
}

# Run main with all arguments
main "$@"