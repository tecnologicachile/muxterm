#!/bin/bash

# MuxTerm Release Script
# This script creates a new release with version bump, git tag, and GitHub release

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="tecnologicachile/muxterm"
GITHUB_TOKEN_FILE="$HOME/.muxterm/github-token"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        print_color "GitHub CLI (gh) is not installed." "$RED"
        print_color "Install it from: https://cli.github.com/" "$YELLOW"
        print_color "\nOr install with:" "$YELLOW"
        print_color "  Ubuntu/Debian: sudo apt install gh" "$BLUE"
        print_color "  macOS: brew install gh" "$BLUE"
        exit 1
    fi
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
    
    print_color "GitHub token not found. Let's set it up." "$YELLOW"
    print_color "\nYou need a GitHub Personal Access Token with 'repo' scope." "$BLUE"
    print_color "Create one at: https://github.com/settings/tokens/new" "$BLUE"
    echo
    read -sp "Enter your GitHub token: " token
    echo
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$GITHUB_TOKEN_FILE")"
    
    # Save token securely
    echo "$token" > "$GITHUB_TOKEN_FILE"
    chmod 600 "$GITHUB_TOKEN_FILE"
    
    export GITHUB_TOKEN="$token"
    print_color "Token saved securely" "$GREEN"
}

# Function to get current version
get_current_version() {
    if [ -f "package.json" ]; then
        grep '"version":' package.json | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/'
    else
        echo "unknown"
    fi
}

# Function to bump version
bump_version() {
    local current_version=$1
    local bump_type=$2
    
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Function to update version in files
update_version_files() {
    local new_version=$1
    
    # Update main package.json
    sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$new_version\"/" package.json
    
    # Update client package.json
    if [ -f "client/package.json" ]; then
        sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$new_version\"/" client/package.json
    fi
    
    print_color "Updated version to $new_version in package.json files" "$GREEN"
}

# Function to build frontend
build_frontend() {
    print_color "\nBuilding frontend..." "$YELLOW"
    cd client
    npm install
    npm run build
    cd ..
    print_color "Frontend built successfully" "$GREEN"
}

# Function to create git commit and tag
create_git_release() {
    local version=$1
    local message=$2
    
    # Stage changes
    git add -A
    
    # Create commit
    git commit -m "Release v$version - $message

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
    
    # Push commit
    git push origin main
    
    # Create annotated tag
    git tag -a "v$version" -m "Release v$version

$message"
    
    # Push tag
    git push origin "v$version"
    
    print_color "Git commit and tag created for v$version" "$GREEN"
}

# Function to create GitHub release
create_github_release() {
    local version=$1
    local title=$2
    local notes=$3
    
    print_color "\nCreating GitHub release..." "$YELLOW"
    
    # Create release using gh CLI
    gh release create "v$version" \
        --repo "$REPO" \
        --title "$title" \
        --notes "$notes" \
        --latest
    
    print_color "GitHub release created successfully!" "$GREEN"
    print_color "View at: https://github.com/$REPO/releases/tag/v$version" "$BLUE"
}

# Main function
main() {
    print_color "MuxTerm Release Script" "$BLUE"
    echo "===================="
    
    # Check prerequisites
    check_gh_cli
    setup_token
    
    # Get current version
    CURRENT_VERSION=$(get_current_version)
    print_color "\nCurrent version: $CURRENT_VERSION" "$BLUE"
    
    # Ask for version bump type
    echo
    print_color "Select version bump type:" "$YELLOW"
    echo "1) Patch (x.x.X) - Bug fixes"
    echo "2) Minor (x.X.0) - New features"
    echo "3) Major (X.0.0) - Breaking changes"
    echo "4) Custom version"
    read -p "Choice (1-4): " choice
    
    case $choice in
        1) NEW_VERSION=$(bump_version $CURRENT_VERSION patch) ;;
        2) NEW_VERSION=$(bump_version $CURRENT_VERSION minor) ;;
        3) NEW_VERSION=$(bump_version $CURRENT_VERSION major) ;;
        4) 
            read -p "Enter new version (e.g., 1.2.3): " NEW_VERSION
            # Validate version format
            if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                print_color "Invalid version format" "$RED"
                exit 1
            fi
            ;;
        *) 
            print_color "Invalid choice" "$RED"
            exit 1
            ;;
    esac
    
    print_color "\nNew version will be: $NEW_VERSION" "$GREEN"
    
    # Get release title
    echo
    read -p "Enter release title (default: MuxTerm v$NEW_VERSION): " RELEASE_TITLE
    RELEASE_TITLE=${RELEASE_TITLE:-"MuxTerm v$NEW_VERSION"}
    
    # Get release summary
    echo
    print_color "Enter a brief summary of this release:" "$YELLOW"
    read -p "> " RELEASE_SUMMARY
    
    # Collect changes
    print_color "\nEnter the changes for this release (one per line, empty line to finish):" "$YELLOW"
    print_color "Format: Start with - for bullet points" "$BLUE"
    
    CHANGES=""
    while true; do
        read -p "> " line
        [ -z "$line" ] && break
        # Add bullet if not present
        if [[ ! "$line" =~ ^- ]]; then
            line="- $line"
        fi
        CHANGES="${CHANGES}${line}\n"
    done
    
    # Build release notes
    RELEASE_NOTES="## 🚀 Release v$NEW_VERSION

### ${RELEASE_SUMMARY}

${CHANGES}
### 📝 Installation
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/install.sh | bash
\`\`\`

### 🔄 Update
- From the UI: Click on the version indicator when an update is available
- From terminal: \`muxterm update\`

---
⭐ **Enjoying MuxTerm?** [Give us a star on GitHub!](https://github.com/tecnologicachile/muxterm)"

    # Show summary
    echo
    print_color "Release Summary:" "$BLUE"
    print_color "Version: $CURRENT_VERSION → $NEW_VERSION" "$YELLOW"
    print_color "Title: $RELEASE_TITLE" "$YELLOW"
    echo
    print_color "Release Notes Preview:" "$BLUE"
    echo -e "$RELEASE_NOTES"
    echo
    
    # Confirm
    read -p "Proceed with release? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_color "Release cancelled" "$YELLOW"
        exit 0
    fi
    
    # Execute release
    print_color "\nStarting release process..." "$BLUE"
    
    # Update version files
    update_version_files "$NEW_VERSION"
    
    # Build frontend
    build_frontend
    
    # Create git release
    create_git_release "$NEW_VERSION" "$RELEASE_SUMMARY"
    
    # Create GitHub release
    create_github_release "$NEW_VERSION" "$RELEASE_TITLE" "$RELEASE_NOTES"
    
    print_color "\n✓ Release v$NEW_VERSION completed successfully!" "$GREEN"
}

# Run main function
main "$@"