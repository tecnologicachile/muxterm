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

# Create logs directory if it doesn't exist
LOG_DIR="$SCRIPT_DIR/logs/updates"
mkdir -p "$LOG_DIR"

# Log file for the update process (temporary, the main update.sh will create its own)
TEMP_LOG_FILE="/tmp/muxterm-update-$(date +%Y%m%d%H%M%S).log"

print_color "MuxTerm Auto-Update Started" "$BLUE"
print_color "Update logs will be saved in: $LOG_DIR" "$YELLOW"

# Change to script directory
cd "$SCRIPT_DIR"

# Run the update script with auto-yes
echo "y" | bash update.sh > "$TEMP_LOG_FILE" 2>&1 &
UPDATE_PID=$!

# Show progress
print_color "Update in progress..." "$YELLOW"
while kill -0 $UPDATE_PID 2>/dev/null; do
    echo -n "."
    sleep 2
done
echo

# Wait for process to complete and get exit code
wait $UPDATE_PID
UPDATE_EXIT_CODE=$?

# Check if update was successful
if [ $UPDATE_EXIT_CODE -eq 0 ]; then
    print_color "✓ Update completed successfully!" "$GREEN"
    # Find the most recent log file created by update.sh
    LATEST_LOG=$(ls -t "$LOG_DIR"/update-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
        print_color "Update log saved at: $LATEST_LOG" "$BLUE"
    fi
    
    # Double-check that frontend was deployed
    if [ ! -f "$SCRIPT_DIR/public/index.html" ]; then
        print_color "⚠ Frontend not found in public/, attempting to fix..." "$YELLOW"
        cd "$SCRIPT_DIR"
        if [ -f "client/dist/index.html" ]; then
            mkdir -p public
            cp -r client/dist/* public/
            print_color "✓ Frontend copied to public directory" "$GREEN"
        else
            print_color "✗ Frontend build not found! Manual intervention required." "$RED"
        fi
    fi
    
    print_color "The service will restart automatically." "$YELLOW"
    
    # Show key log entries
    if grep -q "Frontend compiled successfully" "$TEMP_LOG_FILE"; then
        print_color "✓ Frontend compiled" "$GREEN"
    elif grep -q "Frontend compilation failed" "$TEMP_LOG_FILE"; then
        print_color "⚠ Frontend compilation failed - check log" "$RED"
    fi
else
    print_color "✗ Update failed. Check log file: $TEMP_LOG_FILE" "$RED"
    # Also check for the detailed log from update.sh
    LATEST_LOG=$(ls -t "$LOG_DIR"/update-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
        print_color "Detailed log saved at: $LATEST_LOG" "$YELLOW"
    fi
    # Show last few error lines
    print_color "\nLast errors:" "$YELLOW"
    tail -n 10 "$TEMP_LOG_FILE" | grep -E "(Error|Failed|Warning)" || tail -n 5 "$TEMP_LOG_FILE"
    exit 1
fi