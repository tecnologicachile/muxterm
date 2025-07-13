import React, { useState, useEffect } from 'react';
import { 
  Chip, 
  Tooltip, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Paper
} from '@mui/material';
import UpdateIcon from '@mui/icons-material/SystemUpdate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import GitHubIcon from '@mui/icons-material/GitHub';
import StarIcon from '@mui/icons-material/Star';
import axios from '../utils/axios';
import logger from '../utils/logger';
import UpdateProgress from './UpdateProgress';

// Version actual del cliente (leída desde package.json)
import packageJson from '../../package.json';
const CURRENT_VERSION = packageJson.version;

function VersionIndicator() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [checkMessage, setCheckMessage] = useState('');
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);

  useEffect(() => {
    // Check on mount
    checkForUpdates();
    
    // Check every 30 minutes while app is open
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async (isManual = false) => {
    setChecking(true);
    setCheckMessage('');
    try {
      const response = await axios.get('/api/update-check', {
        params: { manual: isManual ? 'true' : 'false' }
      });
      if (response.data.update) {
        setUpdateInfo(response.data.update);
        logger.info('Update available:', response.data.update);
        if (isManual) {
          setCheckMessage(`New version ${response.data.update.latest} available!`);
        }
      } else {
        setUpdateInfo(null);
        if (isManual) {
          setCheckMessage('MuxTerm is up to date ✓');
        }
      }
      setLastCheck(new Date());
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      if (isManual) {
        setCheckMessage('Error checking for updates');
      }
    } finally {
      setChecking(false);
      if (isManual) {
        setTimeout(() => setCheckMessage(''), 3000);
      }
    }
  };

  const handleUpdate = async () => {
    setDialogOpen(false);
    setShowUpdateProgress(true);
  };

  const hasUpdate = updateInfo !== null;
  const chipColor = hasUpdate ? 'warning' : 'default';
  const chipIcon = checking ? <CircularProgress size={14} /> : 
                   hasUpdate ? <UpdateIcon fontSize="small" /> : 
                   <CheckCircleIcon fontSize="small" />;

  return (
    <>
      <Tooltip title={hasUpdate ? "New version available!" : "MuxTerm is up to date"}>
        <Chip
          icon={chipIcon}
          label={`v${CURRENT_VERSION}`}
          size="small"
          color={chipColor}
          onClick={() => setDialogOpen(true)}
          sx={{ 
            cursor: 'pointer',
            fontWeight: hasUpdate ? 'bold' : 'normal',
            animation: hasUpdate ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.6 },
              '100%': { opacity: 1 }
            }
          }}
        />
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <InfoIcon />
            Version Information
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="body2" gutterBottom>
              <strong>Current version:</strong> v{CURRENT_VERSION}
            </Typography>
            
            {hasUpdate ? (
              <>
                <Typography variant="body2" color="warning.main" gutterBottom>
                  <strong>New version available:</strong> v{updateInfo.latest}
                </Typography>
                
                {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      What's new in v{updateInfo.latest}:
                    </Typography>
                    <List dense sx={{ py: 0 }}>
                      {updateInfo.changelog.map((item, index) => (
                        <ListItem key={index} sx={{ py: 0, px: 1 }}>
                          <ListItemText
                            primary={`• ${item}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    muxterm update
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                ✓ MuxTerm is up to date
              </Typography>
            )}
            
            {lastCheck && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Last check: {lastCheck.toLocaleTimeString()}
              </Typography>
            )}
            
            {checkMessage && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  p: 1, 
                  bgcolor: checkMessage.includes('Error') ? 'error.main' : 
                           checkMessage.includes('actualizado') ? 'success.main' : 'warning.main',
                  color: 'white',
                  borderRadius: 1,
                  textAlign: 'center'
                }}
              >
                {checkMessage}
              </Typography>
            )}
          </Paper>
          
          <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.dark', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Do you like MuxTerm?
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Help us by giving it a star on GitHub. Your support motivates us to keep improving!
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="warning"
              startIcon={<GitHubIcon />}
              href="https://github.com/tecnologicachile/muxterm"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                '&:hover': {
                  bgcolor: 'warning.dark'
                }
              }}
            >
              ⭐ Star en GitHub
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => checkForUpdates(true)}
            disabled={checking}
            startIcon={checking ? <CircularProgress size={16} /> : <UpdateIcon />}
          >
            {checking ? 'Verificando...' : 'Buscar Actualizaciones'}
          </Button>
          <Button onClick={() => setDialogOpen(false)}>
            Close
          </Button>
          {hasUpdate && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleUpdate}
              disabled={updating}
              startIcon={updating ? <CircularProgress size={16} /> : <UpdateIcon />}
            >
              {updating ? 'Updating...' : 'Update Now'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {updateInfo && (
        <UpdateProgress 
          open={showUpdateProgress}
          onClose={() => setShowUpdateProgress(false)}
          version={updateInfo.latest}
        />
      )}
    </>
  );
}

export default VersionIndicator;