## [1.0.40] - 2025-07-13

### Fixed
- **Frontend Rebuild Logic** - Always rebuild frontend when version changes
- **Rebuild Detection** - Added separate flags for update vs rebuild scenarios
- **Frontend-Only Updates** - Can now rebuild frontend without full git update

### Changed
- Improved update.sh logic to handle three scenarios:
  1. Full update (version change) - always rebuilds frontend
  2. Frontend-only rebuild - skips git operations, only rebuilds
  3. No action needed - exits early
- Added check for client dependency updates
- Optimized update process to skip unnecessary git operations when only frontend rebuild is needed

### Technical
- Split NEEDS_UPDATE and NEEDS_REBUILD flags for better control
- Added dedicated path for frontend-only rebuilds
- Service restart only happens when actually needed

## [1.0.38] - 2025-07-13

### Fixed
- **Update Process** - Frontend rebuild detection when versions match
- **UI Updates** - Ensure frontend is always rebuilt when source files change
- **Version Display** - Fix issue where UI showed old version after update

### Changed
- Modified update.sh to check if frontend needs rebuilding even when versions are equal
- Added detection for missing or outdated frontend files in public directory
- Improved update process to handle edge cases where code is updated but version remains same

## [1.0.37] - 2025-07-13

### Fixed
- **UI Update System** - Fixed update execution from web interface
- **Update Process** - Direct execution of update-independent.sh script instead of relying on environment detection
- **Version Consistency** - Corrected version numbers in package.json files

### Changed
- Modified server/index.js to execute update-independent.sh directly when available
- Improved error handling in update process
- Enhanced logging for update troubleshooting

# Changelog

## [1.1.0] - 2025-01-10

### Added
- Non-interactive installation mode with `--yes` flag for automation
- Support for root user installation (no sudo required)
- SESSION_SECRET environment variable for secure session management
- Automatic UTF-8 locale configuration during installation
- Locale environment variables (LANG, LC_ALL) in terminal sessions
- `npm run create-user` command for creating users in production
- Default user creation on first run (even in production)
- Better error handling and dependency checking in installer
- tmux availability check with warning if not installed
- Support for systems without systemd

### Changed
- Installation now auto-starts MuxTerm without prompting
- Improved installer to work in containerized environments (Docker, LXC, Proxmox)
- Enhanced support for various Linux distributions
- Better handling of missing commands (sudo, git, openssl)

### Fixed
- Installation failures on systems without sudo
- Character encoding issues (accents appearing as _)
- Missing SESSION_SECRET causing 500 errors
- User creation only working in development mode
- Installation issues in WSL with git permissions
- Service creation on systems without systemd

### Security
- Added SESSION_SECRET to default configuration
- Improved secret generation with fallback for systems without openssl

## [1.0.0] - 2025-01-09

### Initial Release
- Web-based terminal multiplexer with tmux backend
- Persistent sessions that survive restarts
- Multi-panel terminal interface
- User authentication system
- Real-time terminal synchronization
- Auto-yes feature for CLI tools
- Session management and organization
- Mobile responsive design