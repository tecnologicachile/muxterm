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
import axios from '../utils/axios';
import logger from '../utils/logger';

// Version actual del cliente
const CURRENT_VERSION = '1.0.0';

function VersionIndicator() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    // Check on mount
    checkForUpdates();
    
    // Check every 30 minutes while app is open
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const response = await axios.get('/api/update-check');
      if (response.data.update) {
        setUpdateInfo(response.data.update);
        logger.info('Update available:', response.data.update);
      } else {
        setUpdateInfo(null);
      }
      setLastCheck(new Date());
    } catch (error) {
      logger.error('Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    
    const updateCommand = `curl -fsSL https://raw.githubusercontent.com/tecnologicachile/muxterm/main/update.sh | bash`;
    
    try {
      await navigator.clipboard.writeText(updateCommand);
      alert('Comando de actualización copiado al portapapeles!\nPégalo y ejecútalo en cualquier terminal.');
    } catch {
      alert(`Ejecuta este comando en cualquier terminal:\n\n${updateCommand}`);
    }
    
    setUpdating(false);
  };

  const hasUpdate = updateInfo !== null;
  const chipColor = hasUpdate ? 'warning' : 'default';
  const chipIcon = checking ? <CircularProgress size={14} /> : 
                   hasUpdate ? <UpdateIcon fontSize="small" /> : 
                   <CheckCircleIcon fontSize="small" />;

  return (
    <>
      <Tooltip title={hasUpdate ? "¡Nueva versión disponible!" : "MuxTerm está actualizado"}>
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
            Información de Versión
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="body2" gutterBottom>
              <strong>Versión actual:</strong> v{CURRENT_VERSION}
            </Typography>
            
            {hasUpdate ? (
              <>
                <Typography variant="body2" color="warning.main" gutterBottom>
                  <strong>Nueva versión disponible:</strong> v{updateInfo.latest}
                </Typography>
                
                {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Novedades en v{updateInfo.latest}:
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
                ✓ MuxTerm está actualizado
              </Typography>
            )}
            
            {lastCheck && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Última verificación: {lastCheck.toLocaleTimeString()}
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cerrar
          </Button>
          {hasUpdate && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleUpdate}
              disabled={updating}
              startIcon={updating ? <CircularProgress size={16} /> : <UpdateIcon />}
            >
              {updating ? 'Copiando...' : 'Actualizar Ahora'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default VersionIndicator;