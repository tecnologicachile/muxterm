#!/bin/bash
# Script to create GitHub release using API
# Usage: ./scripts/create-release.sh

set -e

# Check for GitHub token
if [ -f "$HOME/.github_token" ]; then
    GITHUB_TOKEN=$(cat "$HOME/.github_token")
elif [ -f ".github_token" ]; then
    GITHUB_TOKEN=$(cat ".github_token")
elif [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN not found"
    echo "Please either:"
    echo "  1. Set GITHUB_TOKEN environment variable: export GITHUB_TOKEN=your_token"
    echo "  2. Create a file ~/.github_token with your token"
    echo "  3. Create a file .github_token in the project root"
    echo ""
    echo "You can create a token at: https://github.com/settings/tokens"
    echo "The token needs 'repo' permissions"
    exit 1
fi

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0)
VERSION=${LATEST_TAG#v}  # Remove 'v' prefix

echo "Creating release for tag: $LATEST_TAG"

# Get the previous tag for changelog
PREVIOUS_TAG=$(git describe --tags --abbrev=0 $LATEST_TAG^)

# Create release notes
RELEASE_NOTES="## What's Changed

### 🖱️ UI Improvements
- Fixed keyboard button appearing on desktop PCs with touch screens
- Keyboard button now only shows on actual mobile devices (Android/iOS)
- Improved mobile device detection using User Agent

### 📱 Mobile Experience
- More accurate detection of mobile devices vs touch-enabled desktops
- Keyboard helper button only appears when truly needed
- Better experience for laptop users with touch screens

## Full Changelog
https://github.com/tecnologicachile/muxterm/compare/${PREVIOUS_TAG}...${LATEST_TAG}"

# Create the release using GitHub API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/tecnologicachile/muxterm/releases \
  -d @- << EOF
{
  "tag_name": "$LATEST_TAG",
  "target_commitish": "main",
  "name": "$LATEST_TAG - Auto-reconnection and Auto-Yes improvements",
  "body": $(echo "$RELEASE_NOTES" | jq -Rs .),
  "draft": false,
  "prerelease": false
}
EOF

echo ""
echo "✅ Release created successfully!"
echo "🔗 View at: https://github.com/tecnologicachile/muxterm/releases/tag/$LATEST_TAG"