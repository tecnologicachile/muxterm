#\!/bin/bash

# MuxTerm Independent Update Script
# This script runs the update directly in background

MUXTERM_DIR="${1:-/opt/muxterm}"
UPDATE_SCRIPT="$MUXTERM_DIR/update.sh"

# Check if update script exists
if [ \! -f "$UPDATE_SCRIPT" ]; then
    echo "Error: Update script not found at $UPDATE_SCRIPT"
    exit 1
fi

echo "[$(date)] Starting update process..."

# Run the update directly in background
(
    # Small delay to allow API response
    sleep 1
    
    # Run update with output to journal
    /bin/bash "$UPDATE_SCRIPT" --yes 2>&1  < /dev/null |  logger -t muxterm-update
    
    echo "[$(date)] Update process completed" | logger -t muxterm-update
) > /dev/null 2>&1 &

echo "Update started in background"
echo "Check progress with: journalctl -t muxterm-update -f"
