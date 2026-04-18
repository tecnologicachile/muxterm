import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Divider,
  Chip,
  Tooltip
} from '@mui/material';
import { 
  Terminal as TerminalIcon,
  ArrowBack as BackIcon,
  Logout as LogoutIcon,
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon
} from '@mui/icons-material';
import VersionIndicator from './VersionIndicator';
import GitHubStars from './GitHubStars';
import { useSocket } from '../utils/SocketContext';

function AppHeader({
  mode = 'sessions', // 'sessions' | 'terminal'
  username,
  sessionName,
  panelCount,
  onBack,
  onLogout,
  centerContent,
  rightContent
}) {
  const { connected } = useSocket();
  const [isMobileHeader, setIsMobileHeader] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const check = () => setIsMobileHeader(window.innerWidth <= 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar variant="dense" sx={{ minHeight: 40, px: isMobileHeader ? 1 : 2 }}>
        {/* Left Section - Brand */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: isMobileHeader ? 'auto' : 180,
          flexShrink: 0
        }}>
          {mode === 'terminal' && (
            <IconButton
              color="inherit"
              onClick={onBack}
              size="small"
              sx={{
                mr: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              <BackIcon fontSize="small" />
            </IconButton>
          )}
          {!isMobileHeader && (
            <>
              <TerminalIcon sx={{ fontSize: 20, mr: 1 }} />
              <Typography
                variant="h6"
                sx={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.5px' }}
              >
                MuxTerm
              </Typography>
            </>
          )}
        </Box>

        {/* Center Section - Context Info */}
        <Box sx={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: isMobileHeader ? 'flex-start' : 'center',
          alignItems: 'center',
          px: isMobileHeader ? 0.5 : 2,
          overflow: 'hidden'
        }}>
          {mode === 'sessions' ? (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              {username}
            </Typography>
          ) : (
            centerContent || (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
                <Typography variant="body2" noWrap sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: isMobileHeader ? '0.8rem' : '0.875rem',
                  maxWidth: isMobileHeader ? '120px' : 'none'
                }}>
                  {sessionName}
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.7)',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  whiteSpace: 'nowrap',
                  fontSize: '0.65rem'
                }}>
                  {panelCount}p
                </Typography>
              </Box>
            )
          )}
        </Box>

        {/* Right Section - Actions */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobileHeader ? 0.5 : 1.5,
          minWidth: isMobileHeader ? 'auto' : 180,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          {rightContent}

          {/* Connection Status — compact icon with tooltip on both mobile and desktop */}
          <Tooltip title={connected ? 'Connected' : 'Reconnecting...'} arrow>
            <Box sx={{ color: connected ? '#4caf50' : '#ff9800', display: 'flex', alignItems: 'center', cursor: 'default', px: 0.5 }}>
              {connected ? <WifiIcon sx={{ fontSize: isMobileHeader ? 18 : 20 }} /> : <WifiOffIcon sx={{ fontSize: isMobileHeader ? 18 : 20 }} />}
            </Box>
          </Tooltip>

          {!isMobileHeader && <GitHubStars />}
          {!isMobileHeader && <VersionIndicator />}
          {!isMobileHeader && <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />}

          <IconButton
            color="inherit"
            onClick={onLogout}
            size="small"
            sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default AppHeader;