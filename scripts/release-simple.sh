#!/bin/bash

# MuxTerm Simple Release Script
# Creates GitHub releases using curl (no gh CLI needed)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="tecnologicachile"
REPO_NAME="muxterm"
GITHUB_TOKEN_FILE="$HOME/.muxterm/github-token"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to setup GitHub token
setup_token() {
    if [ -n "$GITHUB_TOKEN" ]; then
        print_color "Using GITHUB_TOKEN from environment" "$GREEN"
        return 0
    fi
    
    if [ -f "$GITHUB_TOKEN_FILE" ]; then
        export GITHUB_TOKEN=$(cat "$GITHUB_TOKEN_FILE")
        print_color "Using saved GitHub token" "$GREEN"
        return 0
    fi
    
    print_color "GitHub token not found." "$YELLOW"
    print_color "\nTo save your token permanently:" "$BLUE"
    print_color "1. Create a token at: https://github.com/settings/tokens/new" "$BLUE"
    print_color "2. Select 'repo' scope" "$BLUE"
    print_color "3. Save it securely" "$BLUE"
    echo
    read -sp "Enter your GitHub token: " token
    echo
    
    if [ -z "$token" ]; then
        print_color "No token provided" "$RED"
        exit 1
    fi
    
    # Ask if user wants to save the token
    read -p "Save this token for future use? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$(dirname "$GITHUB_TOKEN_FILE")"
        echo "$token" > "$GITHUB_TOKEN_FILE"
        chmod 600 "$GITHUB_TOKEN_FILE"
        print_color "Token saved securely" "$GREEN"
    fi
    
    export GITHUB_TOKEN="$token"
}

# Function to create GitHub release
create_release() {
    local tag=$1
    local name=$2
    local body=$3
    
    print_color "\nCreating GitHub release for $tag..." "$YELLOW"
    
    # Escape the body for JSON
    body=$(echo "$body" | jq -Rs .)
    
    # Create the release
    response=$(curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases" \
        -d "{
            \"tag_name\": \"$tag\",
            \"name\": \"$name\",
            \"body\": $body,
            \"draft\": false,
            \"prerelease\": false
        }")
    
    # Check if successful
    if echo "$response" | grep -q "\"id\""; then
        print_color "✓ Release created successfully!" "$GREEN"
        
        # Extract and show the URL
        url=$(echo "$response" | grep -o '"html_url": "[^"]*' | grep -o 'https://[^"]*' | head -1)
        if [ -n "$url" ]; then
            print_color "View at: $url" "$BLUE"
        fi
    else
        print_color "✗ Failed to create release" "$RED"
        print_color "Response: $response" "$RED"
        exit 1
    fi
}

# Main function
main() {
    print_color "MuxTerm GitHub Release Creator" "$BLUE"
    echo "=============================="
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        print_color "Error: jq is required but not installed" "$RED"
        print_color "Install with: sudo apt install jq" "$YELLOW"
        exit 1
    fi
    
    # Setup token
    setup_token
    
    # Get the latest tag
    print_color "\nFetching tags..." "$YELLOW"
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -z "$LATEST_TAG" ]; then
        print_color "No tags found in repository" "$RED"
        exit 1
    fi
    
    print_color "Latest tag: $LATEST_TAG" "$BLUE"
    
    # Ask which tag to release
    read -p "Enter tag to release (default: $LATEST_TAG): " TAG
    TAG=${TAG:-$LATEST_TAG}
    
    # Check if tag exists
    if ! git rev-parse "$TAG" >/dev/null 2>&1; then
        print_color "Tag $TAG does not exist" "$RED"
        exit 1
    fi
    
    # Check if release already exists
    print_color "\nChecking if release already exists..." "$YELLOW"
    existing=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$TAG")
    
    if echo "$existing" | grep -q "\"id\""; then
        print_color "Release for $TAG already exists!" "$RED"
        read -p "Delete existing release and create new one? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_color "Aborted" "$YELLOW"
            exit 0
        fi
        
        # Delete existing release
        release_id=$(echo "$existing" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
        curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$release_id"
        print_color "Existing release deleted" "$GREEN"
    fi
    
    # Get release title
    VERSION=${TAG#v}  # Remove 'v' prefix if present
    read -p "Release title (default: MuxTerm $TAG): " TITLE
    TITLE=${TITLE:-"MuxTerm $TAG"}
    
    # Create release notes
    print_color "\nGenerating release notes..." "$YELLOW"
    
    # Get commit messages since last release
    PREV_TAG=$(git describe --tags --abbrev=0 "$TAG^" 2>/dev/null || echo "")
    if [ -n "$PREV_TAG" ]; then
        print_color "Changes since $PREV_TAG:" "$BLUE"
        git log --oneline "$PREV_TAG..$TAG" | head -10
    fi
    
    # Build default release notes
    NOTES="## 🚀 Release $TAG

### ✨ What's New
- See commit history for detailed changes

### 📝 Installation
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
\`\`\`

### 🔄 Update
- From the UI: Click on the version indicator when an update is available
- From terminal: \`muxterm update\`

---
⭐ **Enjoying MuxTerm?** [Give us a star on GitHub!](https://github.com/tecnologicachile/muxterm)"

    # Ask if user wants to customize
    echo
    print_color "Use default release notes? (Y/n) " "$YELLOW"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_color "\nEnter custom release notes (press Ctrl+D when done):" "$BLUE"
        NOTES=$(cat)
    fi
    
    # Show summary
    echo
    print_color "Release Summary:" "$BLUE"
    print_color "Tag: $TAG" "$YELLOW"
    print_color "Title: $TITLE" "$YELLOW"
    echo
    
    # Confirm
    read -p "Create this release? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_color "Release cancelled" "$YELLOW"
        exit 0
    fi
    
    # Create the release
    create_release "$TAG" "$TITLE" "$NOTES"
}

# Run main function
main "$@"