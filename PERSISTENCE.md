# WebSSH Persistence System

## Overview

WebSSH now uses SQLite database and tmux sessions to provide full persistence across server restarts and updates.

## What is Persisted

### 1. User Accounts
- Usernames and hashed passwords
- Stored in SQLite database at `data/webssh.db`

### 2. SSH Sessions
- Session metadata (ID, name, creation date)
- Session layouts (panel configuration)
- Associated with tmux sessions for process persistence

### 3. Terminals
- Terminal instances linked to sessions
- tmux session names for reconnection
- Panel assignments

### 4. Active Processes
- All running processes continue in tmux sessions
- Survive server restarts
- Can be reattached when user logs back in

## Directory Structure

```
webssh/
├── data/              # Persistent data (excluded from git)
│   └── webssh.db     # SQLite database
├── sessions/          # tmux socket directory
├── logs/             # Application logs
└── backup_*/         # Created by update.sh
```

## Updating the Application

Use the provided update script to safely update while preserving data:

```bash
./update.sh
```

This script will:
1. Backup your database and configuration
2. Pull latest changes from git
3. Update dependencies
4. Rebuild the client
5. Preserve all user data and active sessions

## Manual Backup

To manually backup your data:

```bash
cp data/webssh.db data/webssh.db.backup
```

## Database Schema

The SQLite database contains:
- `users` - User accounts
- `sessions` - SSH session metadata
- `session_layouts` - Panel layouts for each session
- `terminals` - Terminal instances

## tmux Integration

Each terminal runs inside a tmux session with naming convention:
`webssh_<session_id>_<terminal_id>`

Benefits:
- Processes continue running when disconnected
- Can reattach to exact same state
- Survives server restarts
- Multiple users can have independent sessions

## Troubleshooting

### Lost Sessions After Update
1. Check if tmux sessions still exist: `tmux ls | grep webssh`
2. Database should reconnect automatically
3. If not, check `data/webssh.db` exists

### Can't Connect to Old Sessions
- Ensure tmux is installed: `which tmux`
- Check tmux sessions: `tmux ls`
- Verify database has session records

### Database Issues
- Database location: `data/webssh.db`
- Can be opened with any SQLite browser
- Automatic backups in `backup_*/` directories