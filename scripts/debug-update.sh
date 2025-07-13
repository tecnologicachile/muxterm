#!/bin/bash

# MuxTerm Update Debug Script
# This script helps diagnose update issues

echo "=== MuxTerm Update Debug ==="
echo "Date: $(date)"
echo ""

# Check basic info
echo "1. System Info:"
echo "   User: $(whoami)"
echo "   PWD: $(pwd)"
echo "   Hostname: $(hostname)"
echo ""

# Check MuxTerm installation
echo "2. MuxTerm Installation:"
echo "   MuxTerm command: $(which muxterm || echo 'NOT FOUND')"
echo "   MuxTerm executable:"
ls -la /usr/local/bin/muxterm 2>/dev/null || echo "   NOT FOUND"
echo ""

# Check update script
echo "3. Update Script:"
echo "   Update.sh location:"
ls -la update.sh 2>/dev/null || echo "   NOT FOUND in current directory"
echo ""

# Check GitHub API
echo "4. GitHub API Test:"
echo "   Fetching latest release..."
curl -s "https://api.github.com/repos/tecnologicachile/muxterm/releases" | grep -m 3 '"tag_name"' || echo "   FAILED to fetch"
echo ""

# Check Node/NPM
echo "5. Node/NPM:"
echo "   Node: $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "   NPM: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo ""

# Check service status
echo "6. Service Status:"
if systemctl is-active --quiet muxterm; then
    echo "   MuxTerm service: RUNNING"
    echo "   Recent logs:"
    sudo journalctl -u muxterm -n 10 --no-pager
else
    echo "   MuxTerm service: NOT RUNNING or NOT FOUND"
fi
echo ""

# Check update logs
echo "7. Recent Update Logs:"
if [ -d "logs/updates" ]; then
    echo "   Last 3 update attempts:"
    ls -t logs/updates/*.log 2>/dev/null | head -3 | while read log; do
        echo "   - $log"
        tail -n 5 "$log" | sed 's/^/     /'
    done
else
    echo "   No update logs directory found"
fi
echo ""

# Test update command
echo "8. Testing Update Command:"
echo "   Command that would run: cd $(pwd) && timeout 300 /usr/local/bin/muxterm update --yes"
echo ""

echo "=== End Debug Info ==="
echo ""
echo "To share this info, run:"
echo "  $0 > debug-update.log 2>&1"
echo ""
echo "To test the update manually, run:"
echo "  muxterm update --yes"