#!/bin/bash

# MuxTerm Update Command
# This script is called when users run "muxterm update" in a terminal

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Check if we're inside MuxTerm
if [ -z "$MUXTERM_SESSION" ]; then
    print_color "This command should be run inside a MuxTerm terminal" "$RED"
    exit 1
fi

print_color "MuxTerm Update Check" "$BLUE"
print_color "===================" "$BLUE"

# Find MuxTerm installation directory
MUXTERM_DIR="/opt/muxterm"
if [ ! -d "$MUXTERM_DIR" ]; then
    # Try to find it in common locations
    for dir in /usr/local/muxterm ~/muxterm ./; do
        if [ -f "$dir/package.json" ] && grep -q '"name": "muxterm"' "$dir/package.json" 2>/dev/null; then
            MUXTERM_DIR="$dir"
            break
        fi
    done
fi

if [ ! -f "$MUXTERM_DIR/update.sh" ]; then
    print_color "Error: MuxTerm installation not found" "$RED"
    print_color "Please run the update script manually from the MuxTerm directory" "$YELLOW"
    exit 1
fi

# Run the update script
cd "$MUXTERM_DIR"
exec bash update.sh