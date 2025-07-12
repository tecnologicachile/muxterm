#!/bin/bash
# Quick release script - non-interactive
# Usage: ./scripts/quick-release.sh 1.0.7 "Description of changes"

set -e

VERSION=$1
DESCRIPTION=$2

if [ -z "$VERSION" ] || [ -z "$DESCRIPTION" ]; then
    echo "Usage: $0 <version> <description>"
    echo "Example: $0 1.0.7 \"Fixed bug in terminal resize\""
    exit 1
fi

# Update version in package.json files
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" client/package.json

# Build frontend
echo "Building frontend..."
cd client && npm run build && cd ..

# Git operations
git add -A
git commit -m "Release v$VERSION - $DESCRIPTION

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main

# Create and push tag
git tag -a "v$VERSION" -m "Release v$VERSION

$DESCRIPTION"
git push origin "v$VERSION"

echo "✅ Version $VERSION tagged and pushed!"
echo "📝 Remember to create the GitHub release at:"
echo "   https://github.com/tecnologicachile/muxterm/releases/new?tag=v$VERSION"