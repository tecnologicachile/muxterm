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

# Get the latest tag (or use provided tag as argument)
LATEST_TAG=${1:-$(git describe --tags --abbrev=0)}
VERSION=${LATEST_TAG#v}  # Remove 'v' prefix

echo "Creating release for tag: $LATEST_TAG"

# Get the previous tag for changelog
PREVIOUS_TAG=$(git describe --tags --abbrev=0 $LATEST_TAG^)

# Create release notes
RELEASE_NOTES="## What's Changed

### 🧪 Test Release v1.0.26
- No functional changes
- Testing the path fixes from v1.0.25
- Should successfully update from UI now

### 📝 Previous Fix Summary (v1.0.25)
- Fixed update script to use absolute paths
- Script now works correctly when run from systemd
- Added proper error handling for version detection
- Update process should complete successfully

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
  "name": "$LATEST_TAG - Test release",
  "body": $(echo "$RELEASE_NOTES" | jq -Rs .),
  "draft": false,
  "prerelease": false
}
EOF

echo ""
echo "✅ Release created successfully!"
echo "🔗 View at: https://github.com/tecnologicachile/muxterm/releases/tag/$LATEST_TAG"