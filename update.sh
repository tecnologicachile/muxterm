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
LOG_DIR="$INSTALL_DIR/logs/updates"
LOG_FILE="$LOG_DIR/update-$(date +%Y%m%d-%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Function to log error and exit
log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $1" | tee -a "$LOG_FILE" >&2
    echo "[$timestamp] Update failed. Check log at: $LOG_FILE" | tee -a "$LOG_FILE"
    exit 1
}

# Function to execute and log commands
exec_log() {
    local cmd="$1"
    local desc="$2"
    log "Executing: $desc"
    log "Command: $cmd"
    if eval "$cmd" >> "$LOG_FILE" 2>&1; then
        log "✓ Success: $desc"
        return 0
    else
        log_error "Failed: $desc"
        return 1
    fi
}

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
    log "$1"
}

# Function to check dependencies
check_dependencies() {
    local deps=("curl" "git" "npm" "node")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            print_color "Error: $dep is not installed" "$RED"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node -v | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    if [ "$major_version" -lt 14 ]; then
        print_color "Warning: Node.js version is $node_version. Version 14+ recommended" "$YELLOW"
    fi
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
    
    # Log system information
    log "=== MuxTerm Update Started ==="
    log "Date: $(date)"
    log "User: $(whoami)"
    log "Install Directory: $INSTALL_DIR"
    log "Node Version: $(node -v)"
    log "NPM Version: $(npm -v)"
    log "OS: $(uname -a)"
    
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
        exec_log "sudo systemctl stop $SERVICE_NAME || true" "Stopping MuxTerm service"
    fi
    
    # Stash local changes
    if [ -d ".git" ]; then
        print_color "\nStashing local changes..." "$YELLOW"
        exec_log "git stash || true" "Stashing local changes"
    fi
    
    # Update via git
    print_color "\nUpdating MuxTerm..." "$YELLOW"
    if [ -d ".git" ]; then
        exec_log "git fetch --tags" "Fetching latest tags"
        exec_log "git checkout $LATEST_VERSION" "Checking out version $LATEST_VERSION"
    else
        # If not a git repo, download the release
        print_color "Downloading latest release..." "$YELLOW"
        curl -L "https://github.com/$REPO/archive/refs/tags/$LATEST_VERSION.tar.gz" -o "/tmp/muxterm-$LATEST_VERSION.tar.gz"
        tar -xzf "/tmp/muxterm-$LATEST_VERSION.tar.gz" -C /tmp
        rsync -av --exclude='data' --exclude='.env' --exclude='node_modules' --exclude='client/node_modules' \
              "/tmp/muxterm-${LATEST_VERSION#v}/" "$INSTALL_DIR/"
        rm -rf "/tmp/muxterm-$LATEST_VERSION.tar.gz" "/tmp/muxterm-${LATEST_VERSION#v}"
    fi
    
    # Install backend dependencies
    print_color "\nInstalling backend dependencies..." "$YELLOW"
    exec_log "npm install --production" "Installing backend dependencies"
    
    # Build client
    print_color "\nBuilding client..." "$YELLOW"
    cd client
    
    # Check if node_modules exists and if package.json has changed
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_color "Installing client dependencies..." "$BLUE"
        exec_log "npm install" "Installing client dependencies"
    fi
    
    # Always rebuild to ensure latest version
    print_color "Compiling frontend..." "$BLUE"
    exec_log "npm run build" "Building client"
    
    if [ $? -eq 0 ]; then
        print_color "✓ Frontend compiled successfully" "$GREEN"
        
        # Verify dist directory was created
        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            print_color "✓ Frontend files verified" "$GREEN"
            
            # Copy to public directory
            cd ..
            print_color "Copying frontend files to public directory..." "$BLUE"
            mkdir -p public
            exec_log "cp -r client/dist/* public/" "Copying frontend to public directory"
            
            # Verify copy was successful
            if [ -f "public/index.html" ]; then
                print_color "✓ Frontend deployed to public directory" "$GREEN"
            else
                log_error "Failed to copy frontend files to public directory"
            fi
        else
            print_color "⚠ Warning: dist directory may be incomplete" "$YELLOW"
            cd ..
        fi
    else
        print_color "✗ Frontend compilation failed" "$RED"
        print_color "You may need to compile manually: cd client && npm run build" "$YELLOW"
        cd ..
    fi
    
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
        exec_log "sudo systemctl start $SERVICE_NAME" "Starting MuxTerm service"
        
        # Verify service with retries
        local retry_count=0
        local max_retries=10
        
        while [ $retry_count -lt $max_retries ]; do
            sleep 2
            if systemctl is-active --quiet "$SERVICE_NAME"; then
                print_color "Service is running" "$GREEN"
                break
            else
                retry_count=$((retry_count + 1))
                print_color "Waiting for service to start... ($retry_count/$max_retries)" "$YELLOW"
            fi
        done
        
        if [ $retry_count -eq $max_retries ]; then
            print_color "Service failed to start after $max_retries attempts" "$RED"
            print_color "Check logs: journalctl -u $SERVICE_NAME -n 50" "$YELLOW"
            log_error "Service failed to start after multiple attempts"
        fi
    fi
    
    print_color "\n✓ MuxTerm updated successfully to $LATEST_VERSION!" "$GREEN"
    print_color "\nBackup location: $BACKUP_DIR" "$BLUE"
    
    # Log summary
    log "=== Update Completed Successfully ==="
    log "Updated from: $CURRENT_VERSION to $LATEST_VERSION"
    log "Backup location: $BACKUP_DIR"
    log "Update log: $LOG_FILE"
    
    if ! service_exists; then
        print_color "\nTo start MuxTerm manually:" "$YELLOW"
        print_color "  npm start" "$BLUE"
    fi
    
    print_color "\nActive tmux sessions have been preserved." "$GREEN"
    
    # Star on GitHub reminder
    echo
    print_color "⭐ Enjoying the new features? Star us on GitHub!" "$YELLOW"
    print_color "   https://github.com/tecnologicachile/muxterm" "$BLUE"
    
    # Show log location
    echo
    print_color "📄 Update log saved at: $LOG_FILE" "$BLUE"
}

# Trap errors to show log location
trap 'echo -e "\n${RED}Error occurred during update. Check the log:${NC}\n${BLUE}$LOG_FILE${NC}"' ERR

# Run main function
main "$@"