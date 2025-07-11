import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Button, 
  Collapse, 
  IconButton,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UpdateIcon from '@mui/icons-material/SystemUpdate';
import axios from '../utils/axios';
import logger from '../utils/logger';

function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [open, setOpen] = useState(true);
  const [checking, setChecking] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const response = await axios.get('/api/update-check');
      if (response.data.update) {
        setUpdateInfo(response.data.update);
        logger.info('Update available:', response.data.update);
      }
    } catch (error) {
      logger.error('Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    
    // Open update in new tab
    const updateCommand = `curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/update.sh | bash`;
    
    // Copy command to clipboard
    try {
      await navigator.clipboard.writeText(updateCommand);
      alert('Update command copied to clipboard!\nPaste and run in any terminal.');
    } catch {
      alert(`Run this command in any terminal:\n\n${updateCommand}`);
    }
    
    setUpdating(false);
  };

  if (checking || !updateInfo) {
    return null;
  }

  return (
    <Collapse in={open}>
      <Alert
        severity="info"
        icon={<UpdateIcon />}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleUpdate}
              disabled={updating}
              startIcon={updating ? <CircularProgress size={16} /> : null}
            >
              {updating ? 'Updating...' : 'Update Now'}
            </Button>
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setOpen(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>
        }
        sx={{ mb: 2, backgroundColor: '#1e3a5f', color: 'white' }}
      >
        <AlertTitle sx={{ fontWeight: 'bold' }}>
          MuxTerm v{updateInfo.latest} Available!
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Current version: v{updateInfo.current}
        </Typography>
        
        {updateInfo.changelog && updateInfo.changelog.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              What's new:
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
        
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          Run 'muxterm update' in any terminal or click Update Now
        </Typography>
      </Alert>
    </Collapse>
  );
}

export default UpdateNotification;