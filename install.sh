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
AUTO_DETECTED_MINIMAL=false
IS_DOCKER=false
IS_LXC=false
IS_CI=false

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

detect_environment() {
    echo -e "${BLUE}Detecting environment...${NC}"
    
    # Detect if running in Docker
    if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        IS_DOCKER=true
        echo -e "${GREEN}✓ Docker environment detected${NC}"
    fi
    
    # Detect if running in LXC
    if grep -qa lxc /proc/1/cgroup 2>/dev/null || [ -f /run/systemd/container ]; then
        IS_LXC=true
        echo -e "${GREEN}✓ LXC container detected${NC}"
    fi
    
    # Detect if running in CI/CD
    if [ -n "$CI" ] || [ -n "$CONTINUOUS_INTEGRATION" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ]; then
        IS_CI=true
        NON_INTERACTIVE=true
        echo -e "${GREEN}✓ CI/CD environment detected - enabling non-interactive mode${NC}"
    fi
    
    # Detect if stdin is not a terminal (piped install)
    if [ ! -t 0 ]; then
        NON_INTERACTIVE=true
        echo -e "${GREEN}✓ Non-interactive mode detected${NC}"
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
        
        echo -e "${BLUE}System memory: ${TOTAL_MEM_MB}MB${NC}"
        
        if [ "$TOTAL_MEM_MB" -lt 1024 ]; then
            if [ "$MINIMAL_INSTALL" = false ]; then
                echo -e "${YELLOW}✓ Low memory detected - automatically enabling minimal mode${NC}"
                MINIMAL_INSTALL=true
                AUTO_DETECTED_MINIMAL=true
            fi
        elif [ "$TOTAL_MEM_MB" -lt 512 ]; then
            echo -e "${RED}⚠️  WARNING: Very low memory (${TOTAL_MEM_MB}MB)${NC}"
            echo -e "${RED}Installation may fail. Consider using a system with more memory.${NC}"
            
            if [ "$NON_INTERACTIVE" = false ]; then
                read -p "Continue anyway? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
        else
            echo -e "${GREEN}✓ Sufficient memory for full installation${NC}"
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

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

setup_muxterm() {
    echo -e "${BLUE}Setting up MuxTerm...${NC}"
    
    # Install server dependencies
    print_info "Installing server dependencies..."
    npm ci --production --silent || npm install --production --silent
    print_status "Server dependencies installed"
    
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
    
    # Install muxterm command globally
    echo -e "${BLUE}Installing muxterm command...${NC}"
    if [ -f scripts/muxterm ]; then
        $USE_SUDO cp scripts/muxterm /usr/local/bin/muxterm
        $USE_SUDO chmod +x /usr/local/bin/muxterm
        echo -e "${GREEN}muxterm command installed${NC}"
        
        # Ensure /usr/local/bin is in PATH
        if ! echo "$PATH" | grep -q "/usr/local/bin"; then
            echo -e "${YELLOW}Adding /usr/local/bin to PATH...${NC}"
            
            # Add to system-wide profile for all users
            if [ -f /etc/profile ]; then
                echo 'export PATH=$PATH:/usr/local/bin' | $USE_SUDO tee -a /etc/profile > /dev/null
            fi
            
            # Add to root's bashrc if we're in a container
            if [ "$IS_DOCKER" = true ] || [ "$IS_LXC" = true ]; then
                echo 'export PATH=$PATH:/usr/local/bin' | $USE_SUDO tee -a /root/.bashrc > /dev/null
            fi
            
            # Export for current session
            export PATH=$PATH:/usr/local/bin
            echo -e "${GREEN}PATH updated${NC}"
            
            # Additional notice for containers
            if [ "$IS_DOCKER" = true ] || [ "$IS_LXC" = true ]; then
                echo -e "${YELLOW}Note: You may need to run 'source /root/.bashrc' or logout/login for PATH changes to take effect${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}muxterm command script not found${NC}"
    fi
}

create_systemd_service() {
    echo -e "${BLUE}Creating systemd service...${NC}"
    
    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        echo -e "${YELLOW}systemd not found, skipping service creation${NC}"
        echo -e "${YELLOW}You'll need to start MuxTerm manually${NC}"
        return
    fi
    
    # Get the actual installation directory
    INSTALL_DIR=$(pwd)
    
    # Verify we're not in Windows filesystem
    if [[ "$INSTALL_DIR" == /mnt/* ]]; then
        echo -e "${RED}ERROR: Installation directory is still in Windows filesystem${NC}"
        echo -e "${RED}This will cause permission and service issues${NC}"
        echo -e "${YELLOW}Please run the installer from your home directory:${NC}"
        echo -e "${YELLOW}cd ~ && curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash${NC}"
        exit 1
    fi
    
    # Check if service exists with wrong path
    if [ -f /etc/systemd/system/muxterm.service ]; then
        EXISTING_PATH=$(grep "WorkingDirectory=" /etc/systemd/system/muxterm.service | cut -d'=' -f2)
        if [[ "$EXISTING_PATH" == /mnt/* ]]; then
            echo -e "${YELLOW}Found existing service with Windows filesystem path${NC}"
            echo -e "${YELLOW}Removing and recreating service...${NC}"
            $USE_SUDO systemctl stop muxterm 2>/dev/null || true
            $USE_SUDO systemctl disable muxterm 2>/dev/null || true
            $USE_SUDO rm -f /etc/systemd/system/muxterm.service
            $USE_SUDO systemctl daemon-reload
        else
            echo -e "${YELLOW}Service already exists${NC}"
            return
        fi
    fi
    
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
        
        # Enable service for automatic startup
        echo -e "${BLUE}Enabling service for automatic startup...${NC}"
        $USE_SUDO systemctl enable muxterm
        
        # Start the service
        $USE_SUDO systemctl start muxterm
        
        # Wait for service to start
        sleep 2
        
        if systemctl is-active --quiet muxterm; then
            echo -e "${GREEN}MuxTerm service started successfully!${NC}"
            if systemctl is-enabled --quiet muxterm; then
                echo -e "${GREEN}Service enabled for automatic startup${NC}"
            fi
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
        echo "  Status:  sudo systemctl status muxterm"
        echo "  Logs:    journalctl -u muxterm -f"
        echo "  Disable: sudo systemctl disable muxterm"
    else
        echo "  Start:   cd ~/muxterm && npm start"
        echo "  Service: sudo systemctl start muxterm"
    fi
    # Check if muxterm is in PATH
    if ! command -v muxterm &> /dev/null; then
        echo "  Update:  /usr/local/bin/muxterm update"
        echo
        echo -e "${YELLOW}Note: 'muxterm' command not in PATH${NC}"
        echo -e "Run this to fix: ${GREEN}export PATH=\$PATH:/usr/local/bin${NC}"
        echo -e "Or add to ~/.bashrc: ${GREEN}echo 'export PATH=\$PATH:/usr/local/bin' >> ~/.bashrc${NC}"
    else
        echo "  Update:  muxterm update"
    fi
    echo
    if [ -f muxterm.pid ]; then
        echo "Manual stop: kill \$(cat muxterm.pid)"
    fi
    echo
    
    # Star on GitHub message
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}⭐ Enjoying MuxTerm? Star us on GitHub!${NC}"
    echo -e "   It helps others discover the project and motivates development"
    echo -e "   ${GREEN}https://github.com/tecnologicachile/muxterm${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
}

# Main installation flow
main() {
    print_banner
    
    # Detection phase
    detect_os
    detect_environment
    check_root
    
    echo -e "${BLUE}System information:${NC}"
    echo -e "  OS: $OS $VER"
    if [ "$IS_DOCKER" = true ]; then echo -e "  Environment: Docker"; fi
    if [ "$IS_LXC" = true ]; then echo -e "  Environment: LXC"; fi
    if [ "$IS_CI" = true ]; then echo -e "  Environment: CI/CD"; fi
    echo
    
    # Check if we're starting from Windows filesystem
    if [[ "$PWD" == /mnt/* ]]; then
        echo -e "${YELLOW}Warning: Script started from Windows filesystem (/mnt/*)${NC}"
        echo -e "${YELLOW}This can cause permission and service issues${NC}"
        echo -e "${GREEN}Recommendation: Run from your home directory:${NC}"
        echo -e "${GREEN}cd ~ && curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash${NC}"
        echo
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Installation cancelled${NC}"
            exit 0
        fi
    fi
    
    # Pre-installation checks
    check_basic_deps
    configure_locales
    check_memory
    
    # Installation phase
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
    
    # Offer Windows autostart configuration for WSL users
    configure_windows_autostart
    
    print_success
}

configure_windows_autostart() {
    # Only proceed if we're in WSL and systemd is available
    if [[ -z "$WSL_DISTRO_NAME" ]] && ! grep -qi microsoft /proc/version 2>/dev/null; then
        return
    fi
    
    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        return
    fi
    
    # Check if we can execute commands from Windows
    if ! command -v wsl.exe &> /dev/null || ! command -v powershell.exe &> /dev/null; then
        return
    fi
    
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}WSL Windows Integration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    if [ "$NON_INTERACTIVE" = "true" ]; then
        echo -e "${YELLOW}Skipping Windows autostart configuration (non-interactive mode)${NC}"
        return
    fi
    
    echo -e "${YELLOW}Would you like MuxTerm to start automatically when Windows boots?${NC}"
    echo -e "This will create a Windows scheduled task to start WSL and MuxTerm"
    echo
    read -p "Configure Windows autostart? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_windows_task
    else
        echo -e "${YELLOW}Skipping Windows autostart configuration${NC}"
        echo -e "You can run 'muxterm configure-windows-autostart' later to set this up"
    fi
}

setup_windows_task() {
    echo -e "${BLUE}Setting up Windows autostart...${NC}"
    
    # Get WSL distribution name
    WSL_DISTRO="${WSL_DISTRO_NAME:-$(grep -oP '(?<=^ID=).+' /etc/os-release | tr -d '"')}"
    
    # Verify we can run systemctl from Windows
    echo -e "${BLUE}Verifying WSL integration...${NC}"
    if ! wsl.exe -d "$WSL_DISTRO" -u root bash -c "systemctl --version" &>/dev/null; then
        echo -e "${RED}Cannot execute systemctl from Windows${NC}"
        echo -e "${YELLOW}This might be due to WSL1 or systemd not being enabled${NC}"
        create_startup_batch
        return
    fi
    
    # Create PowerShell script
    cat > /tmp/muxterm-autostart.ps1 << EOF
\$ErrorActionPreference = "Stop"
\$taskName = "MuxTerm-AutoStart"
\$wslDistro = "$WSL_DISTRO"

Write-Host "Creating MuxTerm autostart task..." -ForegroundColor Blue

try {
    # Check if running as administrator
    \$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    \$isAdmin = \$currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    # Remove existing task if present
    \$existingTask = Get-ScheduledTask -TaskName \$taskName -ErrorAction SilentlyContinue
    if (\$existingTask) {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName \$taskName -Confirm:\$false
    }
    
    # Create the action
    \$action = New-ScheduledTaskAction -Execute "wsl.exe" \`
        -Argument "-d \$wslDistro -u root -- systemctl start muxterm"
    
    # Create trigger for Windows startup
    \$trigger = New-ScheduledTaskTrigger -AtStartup
    
    # Create settings
    \$settings = New-ScheduledTaskSettingsSet \`
        -AllowStartIfOnBatteries \`
        -DontStopIfGoingOnBatteries \`
        -StartWhenAvailable \`
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5) \`
        -RestartCount 3 \`
        -RestartInterval (New-TimeSpan -Minutes 1)
    
    if (\$isAdmin) {
        # If admin, create with highest privileges
        \$principal = New-ScheduledTaskPrincipal \`
            -UserId "\$env:USERNAME" \`
            -LogonType ServiceAccount \`
            -RunLevel Highest
    } else {
        # If not admin, create with limited privileges
        \$principal = New-ScheduledTaskPrincipal \`
            -UserId "\$env:USERNAME" \`
            -LogonType InteractiveToken
    }
    
    # Register the task
    \$task = Register-ScheduledTask \`
        -TaskName \$taskName \`
        -Action \$action \`
        -Trigger \$trigger \`
        -Settings \$settings \`
        -Principal \$principal \`
        -Description "Starts MuxTerm service in WSL on Windows startup"
    
    Write-Host "MuxTerm autostart task created successfully!" -ForegroundColor Green
    Write-Host "The task will run at next Windows startup" -ForegroundColor Green
    
} catch {
    Write-Host "Failed to create scheduled task: \$_" -ForegroundColor Red
    exit 1
}
EOF
    
    # Execute PowerShell script
    if powershell.exe -ExecutionPolicy Bypass -File "\\\\wsl\$\\$WSL_DISTRO\\tmp\\muxterm-autostart.ps1" 2>/dev/null; then
        echo -e "${GREEN}✓ Windows scheduled task created successfully!${NC}"
        echo -e "${GREEN}✓ MuxTerm will start automatically when Windows boots${NC}"
        echo
        echo -e "${YELLOW}To remove this task later, run:${NC}"
        echo -e "  powershell.exe -Command \"Unregister-ScheduledTask -TaskName 'MuxTerm-AutoStart' -Confirm:\\\$false\""
        echo
    else
        echo -e "${YELLOW}Could not create scheduled task with current permissions${NC}"
        echo -e "${YELLOW}Trying alternative method...${NC}"
        create_startup_batch
    fi
    
    # Clean up
    rm -f /tmp/muxterm-autostart.ps1
}

create_startup_batch() {
    echo -e "${BLUE}Creating startup batch file...${NC}"
    
    # Get Windows startup folder
    local startup_folder
    startup_folder=$(powershell.exe -Command 'echo $env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup' 2>/dev/null | tr -d '\r\n')
    
    if [ -z "$startup_folder" ]; then
        echo -e "${RED}Could not determine Windows startup folder${NC}"
        return 1
    fi
    
    # Convert to WSL path
    local wsl_startup
    wsl_startup=$(wslpath "$startup_folder" 2>/dev/null)
    
    if [ ! -d "$wsl_startup" ]; then
        echo -e "${RED}Cannot access Windows startup folder from WSL${NC}"
        return 1
    fi
    
    # Create batch file
    local batch_file="$wsl_startup/MuxTerm-Start.bat"
    cat > "$batch_file" << EOF
@echo off
title Starting MuxTerm...
wsl -d ${WSL_DISTRO_NAME} -u root -- bash -c "systemctl start muxterm 2>/dev/null || echo MuxTerm service not found"
exit
EOF
    
    if [ -f "$batch_file" ]; then
        echo -e "${GREEN}✓ Startup batch file created successfully!${NC}"
        echo -e "${GREEN}✓ MuxTerm will start when you log into Windows${NC}"
        echo -e "${YELLOW}Note: A console window will appear briefly at startup${NC}"
        echo
        echo -e "${YELLOW}To remove autostart later, delete:${NC}"
        echo -e "  $batch_file"
        echo
    else
        echo -e "${RED}Failed to create startup batch file${NC}"
        return 1
    fi
}

# Run main with all arguments
main "$@"