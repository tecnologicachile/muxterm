#!/bin/bash

# WebSSH Update Script
# This script updates the WebSSH application while preserving user data

echo "WebSSH Update Script"
echo "==================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run this script as root"
   exit 1
fi

# Save current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if git repo
if [ ! -d ".git" ]; then
    echo "Error: This directory is not a git repository"
    echo "Please run this script from the WebSSH installation directory"
    exit 1
fi

# Create backup of important files
echo "Creating backup of configuration..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database if exists
if [ -f "data/webssh.db" ]; then
    echo "Backing up database..."
    cp -p "data/webssh.db" "$BACKUP_DIR/"
fi

# Backup .env if exists
if [ -f ".env" ]; then
    echo "Backing up environment configuration..."
    cp -p ".env" "$BACKUP_DIR/"
fi

# Backup tmux config if exists
if [ -f ".tmux.webssh.conf" ]; then
    echo "Backing up tmux configuration..."
    cp -p ".tmux.webssh.conf" "$BACKUP_DIR/"
fi

# Show current version
echo ""
echo "Current version:"
git log -1 --oneline

# Fetch latest changes
echo ""
echo "Fetching latest changes..."
git fetch origin

# Show what will be updated
echo ""
echo "Changes to be applied:"
git log HEAD..origin/main --oneline

# Ask for confirmation
echo ""
read -p "Do you want to proceed with the update? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Update cancelled."
    exit 1
fi

# Stash any local changes
echo ""
echo "Stashing local changes..."
git stash

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install/update dependencies
echo ""
echo "Updating dependencies..."
npm install

# Build client
echo ""
echo "Building client..."
cd client
npm install
npm run build
cd ..

# Apply stashed changes if any
if git stash list | grep -q "stash@{0}"; then
    echo ""
    echo "Attempting to reapply local changes..."
    git stash pop || echo "Warning: Could not automatically reapply local changes. Please check manually."
fi

# Check if database migration is needed
if [ -f "db/migrate.js" ]; then
    echo ""
    echo "Running database migrations..."
    node db/migrate.js
fi

# Restart instructions
echo ""
echo "Update complete!"
echo ""
echo "To restart the server:"
echo "1. Stop the current server (Ctrl+C or kill the process)"
echo "2. Start the server: npm start"
echo ""
echo "Your data has been preserved in:"
echo "- Database: data/webssh.db"
echo "- Backup: $BACKUP_DIR/"
echo ""
echo "Active tmux sessions have been preserved and will reconnect automatically."