import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  ViewModule as SplitIcon,
  Close as CloseIcon,
  KeyboardArrowDown,
  Keyboard as KeyboardIcon,
  Terminal as TerminalIcon,
  OpenInNew as RestoreIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import Terminal from './Terminal';
import PanelManager from './PanelManager';
import UpdateNotification from './UpdateNotification';
import { useSocket } from '../utils/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

function TerminalView() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [panels, setPanels] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [sessionName, setSessionName] = useState(searchParams.get('name') || 'Session');
  const [sessionCreated, setSessionCreated] = useState(false);
  const [splitMenuAnchor, setSplitMenuAnchor] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingPanel, setRenamingPanel] = useState(null);
  const [newPanelName, setNewPanelName] = useState('');
  const [minimizedPanels, setMinimizedPanels] = useState([]);
  const [autoYesLog, setAutoYesLog] = useState([]);
  const [showAutoYesLog, setShowAutoYesLog] = useState(false);
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Create session if needed
  useEffect(() => {
    if (socket && sessionId && !sessionCreated && sessionName) {
      // Check if this is a new session (from URL params)
      const urlHasName = searchParams.has('name');
      if (urlHasName) {
        // This is a new session, emit create-session event
        socket.emit('create-session', { name: sessionName });
        setSessionCreated(true);
      }
    }
  }, [socket, sessionId, sessionName, sessionCreated, searchParams]);
  
  // Load session layout on mount
  useEffect(() => {
    if (socket && sessionId) {
      logger.debug('Loading session layout for:', sessionId);
      
      let layoutReceived = false;
      
      // Set a timeout to create initial panel if no response
      const timeoutId = setTimeout(() => {
        if (!layoutReceived && panels.length === 0) {
          logger.debug('No layout received, creating initial panel');
          const initialPanel = {
            id: uuidv4(),
            terminalId: null,
            sessionId: sessionId,
            name: 'Terminal 1'
          };
          setPanels([initialPanel]);
          setActivePanel(initialPanel.id);
        }
      }, 2000);
      
      const handleSessionLayout = (data) => {
        if (data.sessionId === sessionId) {
          layoutReceived = true;
          clearTimeout(timeoutId);
          logger.debug('Received session layout:', data.layout);
          // Restore panels from layout
          if (data.layout && data.layout.panels && data.layout.panels.length > 0) {
            setPanels(data.layout.panels);
            setActivePanel(data.layout.activePanel || data.layout.panels[0].id);
          } else {
            // Create initial panel if no layout exists
            const initialPanel = {
              id: uuidv4(),
              terminalId: null,
              sessionId: sessionId,
              name: 'Terminal 1'
            };
            setPanels([initialPanel]);
            setActivePanel(initialPanel.id);
          }
        }
      };
      
      socket.on('session-layout', handleSessionLayout);
      socket.emit('get-session-layout', { sessionId });
      
      // Also get session info to update name if needed
      socket.emit('get-sessions');
      socket.once('sessions', (sessions) => {
        const currentSession = sessions.find(s => s.id === sessionId);
        if (currentSession && currentSession.name && !searchParams.has('name')) {
          setSessionName(currentSession.name);
        }
      });
      
      return () => {
        clearTimeout(timeoutId);
        socket.off('session-layout', handleSessionLayout);
      };
    }
  }, [socket, sessionId]);
  
  // Save layout whenever panels change
  useEffect(() => {
    if (socket && sessionId && panels.length > 0) {
      logger.debug('Saving session layout:', panels);
      const layout = {
        panels: panels,
        activePanel: activePanel,
        type: panels.length === 1 ? 'single' : 
              panels.length === 2 ? 'horizontal' : 
              panels.length === 3 ? 'vertical-right' : 
              panels.length === 4 ? 'grid-2x2' :
              panels.length === 5 ? 'grid-2+3' :
              panels.length === 6 ? 'grid-2x3' :
              panels.length === 7 ? 'grid-2+2+3' : 'grid-2x4'
      };
      socket.emit('update-session-layout', { sessionId, layout });
    }
  }, [panels, activePanel, sessionId, socket]);

  const handleSplitHorizontal = () => {
    if (panels.length >= 8) {
      alert('Maximum 8 panels supported');
      return;
    }
    logger.debug('[TerminalView] Current panels before split:', panels);
    const newPanel = {
      id: uuidv4(),
      terminalId: null,
      sessionId: sessionId,
      name: `Terminal ${panels.length + 1}`
    };
    const updatedPanels = [...panels, newPanel];
    logger.debug('[TerminalView] Panels after split:', updatedPanels);
    setPanels(updatedPanels);
    setActivePanel(newPanel.id);
    setSplitMenuAnchor(null);
  };

  const handleSplitVertical = () => {
    handleSplitHorizontal(); // Same behavior for now with the grid layout
  };

  const handleClosePanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    if (panel && panel.terminalId && socket) {
      socket.emit('close-terminal', {
        terminalId: panel.terminalId,
        sessionId: sessionId
      });
    }
    
    const newPanels = panels.filter(p => p.id !== panelId);
    setPanels(newPanels);
    
    if (activePanel === panelId && newPanels.length > 0) {
      setActivePanel(newPanels[0].id);
    }
  };

  const handleBack = () => {
    // Simply navigate back without closing terminals
    // This preserves the session for future use
    navigate('/sessions');
  };

  
  const handleRenamePanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      setRenamingPanel(panelId);
      setNewPanelName(panel.name || '');
      setRenameDialogOpen(true);
    }
  };
  
  const confirmRenamePanel = () => {
    if (renamingPanel && newPanelName.trim()) {
      setPanels(panels.map(p => 
        p.id === renamingPanel 
          ? { ...p, name: newPanelName.trim() }
          : p
      ));
      // También actualizar paneles minimizados si existe
      setMinimizedPanels(minimizedPanels.map(p => 
        p.id === renamingPanel 
          ? { ...p, name: newPanelName.trim() }
          : p
      ));
    }
    setRenameDialogOpen(false);
    setRenamingPanel(null);
    setNewPanelName('');
  };
  
  const handleMinimizePanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      // Agregar a minimizados
      setMinimizedPanels([...minimizedPanels, panel]);
      
      // Remover de paneles activos
      const newPanels = panels.filter(p => p.id !== panelId);
      setPanels(newPanels);
      
      // Si era el panel activo, seleccionar otro
      if (activePanel === panelId && newPanels.length > 0) {
        setActivePanel(newPanels[0].id);
      }
    }
  };
  
  const handleRestorePanel = (panel) => {
    // Remover de minimizados
    setMinimizedPanels(minimizedPanels.filter(p => p.id !== panel.id));
    
    // Agregar a paneles activos
    setPanels([...panels, panel]);
    setActivePanel(panel.id);
  };

  const handleAutoYesLog = (panelId, prompt, response) => {
    const panel = panels.find(p => p.id === panelId);
    const logEntry = {
      timestamp: new Date().toISOString(),
      panelName: panel?.name || 'Unknown',
      panelId,
      prompt: prompt.substring(0, 100), // First 100 chars of prompt
      response
    };
    setAutoYesLog(prev => [...prev, logEntry]);
  };


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <UpdateNotification />
      <AppBar position="static" className="toolbar">
        <Toolbar variant="dense">
          <IconButton 
            edge="start" 
            color="inherit" 
            onClick={handleBack}
            size="small"
            sx={{ mr: 1 }}
          >
            <BackIcon />
          </IconButton>
          
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {isMobile ? `${panels.length}P` : `${sessionName} - ${panels.length}P`}
          </Typography>

          {!isMobile ? (
            <Button
              color="inherit"
              size="small"
              startIcon={<SplitIcon />}
              endIcon={<KeyboardArrowDown />}
              onClick={(e) => setSplitMenuAnchor(e.currentTarget)}
              sx={{ mr: 1 }}
            >
              Split
            </Button>
          ) : panels.length < 8 && (
            <IconButton
              color="inherit"
              size="small"
              onClick={(e) => setSplitMenuAnchor(e.currentTarget)}
              sx={{ ml: 1 }}
            >
              <SplitIcon />
            </IconButton>
          )}

          <Menu
            anchorEl={splitMenuAnchor}
            open={Boolean(splitMenuAnchor)}
            onClose={() => setSplitMenuAnchor(null)}
          >
            <MenuItem onClick={handleSplitHorizontal}>
              Split Horizontal
            </MenuItem>
            <MenuItem onClick={handleSplitVertical}>
              Split Vertical
            </MenuItem>
          </Menu>

          {isMobile && (
            <IconButton 
              color="inherit" 
              onClick={() => {
                // Force focus on active terminal's mobile input
                const activePanelElement = document.querySelector(`[data-panel-id="${activePanel}"] input[type="text"]`);
                if (activePanelElement) {
                  activePanelElement.focus();
                }
              }}
              size="small"
              sx={{ ml: 1 }}
            >
              <KeyboardIcon />
            </IconButton>
          )}

          <IconButton 
            color="inherit" 
            onClick={() => setShowAutoYesLog(!showAutoYesLog)}
            size="small"
            sx={{ 
              ml: 1,
              color: autoYesLog.length > 0 ? '#00ff00' : 'inherit'
            }}
            title={`Auto-Yes Log (${autoYesLog.length})`}
          >
            <HistoryIcon />
          </IconButton>

        </Toolbar>
      </AppBar>

      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        paddingBottom: minimizedPanels.length > 0 ? (isMobile ? '36px' : '56px') : 0
      }}>
        {panels.length > 0 ? (
          <PanelManager
            key="panel-manager"
            panels={panels}
            activePanel={activePanel}
            onPanelSelect={setActivePanel}
            onPanelClose={handleClosePanel}
            onRenamePanel={handleRenamePanel}
            onMinimizePanel={handleMinimizePanel}
            sessionId={sessionId}
            onTerminalCreated={(panelId, newTerminalId) => {
              setPanels(prev => prev.map(p => 
                p.id === panelId ? { ...p, terminalId: newTerminalId } : p
              ));
            }}
            onAutoYesLog={handleAutoYesLog}
          />
        ) : null}
      </Box>

      {/* Bandeja de ventanas minimizadas */}
      {minimizedPanels.length > 0 && (
        <Box 
          sx={{
            position: 'fixed',
            bottom: isMobile ? 0 : 20, // Encima de la status bar si no es móvil
            left: 0,
            right: 0,
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: '4px 8px',
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            zIndex: 1000,
            overflowX: 'auto',
            height: isMobile ? '36px' : '36px'
          }}
        >
          <Typography variant="caption" sx={{ color: '#666', mr: 1 }}>
            Minimized:
          </Typography>
          {minimizedPanels.map(panel => (
            <Button
              key={panel.id}
              size="small"
              variant="outlined"
              startIcon={<TerminalIcon sx={{ fontSize: 14 }} />}
              onClick={() => handleRestorePanel(panel)}
              sx={{
                minWidth: 'auto',
                padding: '2px 8px',
                fontSize: '11px',
                borderColor: '#333',
                color: '#888',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#00ff00',
                  color: '#00ff00',
                  backgroundColor: 'rgba(0, 255, 0, 0.1)'
                }
              }}
            >
              {panel.name || 'Terminal'}
            </Button>
          ))}
        </Box>
      )}

      {!isMobile && minimizedPanels.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: '36px',
            left: 0,
            right: 0,
            height: '20px',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            zIndex: 999
          }}
        >
          <Typography variant="caption" component="span" sx={{ fontSize: '10px', color: '#888' }}>
            {sessionName} | {panels.length} panels
          </Typography>
        </Box>
      )}

      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Panel</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Panel Name"
            fullWidth
            variant="outlined"
            value={newPanelName}
            onChange={(e) => setNewPanelName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                confirmRenamePanel();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmRenamePanel} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showAutoYesLog}
        onClose={() => setShowAutoYesLog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Auto-Yes Log ({autoYesLog.length} entries)</DialogTitle>
        <DialogContent>
          {autoYesLog.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', py: 2 }}>
              No auto-confirmations yet
            </Typography>
          ) : (
            <List dense>
              {autoYesLog.slice().reverse().map((entry, index) => (
                <ListItem key={index} sx={{ borderBottom: '1px solid #333', py: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {entry.panelName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#aaa', fontFamily: 'monospace' }}>
                          Prompt: {entry.prompt}...
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#0f0', display: 'block', mt: 0.5 }}>
                          Response: {entry.response}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoYesLog([])}>Clear Log</Button>
          <Button onClick={() => setShowAutoYesLog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TerminalView;