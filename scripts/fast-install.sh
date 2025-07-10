#!/bin/bash

# MuxTerm Fast Installer - Downloads pre-built client

set -e

REPO="tecnologicachile/muxterm"
RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"

echo "🚀 MuxTerm Fast Installer"
echo "========================"

# Check if we have a pre-built release
echo "Checking for pre-built release..."
RELEASE_INFO=$(curl -s $RELEASE_URL)
DOWNLOAD_URL=$(echo $RELEASE_INFO | grep -o '"browser_download_url": "[^"]*client-dist.tar.gz"' | cut -d'"' -f4)

if [ -n "$DOWNLOAD_URL" ]; then
    echo "✅ Found pre-built client!"
    echo "Downloading..."
    curl -L -o client-dist.tar.gz "$DOWNLOAD_URL"
    
    # Extract to client/dist
    mkdir -p client
    tar -xzf client-dist.tar.gz -C client/
    rm client-dist.tar.gz
    
    echo "✅ Client downloaded successfully!"
else
    echo "⚠️  No pre-built release found, building from source..."
    echo "This may take a few minutes..."
    
    cd client
    npm ci --production
    npm run build
    cd ..
fi

echo "✅ Installation complete!"