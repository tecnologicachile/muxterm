#!/bin/bash

# MuxTerm Auto-Update Script
# This script runs the update automatically without user interaction

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Log file for the update process
LOG_FILE="/tmp/muxterm-update-$(date +%Y%m%d%H%M%S).log"

print_color "MuxTerm Auto-Update Started" "$BLUE"
print_color "Log file: $LOG_FILE" "$YELLOW"

# Change to script directory
cd "$SCRIPT_DIR"

# Run the update script with auto-yes
echo "y" | bash update.sh > "$LOG_FILE" 2>&1

# Check if update was successful
if [ $? -eq 0 ]; then
    print_color "✓ Update completed successfully!" "$GREEN"
    print_color "The service will restart automatically." "$YELLOW"
else
    print_color "✗ Update failed. Check log file: $LOG_FILE" "$RED"
    exit 1
fi