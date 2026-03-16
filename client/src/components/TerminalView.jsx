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
  TextField
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  ViewModule as SplitIcon,
  Close as CloseIcon,
  KeyboardArrowDown,
  Keyboard as KeyboardIcon,
  Terminal as TerminalIcon,
  OpenInNew as RestoreIcon
} from '@mui/icons-material';
import Terminal from './Terminal';
import PanelManager from './PanelManager';
import UpdateNotification from './UpdateNotification';
import VersionIndicator from './VersionIndicator';
import AppHeader from './AppHeader';
import SpecialKeysToolbar from './SpecialKeysToolbar';
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
  const sshConnectionId = searchParams.get('ssh') || null;
  const [sessionCreated, setSessionCreated] = useState(false);
  const [splitMenuAnchor, setSplitMenuAnchor] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingPanel, setRenamingPanel] = useState(null);
  const [newPanelName, setNewPanelName] = useState('');
  const [minimizedPanels, setMinimizedPanels] = useState([]);
  
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const bottomBarRef = React.useRef(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice && isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Measure the actual bottom bar height dynamically
  useEffect(() => {
    if (!isMobile || !bottomBarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBottomBarHeight(entry.contentRect.height + 2); // +2 for borders
      }
    });
    observer.observe(bottomBarRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

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

  // Update page title
  useEffect(() => {
    document.title = `MuxTerm - ${sessionName}`;
  }, [sessionName]);
  
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
            // Restaurar paneles minimizados si existen
            if (data.layout.minimizedPanels && Array.isArray(data.layout.minimizedPanels)) {
              setMinimizedPanels(data.layout.minimizedPanels);
            }
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
        logger.debug('Current session:', currentSession);
        logger.debug('Session name from DB:', currentSession?.name);
        logger.debug('Has name in URL:', searchParams.has('name'));
        if (currentSession && currentSession.name && !searchParams.has('name')) {
          logger.debug('Setting session name to:', currentSession.name);
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
              panels.length === 7 ? 'grid-2+2+3' : 'grid-2x4',
        minimizedPanels: minimizedPanels // Guardar el estado de paneles minimizados
      };
      socket.emit('update-session-layout', { sessionId, layout });
    }
  }, [panels, activePanel, sessionId, socket, minimizedPanels]);

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



  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      <UpdateNotification />
      <AppHeader 
        mode="terminal"
        sessionName={sessionName}
        panelCount={panels.length}
        onBack={handleBack}
        onLogout={() => navigate('/sessions')}
        rightContent={
          <>
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

            {isMobile && (
              <IconButton 
                color="inherit" 
                onClick={() => {
                  // Force focus on active terminal's mobile input
                  // First click on the terminal to ensure it's active
                  const activeTerminal = document.querySelector(`[data-panel-id="${activePanel}"] .xterm`);
                  if (activeTerminal) {
                    activeTerminal.click();
                  }
                  // Then try to focus the hidden mobile textarea
                  setTimeout(() => {
                    const mobileInput = document.querySelector(`[data-panel-id="${activePanel}"] textarea`);
                    if (mobileInput) {
                      mobileInput.focus();
                      mobileInput.click();
                    }
                  }, 100);
                }}
                size="small"
                sx={{ ml: 1 }}
              >
                <KeyboardIcon />
              </IconButton>
            )}

          </>
        }
      />

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

      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
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
            sshConnectionId={sshConnectionId}
            onTerminalCreated={(panelId, newTerminalId) => {
              setPanels(prev => prev.map(p =>
                p.id === panelId ? { ...p, terminalId: newTerminalId } : p
              ));
            }}
          />
        ) : null}
      </Box>

      {/* Mobile bottom bars - fixed */}
      {isMobile && (
        <Box
          ref={bottomBarRef}
          sx={{
            flexShrink: 0,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backgroundColor: '#111'
          }}
        >
          {/* Special keys toolbar */}
          <SpecialKeysToolbar
            onKeyPress={(seq) => {
              if (socket && activePanel) {
                const panel = panels.find(p => p.id === activePanel);
                if (panel && panel.terminalId) {
                  if (seq === 'scroll-up' || seq === 'scroll-down') {
                    socket.emit('terminal-scroll', { terminalId: panel.terminalId, direction: seq === 'scroll-up' ? 'up' : 'down' });
                  } else {
                    socket.emit('send-keys', { terminalId: panel.terminalId, keys: seq });
                  }
                }
              }
            }}
            isVisible={true}
            onDismissKeyboard={() => {
              // Blur any focused textarea
              const textarea = document.querySelector('textarea');
              if (textarea) {
                textarea.style.position = 'fixed';
                textarea.style.top = '-9999px';
                textarea.blur();
                setTimeout(() => {
                  if (textarea) {
                    textarea.style.position = 'absolute';
                    textarea.style.top = '50%';
                  }
                }, 300);
              }
            }}
          />
          {/* Tab bar */}
          {panels.length > 1 && (
            <Box
              sx={{
                display: 'flex',
                overflowX: 'auto',
                borderTop: '1px solid #333',
                height: '40px',
                alignItems: 'stretch',
                '&::-webkit-scrollbar': { height: '2px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#555' }
              }}
            >
              {panels.map((panel, idx) => (
                <Box
                  key={`tab-${panel.id}`}
                  onClick={() => setActivePanel(panel.id)}
                  sx={{
                    flex: '1 0 auto',
                    minWidth: '60px',
                    maxWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    borderRight: '1px solid #333',
                    backgroundColor: panel.id === activePanel ? '#1a1a1a' : 'transparent',
                    borderTop: panel.id === activePanel ? '2px solid #00ff00' : '2px solid transparent',
                    '&:hover': { backgroundColor: '#222' }
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: panel.id === activePanel ? '#00ff00' : '#888',
                      fontSize: '11px',
                      fontWeight: panel.id === activePanel ? 'bold' : 'normal',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {panel.name || `T${idx + 1}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

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

    </Box>
  );
}

export default TerminalView;