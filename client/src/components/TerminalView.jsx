import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Add as AddIcon,
  Keyboard as KeyboardIcon,
  Terminal as TerminalIcon,
  OpenInNew as RestoreIcon,
  FiberManualRecord as DotIcon,
  Minimize as MinimizeIcon
} from '@mui/icons-material';
import PanelManager from './PanelManager';
import UpdateNotification from './UpdateNotification';
import AppHeader from './AppHeader';
import SpecialKeysToolbar from './SpecialKeysToolbar';
import { useSocket } from '../utils/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

function TerminalView() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [panels, setPanels] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingPanel, setRenamingPanel] = useState(null);
  const [newPanelName, setNewPanelName] = useState('');
  const [minimizedPanels, setMinimizedPanels] = useState([]);
  
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [newTerminalDialogOpen, setNewTerminalDialogOpen] = useState(false);
  const [newTerminalType, setNewTerminalType] = useState('local');
  const [sshConnections, setSshConnections] = useState([]);
  const [selectedSshConnection, setSelectedSshConnection] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [rdpConnections, setRdpConnections] = useState([]);
  const [selectedRdpConnection, setSelectedRdpConnection] = useState('');
  const [rdpHost, setRdpHost] = useState('');
  const [rdpPort, setRdpPort] = useState('3389');
  const [rdpUsername, setRdpUsername] = useState('');
  const [rdpPassword, setRdpPassword] = useState('');
  const [rdpDomain, setRdpDomain] = useState('');
  const [vncConnections, setVncConnections] = useState([]);
  const [selectedVncConnection, setSelectedVncConnection] = useState('');
  const [vncHost, setVncHost] = useState('');
  const [vncPort, setVncPort] = useState('5900');
  const [vncPassword, setVncPassword] = useState('');
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState('22');
  const [sftpUsername, setSftpUsername] = useState('');
  const [sftpPassword, setSftpPassword] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const sidebarTimeoutRef = React.useRef(null);
  const sidebarFilterRef = React.useRef(null);

  // Load SSH and RDP connections
  useEffect(() => {
    if (!socket) return;
    const handleSshConnections = (conns) => setSshConnections(conns);
    const handleRdpConnections = (conns) => setRdpConnections(conns);
    const handleVncConnections = (conns) => setVncConnections(conns);
    socket.on('ssh-connections', handleSshConnections);
    socket.on('rdp-connections', handleRdpConnections);
    socket.on('vnc-connections', handleVncConnections);
    socket.emit('get-ssh-connections');
    socket.emit('get-rdp-connections');
    socket.emit('get-vnc-connections');
    return () => {
      socket.off('ssh-connections', handleSshConnections);
      socket.off('rdp-connections', handleRdpConnections);
      socket.off('vnc-connections', handleVncConnections);
    };
  }, [socket]);

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

  // Update page title
  useEffect(() => {
    document.title = 'MuxTerm - Workspace';
  }, []);

  // Load workspace on mount
  useEffect(() => {
    if (!socket) return;

    let workspaceReceived = false;

    const timeoutId = setTimeout(() => {
      if (!workspaceReceived && panels.length === 0) {
        const initialPanel = {
          id: uuidv4(),
          terminalId: null,
          name: 'Terminal 1'
        };
        setPanels([initialPanel]);
        setActivePanel(initialPanel.id);
        setTerminalCounter(2);
      }
    }, 2000);

    const handleWorkspace = (data) => {
      workspaceReceived = true;
      clearTimeout(timeoutId);
      if (data && data.panels && data.panels.length > 0) {
        setPanels(data.panels);
        setActivePanel(data.activePanel || data.panels[0].id);
        const allRestored = [...data.panels];
        if (data.minimizedPanels && Array.isArray(data.minimizedPanels)) {
          const seen = new Set();
          const dedupedMinimized = data.minimizedPanels.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
          setMinimizedPanels(dedupedMinimized);
          allRestored.push(...dedupedMinimized);
        }
        const maxNum = allRestored.reduce((max, p) => {
          const match = (p.name || '').match(/^Terminal (\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        setTerminalCounter(maxNum + 1);
      } else {
        const initialPanel = {
          id: uuidv4(),
          terminalId: null,
          name: 'Terminal 1'
        };
        setPanels([initialPanel]);
        setActivePanel(initialPanel.id);
        setTerminalCounter(2);
      }
    };

    socket.on('workspace', handleWorkspace);
    socket.emit('get-workspace');

    return () => {
      clearTimeout(timeoutId);
      socket.off('workspace', handleWorkspace);
    };
  }, [socket]);

  // Save workspace whenever panels change
  useEffect(() => {
    if (socket && panels.length > 0) {
      socket.emit('update-workspace', {
        panels,
        activePanel,
        minimizedPanels
      });
    }
  }, [panels, activePanel, socket, minimizedPanels]);

  // Keyboard shortcut Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'b' && !isMobile && (panels.length + minimizedPanels.length) > 1) {
        e.preventDefault();
        setSidebarOpen(prev => {
          const next = !prev;
          if (next) {
            setTimeout(() => sidebarFilterRef.current?.focus(), 100);
          } else {
            setSidebarFilter('');
          }
          return next;
        });
      }
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
        setSidebarFilter('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, panels.length, minimizedPanels.length, sidebarOpen]);



  const handleNewTerminal = () => {
    if (panels.length >= 8) {
      alert('Maximum 8 panels supported');
      return;
    }
    setNewTerminalType('local');
    setSelectedSshConnection('');
    setSshHost('');
    setSshPort('22');
    setSshUsername('');
    setSshPassword('');
    setSelectedRdpConnection('');
    setRdpHost('');
    setRdpPort('3389');
    setRdpUsername('');
    setRdpPassword('');
    setRdpDomain('');
    setSelectedVncConnection('');
    setVncHost('');
    setVncPort('5900');
    setVncPassword('');
    setSftpHost('');
    setSftpPort('22');
    setSftpUsername('');
    setSftpPassword('');
    setNewTerminalDialogOpen(true);
  };

  const handleCreateTerminal = () => {
    let termName = `Terminal ${terminalCounter}`;
    let newPanel;

    if (newTerminalType === 'ssh') {
      if (selectedSshConnection) {
        const conn = sshConnections.find(c => c.id === parseInt(selectedSshConnection));
        newPanel = { id: uuidv4(), terminalId: null, name: conn?.name || termName, type: 'ssh', sshConnectionId: parseInt(selectedSshConnection) };
      } else if (sshHost) {
        socket.emit('create-ssh-connection', {
          name: `${sshUsername}@${sshHost}`, host: sshHost, port: parseInt(sshPort) || 22,
          username: sshUsername, authType: 'password', password: sshPassword
        });
        socket.once('ssh-connection-created', (conn) => {
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'ssh', sshConnectionId: conn.id };
          setTerminalCounter(prev => prev + 1);
          setPanels(prev => [...prev, p]);
          setActivePanel(p.id);
        });
        setNewTerminalDialogOpen(false);
        return;
      } else {
        return;
      }
    } else if (newTerminalType === 'rdp') {
      if (selectedRdpConnection) {
        const conn = rdpConnections.find(c => c.id === parseInt(selectedRdpConnection));
        newPanel = { id: uuidv4(), terminalId: null, name: conn?.name || termName, type: 'rdp', rdpConnectionId: parseInt(selectedRdpConnection), displayMode: 'fit' };
      } else if (rdpHost) {
        socket.emit('create-rdp-connection', {
          name: `${rdpUsername}@${rdpHost}`, host: rdpHost, port: parseInt(rdpPort) || 3389,
          username: rdpUsername, password: rdpPassword, domain: rdpDomain
        });
        socket.once('rdp-connection-created', (conn) => {
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'rdp', rdpConnectionId: conn.id, displayMode: 'fit' };
          setTerminalCounter(prev => prev + 1);
          setPanels(prev => [...prev, p]);
          setActivePanel(p.id);
        });
        setNewTerminalDialogOpen(false);
        return;
      } else {
        return;
      }
    } else if (newTerminalType === 'vnc') {
      if (selectedVncConnection) {
        const conn = vncConnections.find(c => c.id === parseInt(selectedVncConnection));
        newPanel = { id: uuidv4(), terminalId: null, name: conn?.name || termName, type: 'vnc', vncConnectionId: parseInt(selectedVncConnection) };
      } else if (vncHost) {
        socket.emit('create-vnc-connection', {
          name: `VNC ${vncHost}`, host: vncHost, port: parseInt(vncPort) || 5900, password: vncPassword
        });
        socket.once('vnc-connection-created', (conn) => {
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'vnc', vncConnectionId: conn.id };
          setTerminalCounter(prev => prev + 1);
          setPanels(prev => [...prev, p]);
          setActivePanel(p.id);
        });
        setNewTerminalDialogOpen(false);
        return;
      } else {
        return;
      }
    } else if (newTerminalType === 'sftp') {
      if (sftpHost) {
        const filestashPort = 8334;
        const filestashHost = window.location.hostname;
        const sftpUrl = `${window.location.protocol}//${filestashHost}:${filestashPort}/login?type=sftp&hostname=${sftpHost}&port=${sftpPort}&username=${encodeURIComponent(sftpUsername)}&password=${encodeURIComponent(sftpPassword)}`;
        newPanel = { id: uuidv4(), terminalId: null, name: `${sftpUsername}@${sftpHost}`, type: 'sftp', sftpUrl };
      } else {
        return;
      }
    } else {
      newPanel = { id: uuidv4(), terminalId: null, name: termName, type: 'local' };
    }

    setTerminalCounter(prev => prev + 1);
    setPanels(prev => [...prev, newPanel]);
    setActivePanel(newPanel.id);
    setNewTerminalDialogOpen(false);
  };

  const handleClosePanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    if (panel && panel.terminalId && socket) {
      socket.emit('close-terminal', {
        terminalId: panel.terminalId
      });
    }
    
    const newPanels = panels.filter(p => p.id !== panelId);
    setPanels(newPanels);
    
    if (activePanel === panelId && newPanels.length > 0) {
      setActivePanel(newPanels[0].id);
    }
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
      // Agregar a minimizados (prevenir duplicados)
      setMinimizedPanels(prev =>
        prev.some(p => p.id === panelId) ? prev : [...prev, panel]
      );

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
    setMinimizedPanels(prev => prev.filter(p => p.id !== panel.id));

    // Agregar a paneles activos (prevenir duplicados)
    setPanels(prev =>
      prev.some(p => p.id === panel.id) ? prev : [...prev, panel]
    );
    setActivePanel(panel.id);
  };



  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      <UpdateNotification />
      <AppHeader
        mode="terminal"
        sessionName="Workspace"
        panelCount={panels.length}
        onLogout={() => navigate('/login')}
        rightContent={
          <>
            {panels.length < 8 && (
              !isMobile ? (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleNewTerminal}
                  sx={{ mr: 1 }}
                >
                  Terminal
                </Button>
              ) : (
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={handleNewTerminal}
                  sx={{ ml: 1 }}
                >
                  <AddIcon />
                </IconButton>
              )
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


      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0
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

      {/* Sidebar colapsable izquierdo - navegación de terminales */}
      {!isMobile && (panels.length + minimizedPanels.length) > 1 && (() => {
        const allPanels = [
          ...panels.map((p, i) => ({ ...p, status: 'active', displayName: p.name || `Terminal ${i + 1}` })),
          ...minimizedPanels.map(p => ({ ...p, status: 'minimized', displayName: p.name || 'Terminal' }))
        ];
        const filtered = sidebarFilter
          ? allPanels.filter(p => p.displayName.toLowerCase().includes(sidebarFilter.toLowerCase()))
          : allPanels;
        const filteredActive = filtered.filter(p => p.status === 'active');
        const filteredMinimized = filtered.filter(p => p.status === 'minimized');

        return (
          <>
            {/* Indicador visual - pestaña visible cuando cerrado */}
            {!sidebarOpen && (
              <Box
                onMouseEnter={() => {
                  clearTimeout(sidebarTimeoutRef.current);
                  setSidebarOpen(true);
                }}
                onClick={() => setSidebarOpen(true)}
                sx={{
                  position: 'fixed',
                  top: '50%',
                  left: 0,
                  transform: 'translateY(-50%)',
                  width: '14px',
                  height: '48px',
                  backgroundColor: 'rgba(30, 30, 30, 0.9)',
                  borderRadius: '0 6px 6px 0',
                  border: '1px solid #333',
                  borderLeft: 'none',
                  zIndex: 1001,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    width: '18px',
                    backgroundColor: 'rgba(0, 255, 0, 0.15)',
                    borderColor: '#00ff00',
                    '& .tab-indicator': { backgroundColor: '#00ff00' }
                  }
                }}
              >
                <Box
                  className="tab-indicator"
                  sx={{
                    width: '3px',
                    height: '20px',
                    backgroundColor: '#555',
                    borderRadius: '2px',
                    transition: 'background-color 0.15s ease'
                  }}
                />
              </Box>
            )}

            {/* Zona de activación - franja invisible en el borde izquierdo */}
            <Box
              onMouseEnter={() => {
                clearTimeout(sidebarTimeoutRef.current);
                setSidebarOpen(true);
              }}
              sx={{
                position: 'fixed',
                top: 64,
                left: 0,
                bottom: 0,
                width: '6px',
                zIndex: 1002,
                cursor: 'pointer'
              }}
            />

            {/* Sidebar expandido - altura auto, centrado vertical */}
            {sidebarOpen && (
              <Box
                onMouseEnter={() => {
                  clearTimeout(sidebarTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  sidebarTimeoutRef.current = setTimeout(() => {
                    setSidebarOpen(false);
                    setSidebarFilter('');
                  }, 400);
                }}
                sx={{
                  position: 'fixed',
                  top: '50%',
                  left: 0,
                  transform: 'translateY(-50%)',
                  width: '220px',
                  maxHeight: 'calc(100vh - 100px)',
                  backgroundColor: 'rgba(18, 18, 18, 0.97)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid #333',
                  borderLeft: 'none',
                  borderRadius: '0 10px 10px 0',
                  boxShadow: '4px 0 24px rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'slideIn 0.15s ease-out',
                  '@keyframes slideIn': {
                    from: { opacity: 0, transform: 'translateY(-50%) translateX(-10px)' },
                    to: { opacity: 1, transform: 'translateY(-50%) translateX(0)' }
                  }
                }}
              >
                {/* Header con título y atajo */}
                <Box sx={{ padding: '10px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Terminals
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#444', fontSize: '9px', fontFamily: 'monospace' }}>
                    Ctrl+B
                  </Typography>
                </Box>

                {/* Buscador */}
                <Box sx={{ padding: '0 8px 8px' }}>
                  <input
                    ref={sidebarFilterRef}
                    type="text"
                    placeholder="Filter..."
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filtered.length === 1) {
                        const item = filtered[0];
                        if (item.status === 'active') {
                          setActivePanel(item.id);
                        } else {
                          handleRestorePanel(item);
                        }
                        setSidebarOpen(false);
                        setSidebarFilter('');
                      }
                      if (e.key === 'Escape') {
                        setSidebarOpen(false);
                        setSidebarFilter('');
                      }
                      e.stopPropagation();
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#ccc',
                      fontSize: '11px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </Box>

                {/* Lista de paneles */}
                <Box sx={{
                  overflowY: 'auto',
                  padding: '2px 0',
                  '&::-webkit-scrollbar': { width: '3px' },
                  '&::-webkit-scrollbar-thumb': { backgroundColor: '#444', borderRadius: '3px' }
                }}>
                  {/* Activos */}
                  {filteredActive.map(panel => (
                    <Box
                      key={`sidebar-active-${panel.id}`}
                      onClick={() => {
                        setActivePanel(panel.id);
                        setSidebarOpen(false);
                        setSidebarFilter('');
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 12px',
                        cursor: 'pointer',
                        backgroundColor: panel.id === activePanel ? 'rgba(0, 255, 0, 0.08)' : 'transparent',
                        borderLeft: panel.id === activePanel ? '2px solid #00ff00' : '2px solid transparent',
                        transition: 'all 0.1s ease',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          '& .sidebar-minimize': { opacity: 1 }
                        }
                      }}
                    >
                      <DotIcon sx={{ fontSize: 8, color: '#00ff00' }} />
                      <TerminalIcon sx={{ fontSize: 14, color: panel.id === activePanel ? '#00ff00' : '#999' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          flex: 1,
                          fontSize: '12px',
                          color: panel.id === activePanel ? '#00ff00' : '#ddd',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {panel.displayName}
                      </Typography>
                      {panels.length > 1 && (
                        <IconButton
                          className="sidebar-minimize"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMinimizePanel(panel.id);
                          }}
                          sx={{ opacity: 0, padding: '2px', color: '#666', transition: 'opacity 0.1s', '&:hover': { color: '#fff' } }}
                        >
                          <MinimizeIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                    </Box>
                  ))}

                  {/* Separador y minimizados */}
                  {filteredMinimized.length > 0 && (
                    <>
                      <Box sx={{ padding: '8px 12px 4px', borderTop: '1px solid #222', mt: '4px' }}>
                        <Typography variant="caption" sx={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Minimized
                        </Typography>
                      </Box>
                      {filteredMinimized.map(panel => (
                        <Box
                          key={`sidebar-min-${panel.id}`}
                          onClick={() => {
                            handleRestorePanel(panel);
                            setSidebarOpen(false);
                            setSidebarFilter('');
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 12px',
                            cursor: 'pointer',
                            borderLeft: '2px solid transparent',
                            opacity: 0.5,
                            transition: 'all 0.1s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              opacity: 1
                            }
                          }}
                        >
                          <DotIcon sx={{ fontSize: 8, color: '#444' }} />
                          <TerminalIcon sx={{ fontSize: 14, color: '#555' }} />
                          <Typography
                            variant="caption"
                            sx={{
                              flex: 1,
                              fontSize: '12px',
                              color: '#777',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {panel.displayName}
                          </Typography>
                          <RestoreIcon sx={{ fontSize: 12, color: '#555' }} />
                        </Box>
                      ))}
                    </>
                  )}

                  {/* Sin resultados */}
                  {filtered.length === 0 && sidebarFilter && (
                    <Box sx={{ padding: '12px', textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#555', fontSize: '11px' }}>
                        No matches
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Footer */}
                <Box sx={{ padding: '6px 12px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#444', fontSize: '10px' }}>
                    {panels.length} active{minimizedPanels.length > 0 ? ` · ${minimizedPanels.length} min` : ''}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        );
      })()}

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

      {/* New Terminal Dialog */}
      <Dialog
        open={newTerminalDialogOpen}
        onClose={() => setNewTerminalDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New Terminal</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <Button
              variant={newTerminalType === 'local' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setNewTerminalType('local')}
              sx={{ flex: 1 }}
            >
              Local Terminal
            </Button>
            <Button
              variant={newTerminalType === 'ssh' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setNewTerminalType('ssh')}
              sx={{ flex: 1 }}
            >
              SSH
            </Button>
            <Button
              variant={newTerminalType === 'rdp' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setNewTerminalType('rdp')}
              sx={{ flex: 1 }}
            >
              RDP
            </Button>
            <Button
              variant={newTerminalType === 'vnc' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setNewTerminalType('vnc')}
              sx={{ flex: 1 }}
            >
              VNC
            </Button>
            <Button
              variant={newTerminalType === 'sftp' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setNewTerminalType('sftp')}
              sx={{ flex: 1 }}
            >
              SFTP
            </Button>
          </Box>

          {newTerminalType === 'ssh' && (
            <Box sx={{ mt: 1 }}>
              {sshConnections.length > 0 && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  margin="dense"
                  label="Saved Connection"
                  value={selectedSshConnection}
                  onChange={(e) => {
                    setSelectedSshConnection(e.target.value);
                    if (e.target.value) {
                      const conn = sshConnections.find(c => c.id === parseInt(e.target.value));
                      if (conn) {
                        setSshHost(conn.host);
                        setSshPort(conn.port.toString());
                        setSshUsername(conn.username);
                      }
                    }
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="">-- New Connection --</option>
                  {sshConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.username}@{conn.host})
                    </option>
                  ))}
                </TextField>
              )}

              {!selectedSshConnection && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      margin="dense"
                      label="Host"
                      variant="outlined"
                      size="small"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      sx={{ flex: 3 }}
                      placeholder="192.168.1.100"
                    />
                    <TextField
                      margin="dense"
                      label="Port"
                      variant="outlined"
                      size="small"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <TextField
                    margin="dense"
                    label="Username"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="root"
                  />
                  <TextField
                    margin="dense"
                    label="Password"
                    type="password"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateTerminal();
                    }}
                  />
                </>
              )}
            </Box>
          )}

          {newTerminalType === 'rdp' && (
            <Box sx={{ mt: 1 }}>
              {rdpConnections.length > 0 && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  margin="dense"
                  label="Saved Connection"
                  value={selectedRdpConnection}
                  onChange={(e) => {
                    setSelectedRdpConnection(e.target.value);
                    if (e.target.value) {
                      const conn = rdpConnections.find(c => c.id === parseInt(e.target.value));
                      if (conn) {
                        setRdpHost(conn.host);
                        setRdpPort(conn.port.toString());
                        setRdpUsername(conn.username);
                      }
                    }
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="">-- New Connection --</option>
                  {rdpConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.username}@{conn.host})
                    </option>
                  ))}
                </TextField>
              )}

              {!selectedRdpConnection && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      margin="dense"
                      label="Host"
                      variant="outlined"
                      size="small"
                      value={rdpHost}
                      onChange={(e) => setRdpHost(e.target.value)}
                      sx={{ flex: 3 }}
                      placeholder="10.0.0.12"
                    />
                    <TextField
                      margin="dense"
                      label="Port"
                      variant="outlined"
                      size="small"
                      value={rdpPort}
                      onChange={(e) => setRdpPort(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <TextField
                    margin="dense"
                    label="Username"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={rdpUsername}
                    onChange={(e) => setRdpUsername(e.target.value)}
                    placeholder="Administrator"
                  />
                  <TextField
                    margin="dense"
                    label="Password"
                    type="password"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={rdpPassword}
                    onChange={(e) => setRdpPassword(e.target.value)}
                  />
                  <TextField
                    margin="dense"
                    label="Domain (optional)"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={rdpDomain}
                    onChange={(e) => setRdpDomain(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateTerminal();
                    }}
                  />
                </>
              )}
            </Box>
          )}
          {newTerminalType === 'vnc' && (
            <Box sx={{ mt: 1 }}>
              {vncConnections.length > 0 && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  margin="dense"
                  label="Saved Connection"
                  value={selectedVncConnection}
                  onChange={(e) => {
                    setSelectedVncConnection(e.target.value);
                    if (e.target.value) {
                      const conn = vncConnections.find(c => c.id === parseInt(e.target.value));
                      if (conn) {
                        setVncHost(conn.host);
                        setVncPort(conn.port.toString());
                      }
                    }
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="">-- New Connection --</option>
                  {vncConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.host}:{conn.port})
                    </option>
                  ))}
                </TextField>
              )}

              {!selectedVncConnection && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      margin="dense"
                      label="Host"
                      variant="outlined"
                      size="small"
                      value={vncHost}
                      onChange={(e) => setVncHost(e.target.value)}
                      sx={{ flex: 3 }}
                      placeholder="192.168.1.100"
                    />
                    <TextField
                      margin="dense"
                      label="Port"
                      variant="outlined"
                      size="small"
                      value={vncPort}
                      onChange={(e) => setVncPort(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <TextField
                    margin="dense"
                    label="Password (optional)"
                    type="password"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={vncPassword}
                    onChange={(e) => setVncPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateTerminal();
                    }}
                  />
                </>
              )}
            </Box>
          )}
          {newTerminalType === 'sftp' && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  margin="dense"
                  label="Host"
                  variant="outlined"
                  size="small"
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                  sx={{ flex: 3 }}
                  placeholder="192.168.1.100"
                />
                <TextField
                  margin="dense"
                  label="Port"
                  variant="outlined"
                  size="small"
                  value={sftpPort}
                  onChange={(e) => setSftpPort(e.target.value)}
                  sx={{ flex: 1 }}
                />
              </Box>
              <TextField
                margin="dense"
                label="Username"
                fullWidth
                variant="outlined"
                size="small"
                value={sftpUsername}
                onChange={(e) => setSftpUsername(e.target.value)}
                placeholder="root"
              />
              <TextField
                margin="dense"
                label="Password"
                type="password"
                fullWidth
                variant="outlined"
                size="small"
                value={sftpPassword}
                onChange={(e) => setSftpPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateTerminal();
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTerminalDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTerminal}
            variant="contained"
            disabled={
              (newTerminalType === 'ssh' && !selectedSshConnection && !sshHost) ||
              (newTerminalType === 'rdp' && !selectedRdpConnection && !rdpHost) ||
              (newTerminalType === 'vnc' && !selectedVncConnection && !vncHost) ||
              (newTerminalType === 'sftp' && !sftpHost)
            }
          >
            {newTerminalType === 'local' ? 'Create' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default TerminalView;