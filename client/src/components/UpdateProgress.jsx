import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Button,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import logger from '../utils/logger';

function UpdateProgress({ open, onClose, version }) {
  const [status, setStatus] = useState('starting');
  const [steps, setSteps] = useState([
    { id: 'backup', label: 'Backing up configuration', status: 'pending' },
    { id: 'download', label: 'Downloading update', status: 'pending' },
    { id: 'install', label: 'Installing dependencies', status: 'pending' },
    { id: 'build', label: 'Building frontend', status: 'pending' },
    { id: 'restart', label: 'Restarting service', status: 'pending' },
    { id: 'verify', label: 'Verifying installation', status: 'pending' }
  ]);
  const [error, setError] = useState(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const maxPollAttempts = 90; // 3 minutes (2s intervals)

  useEffect(() => {
    if (open) {
      startUpdate();
    }
  }, [open]);

  const startUpdate = async () => {
    setStatus('updating');
    setError(null);
    
    try {
      // Start the update
      const response = await axios.post('/api/update-execute');
      
      if (response.data.success) {
        // Start simulating progress
        simulateProgress();
        // Start polling for service availability when restart begins
        setTimeout(() => startPolling(), 65000); // Wait 65s (just before restart step)
      } else {
        setError('Failed to start update');
        setStatus('error');
      }
    } catch (error) {
      logger.error('Update execution failed:', error);
      setError(error.message);
      setStatus('error');
    }
  };

  const simulateProgress = () => {
    // Simulate progress through steps with more realistic timing
    // Total update usually takes 60-120 seconds
    const timings = [
      5000,   // Backup (5s)
      15000,  // Download (15s)
      25000,  // Install dependencies (25s)
      50000,  // Build frontend (50s)
      70000,  // Restart service (70s)
      // Verifying is handled by actual polling, not simulation
    ];
    
    timings.forEach((delay, index) => {
      setTimeout(() => {
        setSteps(prev => prev.map((step, i) => ({
          ...step,
          status: i < index ? 'completed' : i === index ? 'active' : 'pending'
        })));
      }, delay);
    });
  };

  const startPolling = async () => {
    logger.info('Starting to poll for service availability');
    setStatus('polling');
    pollForService();
  };

  const pollForService = async () => {
    if (pollAttempts >= maxPollAttempts) {
      // Mark the current active step as the one that timed out
      setSteps(prev => prev.map(step => ({
        ...step,
        status: step.status === 'active' ? 'error' : step.status
      })));
      setError('Update is taking longer than expected. The update may still be in progress. Please wait a moment and reload the page.');
      setStatus('timeout');
      return;
    }

    try {
      // Try to reach the API
      logger.debug(`Polling attempt ${pollAttempts + 1}/${maxPollAttempts}`);
      const response = await axios.get('/api/update-check', { 
        timeout: 2000,
        validateStatus: () => true // Accept any status
      });
      
      logger.debug(`Poll response status: ${response.status}`);
      if (response.status === 200) {
        // Service is back! Mark restart as complete and verify as active
        setSteps(prev => prev.map((step, index) => ({ 
          ...step, 
          status: index < 5 ? 'completed' : index === 5 ? 'active' : 'pending' 
        })));
        
        // Quick verification then mark complete
        setTimeout(() => {
          setSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
          setStatus('completed');
          
          // Wait a bit then reload
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }, 1000);
      } else {
        // Service not ready yet, continue polling
        setPollAttempts(prev => prev + 1);
        setTimeout(() => pollForService(), 2000);
      }
    } catch (error) {
      // Service not reachable yet, continue polling
      setPollAttempts(prev => prev + 1);
      setTimeout(() => pollForService(), 2000);
    }
  };

  const getStepIcon = (stepStatus) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'active':
        return <CircularProgress size={20} />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getProgressValue = () => {
    const completed = steps.filter(s => s.status === 'completed').length;
    return (completed / steps.length) * 100;
  };

  return (
    <Dialog 
      open={open} 
      onClose={status === 'completed' || status === 'error' ? onClose : undefined}
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={status === 'updating' || status === 'polling'}
    >
      <DialogContent sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Updating to v{version}
          </Typography>
          
          {status === 'updating' && (
            <Typography variant="body2" color="text.secondary">
              Please wait while MuxTerm is being updated...
            </Typography>
          )}
          
          {status === 'polling' && (
            <Typography variant="body2" color="text.secondary">
              Waiting for service to restart... ({pollAttempts}/{maxPollAttempts})
            </Typography>
          )}
          
          {status === 'completed' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Update completed! Reloading...
            </Alert>
          )}
          
          {(status === 'error' || status === 'timeout') && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error || 'Update failed. Please check the logs.'}
            </Alert>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <LinearProgress 
            variant="determinate" 
            value={getProgressValue()} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <List dense>
          {steps.map((step) => (
            <ListItem key={step.id}>
              <ListItemIcon>
                {getStepIcon(step.status)}
              </ListItemIcon>
              <ListItemText 
                primary={step.label}
                primaryTypographyProps={{
                  color: step.status === 'active' ? 'primary' : 'textPrimary'
                }}
              />
            </ListItem>
          ))}
        </List>

        {status === 'timeout' && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
              sx={{ mr: 2 }}
            >
              Reload Page
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setPollAttempts(0);
                setStatus('polling');
                setError(null);
                pollForService();
              }}
            >
              Keep Waiting
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UpdateProgress;