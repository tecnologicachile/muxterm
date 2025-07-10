#!/bin/bash

# WSL Permission Fix Script
echo "🔧 WSL Permission Fix for MuxTerm"
echo "================================"
echo

# Check if running in WSL
if ! grep -qi microsoft /proc/version; then
    echo "This script is for WSL only"
    exit 1
fi

# Fix common WSL issues
echo "1. Configuring git for WSL..."
git config --global core.filemode false
git config --global core.autocrlf input

echo "2. Setting WSL metadata options..."
if [ -f /etc/wsl.conf ]; then
    echo "WSL config exists"
else
    echo "Creating WSL config..."
    sudo tee /etc/wsl.conf > /dev/null << 'EOF'
[automount]
enabled = true
options = "metadata,umask=22,fmask=11"

[network]
generateResolvConf = true

[interop]
enabled = true
EOF
    echo "⚠️  WSL config created. You may need to restart WSL for changes to take effect."
fi

echo "3. Best practices for WSL:"
echo "   - Always clone repositories in Linux filesystem (~/) not Windows (/mnt/c/)"
echo "   - Use 'cd ~' before running installers"
echo "   - Access MuxTerm from Windows at: http://localhost:3002"
echo
echo "To install MuxTerm properly in WSL:"
echo "  cd ~"
echo "  curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash"
echo