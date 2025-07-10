#!/bin/bash
# MuxTerm WSL Quick Installer - Optimized for Windows Subsystem for Linux

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MuxTerm WSL Quick Installer${NC}"
echo "=========================="
echo

# Quick dependency check
echo "Checking dependencies..."
if ! command -v node &> /dev/null || ! command -v tmux &> /dev/null; then
    echo "Installing required packages..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq nodejs npm tmux curl git > /dev/null 2>&1
fi

# Clone or update
if [ -d "muxterm" ]; then
    cd muxterm && git pull -q
else
    git clone -q https://github.com/tecnologicachile/muxterm.git
    cd muxterm
fi

# Download pre-built client
echo "Downloading pre-built client..."
RELEASE=$(curl -s https://api.github.com/repos/tecnologicachile/muxterm/releases/latest)
URL=$(echo $RELEASE | grep -o '"browser_download_url": "[^"]*client-dist.tar.gz"' | cut -d'"' -f4)

if [ -n "$URL" ]; then
    curl -sL "$URL" | tar -xz -C . 2>/dev/null || {
        echo "Building from source (this may take a few minutes)..."
        cd client && npm ci -s && npm run build -s && cd ..
    }
else
    echo "Building from source (this may take a few minutes)..."
    cd client && npm ci -s && npm run build -s && cd ..
fi

# Install server deps
npm ci -s --production

# Create config
[ -f .env ] || echo -e "JWT_SECRET=$(openssl rand -base64 32)\nPORT=3002" > .env

# Create directories
mkdir -p data logs sessions

# Start in background
echo -e "${BLUE}Starting MuxTerm...${NC}"
nohup npm start > logs/muxterm.log 2>&1 &
PID=$!
echo $PID > muxterm.pid
sleep 2

# Get WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')

echo
echo -e "${GREEN}✓ MuxTerm is running!${NC}"
echo
echo "Access from WSL:"
echo -e "  ${GREEN}http://localhost:3002${NC}"
echo
echo "Access from Windows:"
echo -e "  ${GREEN}http://${WSL_IP}:3002${NC}"
echo
echo "Default login:"
echo -e "  Username: ${YELLOW}test${NC}"
echo -e "  Password: ${YELLOW}test123${NC}"
echo
echo "Stop: kill \$(cat muxterm.pid)"
echo