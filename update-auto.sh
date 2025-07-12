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
echo "y" | bash update.sh > "$LOG_FILE" 2>&1 &
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
    print_color "The service will restart automatically." "$YELLOW"
    
    # Show key log entries
    if grep -q "Frontend compiled successfully" "$LOG_FILE"; then
        print_color "✓ Frontend compiled" "$GREEN"
    elif grep -q "Frontend compilation failed" "$LOG_FILE"; then
        print_color "⚠ Frontend compilation failed - check log" "$RED"
    fi
else
    print_color "✗ Update failed. Check log file: $LOG_FILE" "$RED"
    # Show last few error lines
    print_color "\nLast errors:" "$YELLOW"
    tail -n 10 "$LOG_FILE" | grep -E "(Error|Failed|Warning)" || tail -n 5 "$LOG_FILE"
    exit 1
fi