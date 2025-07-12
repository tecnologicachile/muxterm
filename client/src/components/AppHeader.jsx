import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box,
  IconButton,
  Divider,
  Chip
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
  return (
    <AppBar position="static" elevation={2}>
      <Toolbar variant="dense" sx={{ minHeight: 48, px: 2 }}>
        {/* Left Section - Brand */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          minWidth: 180
        }}>
          <TerminalIcon sx={{ fontSize: 20, mr: 1.5 }} />
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: '1rem',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}
          >
            MuxTerm
          </Typography>
          
          {mode === 'terminal' && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
              <IconButton 
                color="inherit" 
                onClick={onBack}
                size="small"
                sx={{ 
                  '&:hover': { 
                    bgcolor: 'rgba(255,255,255,0.1)' 
                  }
                }}
              >
                <BackIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>

        {/* Center Section - Context Info */}
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          px: 2
        }}>
          {mode === 'sessions' ? (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              {username}
            </Typography>
          ) : (
            centerContent || (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  {sessionName}
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255,255,255,0.7)',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1
                }}>
                  {panelCount} panel{panelCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )
          )}
        </Box>

        {/* Right Section - Actions */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1.5,
          minWidth: 180,
          justifyContent: 'flex-end'
        }}>
          {rightContent}
          
          {/* Connection Status */}
          <Chip
            icon={connected ? <WifiIcon /> : <WifiOffIcon />}
            label={connected ? "Connected" : "Reconnecting..."}
            size="small"
            color={connected ? "success" : "warning"}
            sx={{ 
              height: 24,
              fontSize: '0.75rem',
              '& .MuiChip-icon': {
                fontSize: 16
              }
            }}
          />
          
          <GitHubStars />
          
          <VersionIndicator />
          
          <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
          
          <IconButton 
            color="inherit" 
            onClick={onLogout}
            size="small"
            sx={{ 
              ml: 0.5,
              '&:hover': { 
                bgcolor: 'rgba(255,255,255,0.1)' 
              }
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default AppHeader;