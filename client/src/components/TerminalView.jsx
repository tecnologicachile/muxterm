import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress
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
  const { user: authUser, logout, isAdmin } = useAuth();
  const [forceChangePassword, setForceChangePassword] = useState(false);

  // Check if user must change password on first login
  useEffect(() => {
    if (authUser?.must_change_password === 1) {
      setForceChangePassword(true);
    }
  }, [authUser]);
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
  const [vaultLoggedIn, setVaultLoggedIn] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [resetPwUserId, setResetPwUserId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [vaultEditDialog, setVaultEditDialog] = useState(null); // { mode: 'save'|'edit'|'delete'|'loading', item? }
  const [vaultEditFields, setVaultEditFields] = useState({ name: '', username: '', password: '', host: '', port: '', type: '' });
  const [vaultActionLoading, setVaultActionLoading] = useState(false);
  const [vaultOrgLoading, setVaultOrgLoading] = useState(false);
  const [vaultItems, setVaultItems] = useState([]);
  const [vaultItemsLoading, setVaultItemsLoading] = useState(false);
  const [vaultLoginOpen, setVaultLoginOpen] = useState(false);
  const [vaultServerUrl, setVaultServerUrl] = useState(() => localStorage.getItem('vault_url') || '');
  const [vaultClientId, setVaultClientId] = useState(() => localStorage.getItem('vault_email') || '');
  const [vaultClientSecret, setVaultClientSecret] = useState('');
  const [vaultMasterPassword, setVaultMasterPassword] = useState('');
  const [credentialSource, setCredentialSource] = useState('manual');
  const [vaultOrgs, setVaultOrgs] = useState([]);
  const [vaultCollections, setVaultCollections] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(() => localStorage.getItem('vault_org') || '');
  const [vaultTimeout, setVaultTimeout] = useState(() => parseInt(localStorage.getItem('vault_timeout')) || 30);
  const [selectedCollection, setSelectedCollection] = useState(() => localStorage.getItem('vault_collection') || '');
  const [selectedVaultItem, setSelectedVaultItem] = useState(null);
  const [vaultSearch, setVaultSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const sidebarTimeoutRef = React.useRef(null);
  const sidebarFilterRef = React.useRef(null);
  const [mobilePanelListOpen, setMobilePanelListOpen] = useState(false);
  const mobileSwipeRef = React.useRef({ startX: 0, startY: 0 });

  // Check vault status on mount — server is source of truth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/vault/status', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.loggedIn) {
          setVaultLoggedIn(true);
          if (data.collectionId) setSelectedCollection(data.collectionId);
          if (data.organizationId) setSelectedOrg(data.organizationId);
          loadVaultOrgs();
          loadVaultItems();
        } else {
          // Server session expired — clear local state
          setVaultLoggedIn(false);
          setVaultItems([]);
          setVaultOrgs([]);
          setVaultCollections([]);
        }
      })
      .catch(() => {
        setVaultLoggedIn(false);
      });
  }, []);

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

  // Mobile swipe between panels (only on panel headers, not on terminal/input areas)
  // Removed document-level touch handlers to avoid interfering with keyboard input

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



  const getToken = () => localStorage.getItem('token') || '';

  const vaultLogin = async () => {
    setVaultLoading(true);
    try {
      const res = await fetch('/api/vault/login', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: vaultServerUrl, email: vaultClientId, password: vaultMasterPassword })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        localStorage.setItem('vault_url', vaultServerUrl);
        localStorage.setItem('vault_email', vaultClientId);
        setVaultLoggedIn(true);
        setVaultLoginOpen(false);
        if (data.organizations) setVaultOrgs(data.organizations);
        // Restore saved timeout
        const savedTimeout = parseInt(localStorage.getItem('vault_timeout')) || 30;
        setVaultTimeout(savedTimeout);
        fetch('/api/vault/timeout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes: savedTimeout })
        }).catch(() => {});
        // Auto-select saved org and precache items
        const savedOrg = localStorage.getItem('vault_org');
        if (savedOrg) {
          selectOrganization(savedOrg);
        } else {
          // No org saved, precache items anyway
          loadVaultItems();
        }
      } else {
        alert('Bitwarden login failed: ' + data.message);
      }
    } catch (e) {
      alert('Bitwarden error: ' + e.message);
    }
    setVaultLoading(false);
  };

  // Helper: check vault response for expired session
  const vaultSessionCheck = (res) => {
    if (res.status === 401) {
      setVaultLoggedIn(false);
      setVaultItems([]);
      setVaultOrgs([]);
      setVaultCollections([]);
      return false;
    }
    return true;
  };

  const selectOrganization = async (orgId) => {
    setSelectedOrg(orgId);
    localStorage.setItem('vault_org', orgId);
    setVaultOrgLoading(true);
    try {
      const res = await fetch('/api/vault/select-org', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId })
      });
      if (!vaultSessionCheck(res)) return;
      const data = await res.json();
      if (data.status === 'ok') {
        setSelectedCollection(data.collectionId || '');
        loadVaultItems();
      }
    } catch (e) {}
    setVaultOrgLoading(false);
  };

  const loadVaultOrgs = async () => {
    setVaultOrgLoading(true);
    try {
      const res = await fetch('/api/vault/organizations', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!vaultSessionCheck(res)) return;
      const data = await res.json();
      if (data.status === 'ok') {
        setVaultOrgs(data.items);
        if (selectedOrg) await loadVaultCollections(selectedOrg);
      }
    } catch (e) {}
    setVaultOrgLoading(false);
  };

  const loadVaultCollections = async (orgId) => {
    setVaultOrgLoading(true);
    try {
      const res = await fetch(`/api/vault/collections?organizationId=${orgId}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!vaultSessionCheck(res)) return;
      const data = await res.json();
      if (data.status === 'ok') setVaultCollections(data.items);
    } catch (e) {}
    setVaultOrgLoading(false);
  };

  const loadVaultItems = async (type) => {
    setVaultItemsLoading(true);
    setVaultItems([]);
    try {
      let url = type ? `/api/vault/items?type=${type}` : '/api/vault/items';
      if (selectedCollection) url += `${url.includes('?') ? '&' : '?'}collectionId=${selectedCollection}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!vaultSessionCheck(res)) { setVaultItemsLoading(false); return; }
      const data = await res.json();
      if (data.status === 'ok') setVaultItems(data.items);
    } catch (e) {}
    setVaultItemsLoading(false);
  };

  const applyVaultItem = (item) => {
    setSelectedVaultItem(item);
    const conn = item.connections[0];
    if (conn.scheme === 'ssh' && newTerminalType === 'sftp') {
      // SSH credential used for SFTP - same credentials, keep SFTP type
      setSftpHost(conn.host);
      setSftpPort(String(conn.port || 22));
      setSftpUsername(item.username || '');
      setSftpPassword(item.password || '');
    } else if (conn.scheme === 'ssh') {
      setNewTerminalType('ssh');
      setSshHost(conn.host);
      setSshPort(String(conn.port || 22));
      setSshUsername(item.username || '');
      setSshPassword(item.password || '');
    } else if (conn.scheme === 'rdp') {
      setNewTerminalType('rdp');
      setRdpHost(conn.host);
      setRdpPort(String(conn.port || 3389));
      setRdpUsername(item.username || '');
      setRdpPassword(item.password || '');
    } else if (conn.scheme === 'vnc') {
      setNewTerminalType('vnc');
      setVncHost(conn.host);
      setVncPort(String(conn.port || 5900));
      setVncPassword(item.password || '');
    } else if (conn.scheme === 'sftp') {
      setNewTerminalType('sftp');
      setSftpHost(conn.host);
      setSftpPort(String(conn.port || 22));
      setSftpUsername(item.username || '');
      setSftpPassword(item.password || '');
    }
  };

  const saveToVault = async () => {
    if (!vaultLoggedIn) { alert('Connect to Bitwarden first'); return; }
    const type = newTerminalType;
    const host = type === 'rdp' ? rdpHost : type === 'vnc' ? vncHost : type === 'sftp' ? sftpHost : sshHost;
    const port = type === 'rdp' ? rdpPort : type === 'vnc' ? vncPort : type === 'sftp' ? sftpPort : sshPort;
    const username = type === 'rdp' ? rdpUsername : type === 'sftp' ? sftpUsername : sshUsername;
    const password = type === 'rdp' ? rdpPassword : type === 'vnc' ? vncPassword : type === 'sftp' ? sftpPassword : sshPassword;
    if (!host) { alert('Fill in at least the host'); return; }
    setVaultEditFields({ name: `${username || ''}@${host}`, username, password, host, port, type });
    setVaultEditDialog({ mode: 'save' });
    return;
  };

  const executeVaultSave = async () => {
    const { name, username, password, host, port, type } = vaultEditFields;
    setVaultActionLoading(true);
    try {
      const res = await fetch('/api/vault/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, host, port, username, password })
      });
      if (!vaultSessionCheck(res)) return;
      const data = await res.json();
      if (data.status === 'ok') {
        setVaultEditDialog(null);
        loadVaultItems(newTerminalType);
      } else {
        alert('Failed: ' + data.message);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setVaultActionLoading(false);
    }
  };

  // Admin: fetch users when settings open
  useEffect(() => {
    if (settingsOpen && isAdmin) {
      fetchAdminUsers();
    }
  }, [settingsOpen, isAdmin]);

  const fetchAdminUsers = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/auth/admin/users', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (res.ok) setAdminUsers(await res.json());
    } catch (e) {}
    setAdminLoading(false);
  };

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
          name: selectedVaultItem?.name || `${sshUsername}@${sshHost}`, host: sshHost, port: parseInt(sshPort) || 22,
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
          name: selectedVaultItem?.name || `${rdpUsername}@${rdpHost}`, host: rdpHost, port: parseInt(rdpPort) || 3389,
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
          name: selectedVaultItem?.name || `VNC ${vncHost}`, host: vncHost, port: parseInt(vncPort) || 5900, password: vncPassword
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
      if (!sftpHost) return;
      newPanel = {
        id: uuidv4(), terminalId: null,
        name: selectedVaultItem?.name || `${sftpUsername}@${sftpHost}`,
        type: 'sftp',
        sftpConfig: { host: sftpHost, port: parseInt(sftpPort) || 22, username: sftpUsername, password: sftpPassword }
      };
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
        onLogout={() => { logout(); navigate('/login'); }}
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


            {/* Vault status + Settings */}
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setSettingsOpen(true)}
              sx={{ ml: 1 }}
              title={vaultLoggedIn ? 'Vault connected' : 'Settings'}
            >
              <Typography sx={{ fontSize: '16px' }}>{vaultLoggedIn ? '🔐' : '⚙️'}</Typography>
            </IconButton>
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
          {/* Special keys toolbar - adapts to panel type */}
          <SpecialKeysToolbar
            panelType={(() => { const ap = panels.find(p => p.id === activePanel); return ap ? ap.type || 'local' : 'local'; })()}
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
            onGuacKey={(keysym, mods) => {
              const guacClient = document.querySelector(`[data-panel-id="${activePanel}"]`)?.__guacClient;
              if (!guacClient) return;
              mods.forEach(m => guacClient.sendKeyEvent(1, m));
              guacClient.sendKeyEvent(1, keysym);
              guacClient.sendKeyEvent(0, keysym);
              mods.forEach(m => guacClient.sendKeyEvent(0, m));
            }}
            onToggleKeyboard={() => {
              const textarea = document.querySelector(`[data-panel-id="${activePanel}"] textarea`);
              if (textarea) {
                if (document.activeElement === textarea) textarea.blur();
                else textarea.focus();
              }
            }}
            isVisible={true}
          />
          {/* Spacer for mobile pill indicator */}
          {isMobile && (panels.length + minimizedPanels.length) > 1 && (
            <div style={{ height: 20 }} />
          )}
          {/* Panel dots (desktop only, mobile uses pill) */}
          {!isMobile && panels.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', height: 28, borderTop: '1px solid #222', padding: '0 8px' }}>
              <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
                {panels.map(function(panel) {
                  return (
                    <div key={'dot-' + panel.id}
                      onClick={function() { setActivePanel(panel.id); }}
                      style={{
                        width: panel.id === activePanel ? 16 : 6, height: 6, borderRadius: 3,
                        backgroundColor: panel.id === activePanel ? '#00ff00' : '#444',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Box>
      )}

      {/* Mobile pill indicator - tap to open drawer */}
      {isMobile && (panels.length + minimizedPanels.length) > 1 && !mobilePanelListOpen ? (
        <div onClick={function() { setMobilePanelListOpen(true); }}
          style={{ position: 'fixed', bottom: 2, left: '50%', transform: 'translateX(-50%)',
            height: 16, padding: '0 10px', borderRadius: 8,
            backgroundColor: 'rgba(30,30,30,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 5, zIndex: 1000, cursor: 'pointer' }}>
          {panels.map(function(p) {
            return (
              <div key={'pill-' + p.id} style={{
                width: p.id === activePanel ? 10 : 4, height: 4, borderRadius: 2,
                backgroundColor: p.id === activePanel ? '#00ff00' : '#555', transition: 'all 0.2s'
              }} />
            );
          })}
        </div>
      ) : null}

      {/* Mobile panel drawer */}
      {isMobile && mobilePanelListOpen ? (
        <div>
          <div onClick={function() { setMobilePanelListOpen(false); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '60vh', backgroundColor: '#1a1a1a',
            borderTop: '2px solid #00ff00', borderRadius: '16px 16px 0 0', overflow: 'auto', zIndex: 1001, padding: '12px 0' }}>
            <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Panels</div>
            {panels.map(function(panel, idx) {
              return (
                <div key={'mp-' + panel.id} onClick={function() { setActivePanel(panel.id); setMobilePanelListOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                    backgroundColor: panel.id === activePanel ? 'rgba(0,255,0,0.08)' : 'transparent',
                    borderLeft: panel.id === activePanel ? '3px solid #00ff00' : '3px solid transparent' }}>
                  <span style={{ fontSize: 16 }}>{panel.type === 'rdp' || panel.type === 'vnc' ? '🖥️' : panel.type === 'sftp' ? '📁' : '⬛'}</span>
                  <div>
                    <div style={{ fontSize: 13, color: panel.id === activePanel ? '#00ff00' : '#ccc' }}>{panel.name || 'Panel ' + (idx + 1)}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{(panel.type || 'local').toUpperCase()}</div>
                  </div>
                </div>
              );
            })}
            {minimizedPanels.length > 0 ? (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#555', textTransform: 'uppercase' }}>Minimized</div>
                {minimizedPanels.map(function(panel) {
                  return (
                    <div key={'mpm-' + panel.id} onClick={function() { handleRestorePanel(panel); setMobilePanelListOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', opacity: 0.5 }}>
                      <span style={{ fontSize: 16 }}>⬛</span>
                      <div style={{ fontSize: 13, color: '#888' }}>{panel.name || 'Panel'}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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

      {/* New Connection Dialog */}
      <Dialog
        open={newTerminalDialogOpen}
        onClose={() => { setNewTerminalDialogOpen(false); setSelectedVaultItem(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New Connection</DialogTitle>
        <DialogContent>
          {/* Type selector */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {[
              { value: 'local', label: 'Local' },
              { value: 'ssh', label: 'SSH' },
              { value: 'rdp', label: 'RDP' },
              { value: 'vnc', label: 'VNC' },
              { value: 'sftp', label: 'SFTP' }
            ].map(t => (
              <Button key={t.value} size="small"
                variant={newTerminalType === t.value ? 'contained' : 'outlined'}
                onClick={() => { setNewTerminalType(t.value); if (vaultLoggedIn) loadVaultItems(t.value); }}
                sx={{ flex: 1, minWidth: '50px', fontSize: '12px' }}
              >
                {t.label}
              </Button>
            ))}
          </Box>

          {/* Connection fields (hidden for local) */}
          {newTerminalType !== 'local' && (
            <Box sx={{ mt: 1 }}>
              {/* Host + Port */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField margin="dense" label="Host" variant="outlined" size="small"
                  value={newTerminalType === 'rdp' ? rdpHost : newTerminalType === 'vnc' ? vncHost : newTerminalType === 'sftp' ? sftpHost : sshHost}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (newTerminalType === 'rdp') setRdpHost(v);
                    else if (newTerminalType === 'vnc') setVncHost(v);
                    else if (newTerminalType === 'sftp') setSftpHost(v);
                    else setSshHost(v);
                  }}
                  sx={{ flex: 3 }} placeholder="192.168.1.100"
                />
                <TextField margin="dense" label="Port" variant="outlined" size="small"
                  value={newTerminalType === 'rdp' ? rdpPort : newTerminalType === 'vnc' ? vncPort : newTerminalType === 'sftp' ? sftpPort : sshPort}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (newTerminalType === 'rdp') setRdpPort(v);
                    else if (newTerminalType === 'vnc') setVncPort(v);
                    else if (newTerminalType === 'sftp') setSftpPort(v);
                    else setSshPort(v);
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {/* Username (not for VNC) */}
              {newTerminalType !== 'vnc' && (
                <TextField margin="dense" label="Username" fullWidth variant="outlined" size="small"
                  value={newTerminalType === 'rdp' ? rdpUsername : newTerminalType === 'sftp' ? sftpUsername : sshUsername}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (newTerminalType === 'rdp') setRdpUsername(v);
                    else if (newTerminalType === 'sftp') setSftpUsername(v);
                    else setSshUsername(v);
                  }}
                  placeholder="root"
                />
              )}

              {/* Password */}
              <TextField margin="dense" label="Password" type="password" fullWidth variant="outlined" size="small"
                value={newTerminalType === 'rdp' ? rdpPassword : newTerminalType === 'vnc' ? vncPassword : newTerminalType === 'sftp' ? sftpPassword : sshPassword}
                onChange={(e) => {
                  const v = e.target.value;
                  if (newTerminalType === 'rdp') setRdpPassword(v);
                  else if (newTerminalType === 'vnc') setVncPassword(v);
                  else if (newTerminalType === 'sftp') setSftpPassword(v);
                  else setSshPassword(v);
                }}
                onKeyPress={(e) => { if (e.key === 'Enter') handleCreateTerminal(); }}
              />

              {/* Domain (RDP only) */}
              {newTerminalType === 'rdp' && (
                <TextField margin="dense" label="Domain (optional)" fullWidth variant="outlined" size="small"
                  value={rdpDomain} onChange={(e) => setRdpDomain(e.target.value)}
                />
              )}

              {/* Bitwarden credentials */}
              {vaultLoggedIn && (
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #333' }}>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '11px' }}>
                    Or use saved credentials
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <TextField
                      fullWidth size="small" margin="dense"
                      label="🔐 Search Bitwarden"
                      placeholder="Type to filter..."
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                    />
                    <Box sx={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #333', borderRadius: 1, mt: 0.5 }}>
                      {vaultItems
                        .filter(i => i.connections.some(c => c.scheme === newTerminalType || (newTerminalType === 'sftp' && c.scheme === 'ssh')))
                        .filter(i => !vaultSearch || i.name.toLowerCase().includes(vaultSearch.toLowerCase()) || i.connections.some(c => c.host.includes(vaultSearch)))
                        .map(item => (
                          <Box
                            key={item.id}
                            sx={{
                              p: 0.8, cursor: 'pointer', borderBottom: '1px solid #222',
                              backgroundColor: selectedVaultItem?.id === item.id ? 'rgba(0,255,0,0.1)' : 'transparent',
                              '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}
                          >
                            <Box onClick={() => { applyVaultItem(item); setVaultSearch(''); }} sx={{ flex: 1 }}>
                              <Box sx={{ fontSize: '12px', color: '#ccc' }}>{item.name}</Box>
                              <Box sx={{ fontSize: '10px', color: '#666' }}>
                                {item.connections.map(c => `${c.scheme}://${c.host}${c.port ? ':' + c.port : ''}`).join(', ')}
                                {item.username && ` • ${item.username}`}
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.3, ml: 0.5 }}>
                              {/* Edit */}
                              <Box onClick={async (e) => {
                                e.stopPropagation();
                                setVaultEditDialog({ mode: 'loading' });
                                try {
                                  const res = await fetch(`/api/vault/item/${item.id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
                                  if (!vaultSessionCheck(res)) { setVaultEditDialog(null); return; }
                                  const data = await res.json();
                                  if (data.status !== 'ok') { setVaultEditDialog(null); return; }
                                  const conn = item.connections[0] || {};
                                  setVaultEditFields({ name: data.item.name, username: data.item.username || '', password: data.item.password || '', host: conn.host || '', port: String(conn.port || ''), type: conn.scheme || newTerminalType });
                                  setVaultEditDialog({ mode: 'edit', item });
                                } catch (err) { setVaultEditDialog(null); }
                              }} sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#aaa' } }} title="Edit">✏️</Box>
                              {/* Delete */}
                              <Box onClick={(e) => {
                                e.stopPropagation();
                                setVaultEditDialog({ mode: 'delete', item });
                              }} sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#f44' } }} title="Delete">🗑️</Box>
                            </Box>
                          </Box>
                        ))
                      }
                      {vaultItemsLoading && (
                        <Box sx={{ p: 1.5, textAlign: 'center', color: '#888', fontSize: '11px' }}>
                          🔄 Loading credentials...
                        </Box>
                      )}
                      {!vaultItemsLoading && vaultItems.filter(i => i.connections.some(c => c.scheme === newTerminalType || (newTerminalType === 'sftp' && c.scheme === 'ssh'))).length === 0 && (
                        <Box sx={{ p: 1.5, textAlign: 'center', color: '#555', fontSize: '11px' }}>
                          No {newTerminalType.toUpperCase()} credentials in vault
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
              {!vaultLoggedIn && (
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #333', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#555', fontSize: '11px' }}>
                    Connect to Bitwarden in ⚙️ Settings for saved credentials
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTerminalDialogOpen(false)}>Cancel</Button>
          {vaultLoggedIn && newTerminalType !== 'local' && (
            <Button onClick={saveToVault} size="small" sx={{ fontSize: '11px', textTransform: 'none' }}>
              🔐 Save to Vault
            </Button>
          )}
          <Button
            onClick={handleCreateTerminal}
            variant="contained"
            disabled={newTerminalType !== 'local' && !(
              (newTerminalType === 'ssh' && (selectedSshConnection || sshHost)) ||
              (newTerminalType === 'rdp' && (selectedRdpConnection || rdpHost)) ||
              (newTerminalType === 'vnc' && (selectedVncConnection || vncHost)) ||
              (newTerminalType === 'sftp' && sftpHost)
            )}
          >
            {newTerminalType === 'local' ? 'Create' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Settings</DialogTitle>
        <DialogContent>
          {/* Bitwarden Integration */}
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, color: '#aaa' }}>
            🔐 Bitwarden Integration
          </Typography>

          {vaultLoggedIn ? (
            <Box sx={{ p: 1.5, border: '1px solid #333', borderRadius: 1, backgroundColor: '#111' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '13px', color: '#00ff00' }}>✓ Connected</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#666' }}>{vaultClientId}</Typography>
                </Box>
                <Button size="small" variant="outlined" color="error" onClick={async () => {
                  await fetch('/api/vault/lock', { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` } });
                  setVaultLoggedIn(false);
                  setVaultItems([]);
                  setVaultOrgs([]);
                  setVaultCollections([]);
                }}>
                  Disconnect
                </Button>
              </Box>
              {/* Organization selector */}
              {vaultOrgs.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '10px' }}>Organization</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    <Button size="small" variant={!selectedOrg ? 'contained' : 'outlined'} sx={{ fontSize: '11px', textTransform: 'none', py: 0.3 }}
                      onClick={() => selectOrganization('')}>
                      Personal
                    </Button>
                    {vaultOrgs.map(org => (
                      <Button key={org.id} size="small" variant={selectedOrg === org.id ? 'contained' : 'outlined'} sx={{ fontSize: '11px', textTransform: 'none', py: 0.3 }}
                        onClick={() => selectOrganization(org.id)}>
                        {org.name}
                      </Button>
                    ))}
                  </Box>
                  {vaultOrgLoading && (
                    <Box sx={{ mt: 0.5, fontSize: '11px', color: '#888' }}>Loading...</Box>
                  )}
                  {!vaultOrgLoading && selectedOrg && selectedCollection && (
                    <Box sx={{ mt: 0.5, fontSize: '11px', color: '#00ff00' }}>
                      ✓ Collection: Remote Access
                    </Box>
                  )}
                  {!vaultOrgLoading && selectedOrg && !selectedCollection && (
                    <Box sx={{ mt: 0.5, fontSize: '11px', color: '#ff8800' }}>
                      ⚠️ "Remote Access" collection not found — using all items
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 1.5, border: '1px solid #333', borderRadius: 1, backgroundColor: '#111' }}>
              <TextField margin="dense" label="Server URL" fullWidth variant="outlined" size="small"
                value={vaultServerUrl} onChange={(e) => setVaultServerUrl(e.target.value)}
                placeholder="https://vault.example.com"
              />
              <TextField margin="dense" label="Email" fullWidth variant="outlined" size="small"
                value={vaultClientId} onChange={(e) => setVaultClientId(e.target.value)}
                placeholder="user@example.com"
              />
              <TextField margin="dense" label="Master Password" type="password" fullWidth variant="outlined" size="small"
                value={vaultMasterPassword} onChange={(e) => setVaultMasterPassword(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') vaultLogin(); }}
              />
              <Button fullWidth variant="contained" size="small" onClick={vaultLogin} disabled={vaultLoading} sx={{ mt: 1 }}>
                {vaultLoading ? 'Connecting...' : 'Unlock Vault'}
              </Button>
            </Box>
          )}

          {/* Session timeout */}
          {vaultLoggedIn && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#888', fontSize: '11px', whiteSpace: 'nowrap' }}>
                Session timeout:
              </Typography>
              <TextField size="small" type="number" value={vaultTimeout}
                onChange={(e) => {
                  const v = Math.max(5, Math.min(9999, parseInt(e.target.value) || 30));
                  setVaultTimeout(v);
                  localStorage.setItem('vault_timeout', v);
                  fetch('/api/vault/timeout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ minutes: v })
                  }).catch(() => {});
                }}
                inputProps={{ min: 5, max: 9999, style: { width: '60px', textAlign: 'center' } }}
                sx={{ width: '90px' }}
              />
              <Typography variant="caption" sx={{ color: '#888', fontSize: '11px' }}>min</Typography>
            </Box>
          )}

          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#555', fontSize: '10px' }}>
            Credentials are fetched from Bitwarden on demand. Nothing is stored in MuxTerm.
          </Typography>

          {/* Change Password */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: '#aaa' }}>
            🔑 Change Password
          </Typography>
          <Box sx={{ p: 1.5, border: '1px solid #333', borderRadius: 1, backgroundColor: '#111' }}>
            <TextField margin="dense" label="Current Password" type="password" fullWidth variant="outlined" size="small"
              id="settings-current-password"
            />
            <TextField margin="dense" label="New Password" type="password" fullWidth variant="outlined" size="small"
              id="settings-new-password"
            />
            <TextField margin="dense" label="Confirm New Password" type="password" fullWidth variant="outlined" size="small"
              id="settings-confirm-password"
              onKeyPress={(e) => { if (e.key === 'Enter') document.getElementById('btn-change-password').click(); }}
            />
            <Button id="btn-change-password" fullWidth variant="contained" size="small" sx={{ mt: 1 }}
              onClick={async () => {
                const currentPw = document.getElementById('settings-current-password').value;
                const newPw = document.getElementById('settings-new-password').value;
                const confirmPw = document.getElementById('settings-confirm-password').value;
                if (!currentPw || !newPw) return alert('Fill in all fields');
                if (newPw !== confirmPw) return alert('New passwords do not match');
                if (newPw.length < 4) return alert('Password must be at least 4 characters');
                try {
                  const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert('Password changed successfully');
                    document.getElementById('settings-current-password').value = '';
                    document.getElementById('settings-new-password').value = '';
                    document.getElementById('settings-confirm-password').value = '';
                  } else {
                    alert(data.message || 'Failed to change password');
                  }
                } catch (e) { alert('Error changing password'); }
              }}
            >
              Change Password
            </Button>
          </Box>

          {/* Admin: User Management */}
          {isAdmin && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: '#aaa' }}>
                👥 User Management
              </Typography>
              <Box sx={{ p: 1.5, border: '1px solid #333', borderRadius: 1, backgroundColor: '#111' }}>
                {adminLoading ? (
                  <Box sx={{ textAlign: 'center', color: '#888', fontSize: '12px', py: 1 }}>Loading users...</Box>
                ) : (
                  adminUsers.map(u => (
                    <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #222', '&:last-child': { borderBottom: 'none' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '13px', color: '#ccc' }}>{u.username}</Typography>
                        {u.is_admin === 1 && (
                          <Typography sx={{ fontSize: '10px', color: '#00ff00', border: '1px solid #00ff00', borderRadius: '4px', px: 0.5 }}>Admin</Typography>
                        )}
                        {u.id === 1 && (
                          <Typography sx={{ fontSize: '10px', color: '#666' }}>(root)</Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {resetPwUserId === u.id ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <TextField size="small" type="password" placeholder="New password" value={resetPwValue}
                              onChange={(e) => setResetPwValue(e.target.value)}
                              sx={{ width: '120px' }}
                              inputProps={{ style: { fontSize: '12px', padding: '4px 8px' } }}
                            />
                            <Button size="small" variant="contained" sx={{ fontSize: '10px', minWidth: '40px', py: 0.3 }}
                              onClick={async () => {
                                if (!resetPwValue) return;
                                const res = await fetch('/api/auth/admin/reset-password', {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: u.id, newPassword: resetPwValue })
                                });
                                const data = await res.json();
                                if (data.success) { setResetPwUserId(null); setResetPwValue(''); alert('Password reset'); }
                                else alert(data.message);
                              }}>OK</Button>
                            <Button size="small" sx={{ fontSize: '10px', minWidth: '30px', py: 0.3 }}
                              onClick={() => { setResetPwUserId(null); setResetPwValue(''); }}>✕</Button>
                          </Box>
                        ) : (
                          <>
                            <Button size="small" sx={{ fontSize: '10px', minWidth: 0, py: 0.2, textTransform: 'none' }}
                              onClick={() => setResetPwUserId(u.id)}>Reset PW</Button>
                            {u.id !== 1 && (
                              <Button size="small" sx={{ fontSize: '10px', minWidth: 0, py: 0.2, textTransform: 'none' }}
                                onClick={async () => {
                                  const res = await fetch('/api/auth/admin/toggle-admin', {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: u.id, isAdmin: u.is_admin ? 0 : 1 })
                                  });
                                  if (res.ok) fetchAdminUsers();
                                }}>{u.is_admin ? 'Demote' : 'Promote'}</Button>
                            )}
                            {u.id !== 1 && (
                              <Button size="small" color="error" sx={{ fontSize: '10px', minWidth: 0, py: 0.2, textTransform: 'none' }}
                                onClick={async () => {
                                  if (!confirm(`Delete user "${u.username}"? All their data will be removed.`)) return;
                                  const res = await fetch(`/api/auth/admin/users/${u.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${getToken()}` }
                                  });
                                  if (res.ok) fetchAdminUsers();
                                  else { const d = await res.json(); alert(d.message); }
                                }}>Delete</Button>
                            )}
                          </>
                        )}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Forced password change dialog */}
      <Dialog open={forceChangePassword} maxWidth="xs" fullWidth
        onClose={(e, reason) => { if (reason) return; }}
        disableEscapeKeyDown
      >
        <DialogTitle>Change Password Required</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#aaa', mb: 2 }}>
            You must change your password before continuing.
          </Typography>
          <TextField margin="dense" label="New Password" type="password" fullWidth variant="outlined" size="small"
            id="force-new-password"
          />
          <TextField margin="dense" label="Confirm Password" type="password" fullWidth variant="outlined" size="small"
            id="force-confirm-password"
            onKeyPress={(e) => { if (e.key === 'Enter') document.getElementById('btn-force-change').click(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button id="btn-force-change" variant="contained" onClick={async () => {
            const newPw = document.getElementById('force-new-password').value;
            const confirmPw = document.getElementById('force-confirm-password').value;
            if (!newPw || newPw.length < 4) return alert('Password must be at least 4 characters');
            if (newPw !== confirmPw) return alert('Passwords do not match');
            try {
              const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: 'admin', newPassword: newPw })
              });
              const data = await res.json();
              if (data.success) {
                setForceChangePassword(false);
              } else {
                alert(data.message || 'Failed to change password');
              }
            } catch (e) { alert('Error changing password'); }
          }}>
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vault Edit/Save/Delete Dialog */}
      <Dialog open={!!vaultEditDialog} onClose={() => vaultEditDialog?.mode !== 'loading' && setVaultEditDialog(null)} maxWidth="xs" fullWidth>
        {vaultEditDialog?.mode === 'loading' ? (
          <DialogContent sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: '#00ff00' }} />
            <Typography sx={{ mt: 2, color: '#888', fontSize: '13px' }}>Loading credential...</Typography>
          </DialogContent>
        ) : vaultEditDialog?.mode === 'delete' ? (
          <>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: '13px' }}>
                Are you sure you want to delete <strong>{vaultEditDialog?.item?.name}</strong> from Bitwarden?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setVaultEditDialog(null)} disabled={vaultActionLoading}>Cancel</Button>
              <Button color="error" variant="contained" disabled={vaultActionLoading} onClick={async () => {
                setVaultActionLoading(true);
                try {
                  const res = await fetch(`/api/vault/item/${vaultEditDialog.item.id}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` }
                  });
                  if (!vaultSessionCheck(res)) return;
                  const data = await res.json();
                  if (data.status === 'ok') { setVaultEditDialog(null); loadVaultItems(newTerminalType); }
                  else alert(data.message);
                } catch (err) { alert(err.message); }
                finally { setVaultActionLoading(false); }
              }}>{vaultActionLoading ? <CircularProgress size={18} /> : 'Delete'}</Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>{vaultEditDialog?.mode === 'save' ? 'Save to Bitwarden' : 'Edit Credential'}</DialogTitle>
            <DialogContent>
              <TextField margin="dense" label="Name" fullWidth variant="outlined" size="small"
                value={vaultEditFields.name} onChange={(e) => setVaultEditFields(p => ({ ...p, name: e.target.value }))} />
              <TextField margin="dense" label="Host" fullWidth variant="outlined" size="small"
                value={vaultEditFields.host} onChange={(e) => setVaultEditFields(p => ({ ...p, host: e.target.value }))} />
              <TextField margin="dense" label="Port" fullWidth variant="outlined" size="small"
                value={vaultEditFields.port} onChange={(e) => setVaultEditFields(p => ({ ...p, port: e.target.value }))} />
              <TextField margin="dense" label="Username" fullWidth variant="outlined" size="small"
                value={vaultEditFields.username} onChange={(e) => setVaultEditFields(p => ({ ...p, username: e.target.value }))} />
              <TextField margin="dense" label="Password" type="password" fullWidth variant="outlined" size="small"
                value={vaultEditFields.password} onChange={(e) => setVaultEditFields(p => ({ ...p, password: e.target.value }))} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setVaultEditDialog(null)} disabled={vaultActionLoading}>Cancel</Button>
              <Button variant="contained" disabled={vaultActionLoading} onClick={async () => {
                if (vaultEditDialog?.mode === 'save') {
                  executeVaultSave();
                } else {
                  setVaultActionLoading(true);
                  try {
                    const r = await fetch(`/api/vault/item/${vaultEditDialog.item.id}`, {
                      method: 'PUT',
                      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(vaultEditFields)
                    });
                    if (!vaultSessionCheck(r)) return;
                    const rd = await r.json();
                    if (rd.status === 'ok') { setVaultEditDialog(null); loadVaultItems(newTerminalType); }
                    else alert(rd.message);
                  } catch (err) { alert(err.message); }
                  finally { setVaultActionLoading(false); }
                }
              }}>{vaultActionLoading ? <CircularProgress size={18} /> : (vaultEditDialog?.mode === 'save' ? 'Save' : 'Update')}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

    </Box>
  );
}

export default TerminalView;