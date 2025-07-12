#!/bin/bash

# MuxTerm Update Script
# This script updates MuxTerm to the latest version while preserving user data

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="tecnologicachile/muxterm"
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="muxterm"
BACKUP_DIR="/tmp/muxterm-backup-$(date +%Y%m%d%H%M%S)"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to check dependencies
check_dependencies() {
    local deps=("curl" "git" "npm")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            print_color "Error: $dep is not installed" "$RED"
            exit 1
        fi
    done
}

# Function to get latest version
get_latest_version() {
    local latest=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$latest" ]; then
        print_color "Failed to fetch latest version" "$RED"
        exit 1
    fi
    echo "$latest"
}

# Function to get current version
get_current_version() {
    if [ -f "package.json" ]; then
        local version=$(grep '"version":' "package.json" | sed -E 's/.*"([^"]+)".*/\1/')
        echo "v$version"
    else
        echo "unknown"
    fi
}

# Function to check if systemd service exists
service_exists() {
    systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"
}

# Main update process
main() {
    print_color "MuxTerm Update Script" "$BLUE"
    echo "===================="
    
    # Check requirements
    check_dependencies
    
    # Get versions
    print_color "\nChecking versions..." "$YELLOW"
    CURRENT_VERSION=$(get_current_version)
    LATEST_VERSION=$(get_latest_version)
    
    print_color "Current version: $CURRENT_VERSION" "$BLUE"
    print_color "Latest version: $LATEST_VERSION" "$BLUE"
    
    # Check if update needed
    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
        print_color "\nMuxTerm is already up to date!" "$GREEN"
        exit 0
    fi
    
    # Confirm update
    echo ""
    read -p "Do you want to update MuxTerm? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_color "Update cancelled" "$YELLOW"
        exit 0
    fi
    
    # Create backup
    print_color "\nCreating backup..." "$YELLOW"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if [ -f "data/webssh.db" ]; then
        cp -p "data/webssh.db" "$BACKUP_DIR/"
        print_color "Database backed up" "$GREEN"
    fi
    
    # Backup .env
    if [ -f ".env" ]; then
        cp -p ".env" "$BACKUP_DIR/"
        print_color "Environment config backed up" "$GREEN"
    fi
    
    # Backup tmux config
    if [ -f ".tmux.webssh.conf" ]; then
        cp -p ".tmux.webssh.conf" "$BACKUP_DIR/"
        print_color "Tmux config backed up" "$GREEN"
    fi
    
    # Stop service if running
    if service_exists; then
        print_color "\nStopping MuxTerm service..." "$YELLOW"
        sudo systemctl stop "$SERVICE_NAME" || true
    fi
    
    # Stash local changes
    if [ -d ".git" ]; then
        print_color "\nStashing local changes..." "$YELLOW"
        git stash || true
    fi
    
    # Update via git
    print_color "\nUpdating MuxTerm..." "$YELLOW"
    if [ -d ".git" ]; then
        git fetch --tags
        git checkout "$LATEST_VERSION"
    else
        # If not a git repo, download the release
        print_color "Downloading latest release..." "$YELLOW"
        curl -L "https://github.com/$REPO/archive/refs/tags/$LATEST_VERSION.tar.gz" -o "/tmp/muxterm-$LATEST_VERSION.tar.gz"
        tar -xzf "/tmp/muxterm-$LATEST_VERSION.tar.gz" -C /tmp
        rsync -av --exclude='data' --exclude='.env' --exclude='node_modules' --exclude='client/node_modules' \
              "/tmp/muxterm-${LATEST_VERSION#v}/" "$INSTALL_DIR/"
        rm -rf "/tmp/muxterm-$LATEST_VERSION.tar.gz" "/tmp/muxterm-${LATEST_VERSION#v}"
    fi
    
    # Install dependencies
    print_color "\nInstalling dependencies..." "$YELLOW"
    npm install --production
    
    # Build client
    print_color "\nBuilding client..." "$YELLOW"
    cd client
    npm install
    npm run build
    cd ..
    
    # Restore data
    print_color "\nRestoring data..." "$YELLOW"
    if [ -f "$BACKUP_DIR/webssh.db" ] && [ ! -f "data/webssh.db" ]; then
        mkdir -p data
        cp -p "$BACKUP_DIR/webssh.db" "data/"
    fi
    if [ -f "$BACKUP_DIR/.env" ] && [ ! -f ".env" ]; then
        cp -p "$BACKUP_DIR/.env" .
    fi
    if [ -f "$BACKUP_DIR/.tmux.webssh.conf" ] && [ ! -f ".tmux.webssh.conf" ]; then
        cp -p "$BACKUP_DIR/.tmux.webssh.conf" .
    fi
    
    # Start service if it was running
    if service_exists; then
        print_color "\nStarting MuxTerm service..." "$YELLOW"
        sudo systemctl start "$SERVICE_NAME"
        
        # Verify service
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_color "Service is running" "$GREEN"
        else
            print_color "Service failed to start" "$RED"
            print_color "Check logs: journalctl -u $SERVICE_NAME -n 50" "$YELLOW"
        fi
    fi
    
    print_color "\n✓ MuxTerm updated successfully to $LATEST_VERSION!" "$GREEN"
    print_color "\nBackup location: $BACKUP_DIR" "$BLUE"
    
    if ! service_exists; then
        print_color "\nTo start MuxTerm manually:" "$YELLOW"
        print_color "  npm start" "$BLUE"
    fi
    
    print_color "\nActive tmux sessions have been preserved." "$GREEN"
    
    # Star on GitHub reminder
    echo
    print_color "⭐ Enjoying the new features? Star us on GitHub!" "$YELLOW"
    print_color "   https://github.com/tecnologicachile/muxterm" "$BLUE"
}

# Run main function
main "$@"