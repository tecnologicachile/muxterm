#!/bin/bash

# MuxTerm Independent Update Script
# This script creates a systemd timer to run the update independently

MUXTERM_DIR="${1:-/opt/muxterm}"
UPDATE_SCRIPT="$MUXTERM_DIR/update.sh"

# Check if update script exists
if [ ! -f "$UPDATE_SCRIPT" ]; then
    echo "Error: Update script not found at $UPDATE_SCRIPT"
    exit 1
fi

# Create a one-shot systemd service for the update
cat > /tmp/muxterm-update.service << EOF
[Unit]
Description=MuxTerm One-Time Update
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash $UPDATE_SCRIPT
WorkingDirectory=$MUXTERM_DIR
StandardOutput=journal
StandardError=journal
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

# Don't stop when muxterm.service stops
RefuseManualStop=yes
EOF

# Create a timer to run it in 5 seconds
cat > /tmp/muxterm-update.timer << EOF
[Unit]
Description=MuxTerm Update Timer
Requires=muxterm-update.service

[Timer]
OnActiveSec=5s
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

# Install and start the timer
sudo mv /tmp/muxterm-update.service /etc/systemd/system/
sudo mv /tmp/muxterm-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start muxterm-update.timer

echo "Update scheduled to run in 5 seconds..."
echo "Check progress with: sudo journalctl -u muxterm-update -f"

# Clean up after 60 seconds
(sleep 60 && sudo systemctl stop muxterm-update.timer && sudo rm -f /etc/systemd/system/muxterm-update.{service,timer} && sudo systemctl daemon-reload) &