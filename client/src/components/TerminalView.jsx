import React, { useState, useEffect, useRef } from 'react';
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
import { isDiagEnabled, setDiagEnabled } from '../utils/diagLogger';
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
  // Windows (tabs) — each panel belongs to one window
  const [windows, setWindows] = useState([{ id: 'w1', name: 'Window 1' }]);
  const [activeWindowId, setActiveWindowId] = useState('w1');
  const [renamingWindowId, setRenamingWindowId] = useState(null);
  const [renameWindowValue, setRenameWindowValue] = useState('');
  const [draggingPanelForWindow, setDraggingPanelForWindow] = useState(null);
  const [dragOverWindowTab, setDragOverWindowTab] = useState(null);
  const [draggingTabId, setDraggingTabId] = useState(null);
  const [dragOverTabId, setDragOverTabId] = useState(null);
  const tabsScrollRef = useRef(null);
  const [tabsOverflow, setTabsOverflow] = useState({ canLeft: false, canRight: false });
  // Global activity tracking — maps terminalId → lastActivityTs
  const [activityMap, setActivityMap] = useState({});
  // Update status: { state: 'idle' | 'in-progress' | 'applied', target?: string }
  const [updateStatus, setUpdateStatus] = useState({ state: 'idle' });
  // Suppress the non-blocking update toast while the full-screen UpdateProgress
  // modal (opened from "Update Now") is visible, to avoid showing both at once.
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  // Client version (bundled at build time) vs server version (live)
  const clientVersion = (() => { try { return require('../../package.json').version; } catch (e) { return null; } })();
  const [serverVersion, setServerVersion] = useState(null);
  const [dragPanelId, setDragPanelId] = useState(null);
  const [dragOverPanelId, setDragOverPanelId] = useState(null);
  const [dragMinId, setDragMinId] = useState(null);
  const [dragOverMinId, setDragOverMinId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingPanel, setRenamingPanel] = useState(null);
  const [newPanelName, setNewPanelName] = useState('');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(null);
  const [settingsPanelName, setSettingsPanelName] = useState('');
  const [settingsStartupCommand, setSettingsStartupCommand] = useState('');
  const [minimizedPanels, setMinimizedPanels] = useState([]);
  
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [newTerminalDialogOpen, setNewTerminalDialogOpen] = useState(false);
  const [newTerminalType, setNewTerminalType] = useState('local');
  const [sshConnections, setSshConnections] = useState([]);
  const [selectedSshConnection, setSelectedSshConnection] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [sshInitialPath, setSshInitialPath] = useState('');
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
  const [sftpInitialPath, setSftpInitialPath] = useState('');
  const [localPasswordCached, setLocalPasswordCached] = useState(false);
  const [vaultLoggedIn, setVaultLoggedIn] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLogs, setDiagLogs] = useState([]);
  const [diagLoading, setDiagLoading] = useState(false);

  const loadDiagLogs = async () => {
    setDiagLoading(true);
    try {
      const r = await fetch('/api/diag/logs?limit=500', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const d = await r.json();
      if (d.status === 'ok') setDiagLogs(d.logs);
    } catch (e) {}
    setDiagLoading(false);
  };
  const clearDiagLogs = async () => {
    if (!confirm('Clear all diagnostic logs?')) return;
    await fetch('/api/diag/logs', { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
    setDiagLogs([]);
  };
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [resetPwUserId, setResetPwUserId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [vaultEditDialog, setVaultEditDialog] = useState(null); // { mode: 'save'|'edit'|'delete'|'loading', item? }
  const [vaultEditFields, setVaultEditFields] = useState({ name: '', username: '', password: '', host: '', port: '', type: '', initialPath: '' });
  const [migrationPrompt, setMigrationPrompt] = useState(null); // { candidates: [...], uploading: bool }
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
  const [mobileFilter, setMobileFilter] = useState('');
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
        // Ensure all panels have a windowId (migration from old format)
        const defaultWin = data.windows && data.windows.length > 0 ? data.windows[0].id : 'w1';
        const migrated = data.panels.map(p => p.windowId ? p : { ...p, windowId: defaultWin });
        setPanels(migrated);
        setActivePanel(data.activePanel || migrated[0].id);
        // Load windows or create default
        if (data.windows && data.windows.length > 0) {
          setWindows(data.windows);
          setActiveWindowId(data.activeWindowId || data.windows[0].id);
        } else {
          setWindows([{ id: 'w1', name: 'Window 1' }]);
          setActiveWindowId('w1');
        }
        const allRestored = [...migrated];
        if (data.minimizedPanels && Array.isArray(data.minimizedPanels)) {
          const seen = new Set();
          const dedupedMinimized = data.minimizedPanels
            .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
            .map(p => p.windowId ? p : { ...p, windowId: defaultWin });
          setMinimizedPanels(dedupedMinimized);
          allRestored.push(...dedupedMinimized);
        }
        const maxNum = allRestored.reduce((max, p) => {
          const match = (p.name || '').match(/^Terminal (\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        setTerminalCounter(maxNum + 1);
      } else {
        const initialPanel = { id: uuidv4(), terminalId: null, name: 'Terminal 1', windowId: 'w1' };
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

  // Save workspace whenever panels/windows change
  useEffect(() => {
    if (socket && panels.length > 0) {
      socket.emit('update-workspace', {
        panels, activePanel, minimizedPanels, windows, activeWindowId
      });
    }
  }, [panels, activePanel, socket, minimizedPanels, windows, activeWindowId]);

  // Update overflow state on tabs (show/hide arrow buttons)
  useEffect(() => {
    const updateOverflow = () => {
      const el = tabsScrollRef.current;
      if (!el) { setTabsOverflow({ canLeft: false, canRight: false }); return; }
      const canLeft = el.scrollLeft > 2;
      const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setTabsOverflow(prev => (prev.canLeft === canLeft && prev.canRight === canRight) ? prev : { canLeft, canRight });
    };
    updateOverflow();
    const el = tabsScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateOverflow, { passive: true });
    window.addEventListener('resize', updateOverflow);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
      if (ro) ro.disconnect();
    };
  }, [windows.length, isMobile]);

  const scrollTabs = (delta) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Global terminal-activity listener — track activity across all windows
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (!data?.terminalId) return;
      setActivityMap(prev => ({ ...prev, [data.terminalId]: Date.now() }));
    };
    socket.on('terminal-activity', handler);

    // Auto-update: show non-blocking toast, track progress
    const autoUpdateHandler = (data) => {
      setUpdateStatus({ state: 'in-progress', target: data.latest });
    };
    socket.on('auto-update-starting', autoUpdateHandler);

    // Track when the UpdateProgress modal is open so we can suppress the toast.
    const modalHandler = (e) => setUpdateModalOpen(!!e.detail?.open);
    window.addEventListener('muxterm:update-modal', modalHandler);

    // Server version: track to detect when update has been applied
    const serverInfoHandler = (data) => {
      if (!data?.version) return;
      setServerVersion(data.version);
      // If client was tracking an update and server now has a new version → applied
      setUpdateStatus(prev => {
        if (prev.state === 'in-progress' && clientVersion && data.version !== clientVersion) {
          return { state: 'applied', target: data.version };
        }
        return prev;
      });
    };
    socket.on('server-info', serverInfoHandler);

    // Refresh UI every 2s to re-evaluate stale activity timestamps
    const tick = setInterval(() => setActivityMap(prev => ({ ...prev })), 2000);
    return () => {
      socket.off('terminal-activity', handler);
      socket.off('auto-update-starting', autoUpdateHandler);
      window.removeEventListener('muxterm:update-modal', modalHandler);
      socket.off('server-info', serverInfoHandler);
      clearInterval(tick);
    };
  }, [socket]);

  // Ensure activePanel belongs to the active window
  useEffect(() => {
    const visiblePanels = panels.filter(p => (p.windowId || 'w1') === activeWindowId);
    if (visiblePanels.length === 0) return;
    const currentValid = visiblePanels.some(p => p.id === activePanel);
    if (!currentValid) setActivePanel(visiblePanels[0].id);
  }, [activeWindowId, panels, activePanel]);

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

  // One-time prompt: if vault is connected and there are local SSH connections
  // that aren't mirrored in Bitwarden, offer to upload them in bulk.
  // Dismissable permanently via localStorage.
  useEffect(() => {
    if (!vaultLoggedIn) return;
    if (migrationPrompt) return;
    if (localStorage.getItem('muxterm_vault_migration_dismissed') === 'true') return;
    if (!Array.isArray(vaultItems) || !Array.isArray(sshConnections)) return;
    // Only makes sense once we've at least attempted to load items once
    if (vaultItemsLoading) return;
    const vaultKeys = new Set();
    vaultItems.forEach(item => {
      (item.connections || []).forEach(c => {
        if (c.scheme === 'ssh') vaultKeys.add(`${c.host}:${c.port || 22}:${item.username || ''}`);
      });
    });
    const candidates = sshConnections.filter(conn =>
      !vaultKeys.has(`${conn.host}:${conn.port || 22}:${conn.username || ''}`)
    );
    if (candidates.length > 0) {
      setMigrationPrompt({ candidates, uploading: false });
    }
  }, [vaultLoggedIn, vaultItems, sshConnections, vaultItemsLoading]);

  const uploadMigrationCandidates = async () => {
    if (!migrationPrompt || !migrationPrompt.candidates) return;
    setMigrationPrompt(p => ({ ...p, uploading: true }));
    try {
      for (const conn of migrationPrompt.candidates) {
        await fetch('/api/vault/create', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: conn.name || `${conn.username}@${conn.host}`,
            type: 'ssh',
            host: conn.host,
            port: conn.port,
            username: conn.username,
            password: '', // backend falls back to encrypted local cache
            initialPath: conn.initial_path || ''
          })
        }).catch(() => {});
      }
      await loadVaultItems(newTerminalType);
    } finally {
      setMigrationPrompt(null);
    }
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
    setLocalPasswordCached(false);
    const conn = item.connections[0];
    if (conn.scheme === 'ssh' && newTerminalType === 'sftp') {
      // SSH credential used for SFTP - same credentials, keep SFTP type
      setSftpHost(conn.host);
      setSftpPort(String(conn.port || 22));
      setSftpUsername(item.username || '');
      setSftpPassword(item.password || '');
      setSftpInitialPath(item.initialPath || '');
    } else if (conn.scheme === 'ssh') {
      setNewTerminalType('ssh');
      setSshHost(conn.host);
      setSshPort(String(conn.port || 22));
      setSshUsername(item.username || '');
      setSshPassword(item.password || '');
      setSshInitialPath(item.initialPath || '');
    } else if (conn.scheme === 'rdp') {
      setNewTerminalType('rdp');
      setRdpHost(conn.host);
      setRdpPort(String(conn.port || 3389));
      // Parse DOMAIN\user format
      const rawUser = item.username || '';
      const bsIdx = rawUser.indexOf('\\');
      if (bsIdx > 0) {
        setRdpDomain(rawUser.substring(0, bsIdx));
        setRdpUsername(rawUser.substring(bsIdx + 1));
      } else {
        setRdpUsername(rawUser);
        setRdpDomain('');
      }
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
      setSftpInitialPath(item.initialPath || '');
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
    const initialPath = type === 'ssh' ? sshInitialPath : '';
    setVaultEditFields({ name: `${username || ''}@${host}`, username, password, host, port, type, initialPath });
    // Check for duplicate in vault
    const duplicate = vaultItems.find(item =>
      item.username === username &&
      item.connections.some(c => c.host === host && (c.scheme === type || (type === 'sftp' && c.scheme === 'ssh')))
    );
    if (duplicate) {
      setVaultEditDialog({ mode: 'save-duplicate', duplicateItem: duplicate });
    } else {
      setVaultEditDialog({ mode: 'save' });
    }
    return;
  };

  const executeVaultSave = async () => {
    const { name, username, password, host, port, type, initialPath } = vaultEditFields;
    setVaultActionLoading(true);
    try {
      const res = await fetch('/api/vault/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, host, port, username, password, initialPath })
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
      // Load system settings (auto-update toggle)
      fetch('/api/system-settings', { headers: { 'Authorization': `Bearer ${getToken()}` } })
        .then(r => r.json())
        .then(d => { if (d.status === 'ok' && d.settings) setAutoUpdateEnabled(!!d.settings.autoUpdateEnabled); })
        .catch(() => {});
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
    const panelsInActiveWindow = panels.filter(p => (p.windowId || 'w1') === activeWindowId).length;
    if (panelsInActiveWindow >= 8) {
      alert('Maximum 8 panels supported');
      return;
    }
    setNewTerminalType('local');
    setSelectedSshConnection('');
    setSshHost('');
    setSshPort('22');
    setSshUsername('');
    setSshPassword('');
    setSshInitialPath('');
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
    setSftpInitialPath('');
    setLocalPasswordCached(false);
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
          username: sshUsername, authType: 'password', password: sshPassword,
          initialPath: sshInitialPath || null
        });
        socket.once('ssh-connection-created', (conn) => {
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'ssh', sshConnectionId: conn.id, windowId: activeWindowId };
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
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'rdp', rdpConnectionId: conn.id, displayMode: 'fit', windowId: activeWindowId };
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
          const p = { id: uuidv4(), terminalId: null, name: conn.name, type: 'vnc', vncConnectionId: conn.id, windowId: activeWindowId };
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
        sftpConfig: { host: sftpHost, port: parseInt(sftpPort) || 22, username: sftpUsername, password: sftpPassword },
        sftpPath: sftpInitialPath || undefined
      };
    } else {
      newPanel = { id: uuidv4(), terminalId: null, name: termName, type: 'local' };
    }

    setTerminalCounter(prev => prev + 1);
    setPanels(prev => [...prev, { ...newPanel, windowId: activeWindowId }]);
    setActivePanel(newPanel.id);
    setNewTerminalDialogOpen(false);
  };

  const closeInProgressRef = useRef(false);
  const handleClosePanel = (panelId) => {
    // Prevent rapid consecutive closes that saturate the main thread
    if (closeInProgressRef.current) return;
    closeInProgressRef.current = true;

    const panel = panels.find(p => p.id === panelId);

    // Defuse iframe: set src to about:blank to close websocket cleanly
    // Prevents Chrome renderer crashes when closing active terminals.
    try {
      const panelEl = document.querySelector(`[data-panel-id="${panelId}"]`);
      if (panelEl) {
        const iframe = panelEl.querySelector('iframe');
        if (iframe) iframe.src = 'about:blank';
      }
    } catch (e) {}

    if (panel && panel.terminalId && socket) {
      socket.emit('close-terminal', { terminalId: panel.terminalId });
    }

    // Wait longer for iframe cleanup (xterm.js teardown can take >1s)
    setTimeout(() => {
      setPanels(prev => {
        const newPanels = prev.filter(p => p.id !== panelId);
        if (activePanel === panelId && newPanels.length > 0) {
          setActivePanel(newPanels[0].id);
        }
        return newPanels;
      });
      // Release lock after state update
      setTimeout(() => { closeInProgressRef.current = false; }, 400);
    }, 150);
  };


  
  const handleRenamePanel = (panelId) => {
    const panel = [...panels, ...minimizedPanels].find(p => p.id === panelId);
    if (panel) {
      setRenamingPanel(panelId);
      setNewPanelName(panel.name || '');
      setRenameDialogOpen(true);
    }
  };

  const confirmRenamePanel = () => {
    if (renamingPanel && newPanelName.trim()) {
      setPanels(panels.map(p =>
        p.id === renamingPanel ? { ...p, name: newPanelName.trim() } : p
      ));
      setMinimizedPanels(minimizedPanels.map(p =>
        p.id === renamingPanel ? { ...p, name: newPanelName.trim() } : p
      ));
    }
    setRenameDialogOpen(false);
    setRenamingPanel(null);
    setNewPanelName('');
  };

  const handlePanelSettings = (panelId) => {
    const panel = [...panels, ...minimizedPanels].find(p => p.id === panelId);
    if (panel) {
      setSettingsPanel(panelId);
      setSettingsPanelName(panel.name || '');
      setSettingsStartupCommand(panel.startupCommand || '');
      setSettingsDialogOpen(true);
    }
  };

  const confirmPanelSettings = () => {
    if (settingsPanel) {
      const updates = { name: settingsPanelName.trim(), startupCommand: settingsStartupCommand.trim() || undefined };
      setPanels(panels.map(p => p.id === settingsPanel ? { ...p, ...updates } : p));
      setMinimizedPanels(minimizedPanels.map(p => p.id === settingsPanel ? { ...p, ...updates } : p));
    }
    setSettingsDialogOpen(false);
    setSettingsPanel(null);
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

    // Restore to original window if it exists, otherwise to active window
    const targetWindowId = (panel.windowId && windows.some(w => w.id === panel.windowId))
      ? panel.windowId : activeWindowId;

    const restoredPanel = { ...panel, _restoreKey: Date.now(), windowId: targetWindowId };
    setPanels(prev => prev.some(p => p.id === panel.id) ? prev : [...prev, restoredPanel]);

    // Switch to the window where the panel was restored
    if (targetWindowId !== activeWindowId) setActiveWindowId(targetWindowId);
    setActivePanel(panel.id);

    // Force restore-terminal emit for terminals
    if (panel.terminalId && socket) {
      socket.emit('restore-terminal', { terminalId: panel.terminalId, sshConnectionId: panel.sshConnectionId || null });
    }
  };



  const activePanelsCount = panels.filter(p => (p.windowId || 'w1') === activeWindowId).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      <UpdateNotification />
      <AppHeader
        mode="terminal"
        sessionName="Workspace"
        panelCount={activePanelsCount}
        centerContent={!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: '100%' }}>
            {tabsOverflow.canLeft && (
              <Box onClick={() => scrollTabs(-200)} title="Scroll left"
                sx={{
                  flexShrink: 0, px: 0.8, py: 0.5, cursor: 'pointer',
                  color: 'rgba(255,255,255,0.7)', fontSize: 14, userSelect: 'none',
                  '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px' }
                }}
              >◀</Box>
            )}
          <Box ref={tabsScrollRef} sx={{
            display: 'flex', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0,
            overflowX: 'auto', overflowY: 'hidden',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}>
            {windows.map(win => {
              const isActive = win.id === activeWindowId;
              const winPanels = panels.filter(p => (p.windowId || 'w1') === win.id);
              const panelCount = winPanels.length;
              const isRenaming = renamingWindowId === win.id;
              const isDropTarget = dragOverWindowTab === win.id && draggingPanelForWindow;
              // Has recent activity (within 2s) on any panel of this window?
              const now = Date.now();
              const hasActivity = winPanels.some(p => p.terminalId && activityMap[p.terminalId] && (now - activityMap[p.terminalId] < 2000));
              const isTabDragTarget = dragOverTabId === win.id && draggingTabId && draggingTabId !== win.id;
              const isBeingDraggedTab = draggingTabId === win.id;
              return (
                <Box key={win.id}
                  draggable={!isRenaming}
                  onDragStart={(e) => {
                    if (isRenaming) { e.preventDefault(); return; }
                    setDraggingTabId(win.id);
                    e.dataTransfer.effectAllowed = 'move';
                    // Lightweight drag ghost (prevents renderer crashes)
                    try {
                      const g = document.createElement('div');
                      g.textContent = win.name;
                      g.style.cssText = 'position:absolute;top:-1000px;padding:4px 10px;background:#1a1a1a;color:#00ff00;border:1px solid #00ff00;border-radius:4px;font-size:11px;white-space:nowrap;font-family:monospace';
                      document.body.appendChild(g);
                      e.dataTransfer.setDragImage(g, 10, 10);
                      setTimeout(() => { try { document.body.removeChild(g); } catch (_) {} }, 0);
                    } catch (_) {}
                  }}
                  onDragEnd={() => { setDraggingTabId(null); setDragOverTabId(null); }}
                  onClick={() => {
                    if (isRenaming) return;
                    if (isActive) { setRenamingWindowId(win.id); setRenameWindowValue(win.name); }
                    else setActiveWindowId(win.id);
                  }}
                  onDragOver={(e) => {
                    if (draggingPanelForWindow || draggingTabId) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggingTabId && draggingTabId !== win.id) {
                        if (dragOverTabId !== win.id) setDragOverTabId(win.id);
                      } else if (draggingPanelForWindow && dragOverWindowTab !== win.id) {
                        setDragOverWindowTab(win.id);
                      }
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverWindowTab === win.id) setDragOverWindowTab(null);
                    if (dragOverTabId === win.id) setDragOverTabId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    // Tab reorder: swap dragged tab with this tab
                    if (draggingTabId && draggingTabId !== win.id) {
                      setWindows(prev => {
                        const arr = [...prev];
                        const fromIdx = arr.findIndex(w => w.id === draggingTabId);
                        const toIdx = arr.findIndex(w => w.id === win.id);
                        if (fromIdx < 0 || toIdx < 0) return prev;
                        const [moved] = arr.splice(fromIdx, 1);
                        arr.splice(toIdx, 0, moved);
                        return arr;
                      });
                      setDraggingTabId(null);
                      setDragOverTabId(null);
                      return;
                    }
                    if (draggingPanelForWindow) {
                      // Minimized → restore to target window
                      const minPanel = minimizedPanels.find(p => p.id === draggingPanelForWindow);
                      if (minPanel) {
                        setMinimizedPanels(prev => prev.filter(p => p.id !== draggingPanelForWindow));
                        setPanels(prev => prev.some(p => p.id === draggingPanelForWindow)
                          ? prev
                          : [...prev, { ...minPanel, windowId: win.id, _restoreKey: Date.now() }]);
                        if (minPanel.terminalId && socket) {
                          socket.emit('restore-terminal', { terminalId: minPanel.terminalId, sshConnectionId: minPanel.sshConnectionId || null });
                        }
                        setActiveWindowId(win.id);
                        setActivePanel(draggingPanelForWindow);
                      } else {
                        // Active panel: move to target window if it isn't already there
                        const sourcePanel = panels.find(p => p.id === draggingPanelForWindow);
                        const currentWin = sourcePanel?.windowId || 'w1';
                        if (currentWin !== win.id) {
                          setPanels(prev => prev.map(p =>
                            p.id === draggingPanelForWindow ? { ...p, windowId: win.id } : p
                          ));
                          setActiveWindowId(win.id);
                          setActivePanel(draggingPanelForWindow);
                        }
                      }
                    }
                    setDraggingPanelForWindow(null);
                    setDragOverWindowTab(null);
                  }}
                  title={isActive ? 'Click to rename · drag to reorder' : 'Click to switch · drag to reorder · drop a panel here to move it'}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    padding: '2px 10px', borderRadius: '4px',
                    backgroundColor: isDropTarget ? 'rgba(0,255,0,0.3)' :
                      isTabDragTarget ? 'rgba(100,180,255,0.25)' :
                      isActive ? 'rgba(0,255,0,0.15)' : 'transparent',
                    border: isDropTarget ? '1px solid #00ff00' :
                      isTabDragTarget ? '1px dashed #64b4ff' :
                      isActive ? '1px solid #00ff00' : '1px solid transparent',
                    color: isActive ? '#00ff00' : 'rgba(255,255,255,0.7)',
                    cursor: isRenaming ? 'text' : 'pointer',
                    fontSize: '11px', whiteSpace: 'nowrap',
                    opacity: isBeingDraggedTab ? 0.4 : 1,
                    transition: 'background-color 0.1s, opacity 0.1s',
                    '&:hover': !isActive && !isRenaming ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}
                  }}
                >
                  {isRenaming ? (
                    <input
                      autoFocus value={renameWindowValue}
                      onChange={(e) => setRenameWindowValue(e.target.value)}
                      onBlur={() => {
                        setWindows(ws => ws.map(w => w.id === win.id ? { ...w, name: renameWindowValue.trim() || w.name } : w));
                        setRenamingWindowId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') setRenamingWindowId(null);
                      }}
                      style={{ background: '#000', color: '#0f0', border: '1px solid #333', outline: 'none', fontSize: '11px', padding: '1px 4px', width: '80px' }}
                    />
                  ) : (
                    <>
                      {hasActivity && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00ff00',
                          animation: 'muxpulse 1s ease-in-out infinite', marginRight: 2
                        }} title="Activity in this window" />
                      )}
                      <style>{`@keyframes muxpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
                      <span>{win.name}</span>
                      {windows.length > 1 && (
                        <span onClick={(e) => {
                          e.stopPropagation();
                          if (panelCount > 0 && !confirm(`Close ${win.name} with ${panelCount} panel(s)? Panels will move to first window.`)) return;
                          const fallback = windows.find(w => w.id !== win.id).id;
                          setPanels(prev => prev.map(p => p.windowId === win.id ? { ...p, windowId: fallback } : p));
                          setMinimizedPanels(prev => prev.map(p => p.windowId === win.id ? { ...p, windowId: fallback } : p));
                          const remaining = windows.filter(w => w.id !== win.id);
                          setWindows(remaining);
                          if (activeWindowId === win.id) setActiveWindowId(remaining[0].id);
                        }}
                        style={{ marginLeft: 6, cursor: 'pointer', fontSize: '10px', opacity: 0.6 }}
                        title="Close window"
                        >✕</span>
                      )}
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
          {tabsOverflow.canRight && (
            <Box onClick={() => scrollTabs(200)} title="Scroll right"
              sx={{
                flexShrink: 0, px: 0.8, py: 0.5, cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, userSelect: 'none',
                '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px' }
              }}
            >▶</Box>
          )}
          <Box onClick={() => {
            const newId = 'w' + Date.now();
            setWindows(ws => [...ws, { id: newId, name: `Window ${ws.length + 1}` }]);
            setActiveWindowId(newId);
          }}
          title="New window"
          sx={{
            flexShrink: 0,
            padding: '2px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '14px',
            borderRadius: '4px', '&:hover': { color: '#00ff00', backgroundColor: 'rgba(0,255,0,0.08)' }
          }}
          >+</Box>
          </Box>
        )}
        onLogout={() => { logout(); navigate('/login'); }}
        rightContent={
          <>
            {!isMobile ? (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleNewTerminal}
                  disabled={activePanelsCount >= 8}
                  title={activePanelsCount >= 8 ? 'Maximum 8 panels' : 'New terminal'}
                  sx={{ mr: 1, opacity: activePanelsCount >= 8 ? 0.4 : 1 }}
                >
                  Terminal
                </Button>
              ) : (
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={handleNewTerminal}
                  disabled={activePanelsCount >= 8}
                  sx={{ ml: 1, opacity: activePanelsCount >= 8 ? 0.4 : 1 }}
                >
                  <AddIcon />
                </IconButton>
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
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
         {panels.length > 0 ? windows.map(win => {
            const winPanels = panels.filter(p => (p.windowId || 'w1') === win.id);
            if (winPanels.length === 0) return null;
            const isActive = win.id === activeWindowId;
            return (
              <Box key={`pm-${win.id}`} sx={{ display: isActive ? 'flex' : 'none', flex: 1, overflow: 'hidden', minHeight: 0, flexDirection: 'column' }}>
                <PanelManager
                  key={`pmgr-${win.id}`}
                  windowId={win.id}
                  onPanelDragStart={(id) => setDraggingPanelForWindow(id)}
                  onPanelDragEnd={() => { setDraggingPanelForWindow(null); setDragOverWindowTab(null); }}
                  panels={winPanels}
                  activePanel={activePanel}
                  onPanelSelect={setActivePanel}
                  onPanelClose={handleClosePanel}
                  onRenamePanel={handleRenamePanel}
                  onPanelSettings={handlePanelSettings}
                  onMinimizePanel={handleMinimizePanel}
                  onReorderPanels={(fromId, toId) => {
                    setPanels(prev => {
                      const arr = [...prev];
                      const fromIdx = arr.findIndex(p => p.id === fromId);
                      const toIdx = arr.findIndex(p => p.id === toId);
                      if (fromIdx < 0 || toIdx < 0) return prev;
                      [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
                      return arr;
                    });
                  }}
                  onSftpPathChange={(panelId, newPath) => {
                    setPanels(prev => prev.map(p =>
                      p.id === panelId ? { ...p, sftpPath: newPath } : p
                    ));
                  }}
                  onTerminalCreated={(panelId, newTerminalId) => {
                    setPanels(prev => prev.map(p =>
                      p.id === panelId ? { ...p, terminalId: newTerminalId } : p
                    ));
                  }}
                />
              </Box>
            );
          }) : null}
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
          <div onClick={function() { setMobilePanelListOpen(false); setMobileFilter(''); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '60vh', backgroundColor: '#1a1a1a',
            borderTop: '2px solid #00ff00', borderRadius: '16px 16px 0 0', overflow: 'auto', zIndex: 1001, padding: '12px 0' }}>
            <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Panels</span>
              <span style={{ fontSize: 10, color: '#444' }}>{panels.length} active · {minimizedPanels.length} min</span>
            </div>
            <div style={{ padding: '0 12px 8px' }}>
              <input
                type="text"
                placeholder="Filter..."
                value={mobileFilter}
                onChange={function(e) { setMobileFilter(e.target.value); }}
                style={{
                  width: '100%', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid #333', borderRadius: 6, color: '#ccc', fontSize: 13,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Windows section (only if more than one window exists) */}
            {windows.length > 1 ? (
              <div style={{ marginBottom: 4 }}>
                <div style={{ padding: '4px 16px', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Windows</div>
                <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto' }}>
                  {windows.map(function(win) {
                    const isWinActive = win.id === activeWindowId;
                    const count = panels.filter(function(p) { return (p.windowId || 'w1') === win.id; }).length;
                    return (
                      <div key={'mw-' + win.id}
                        onClick={function() { setActiveWindowId(win.id); }}
                        style={{
                          padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap',
                          backgroundColor: isWinActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isWinActive ? '1px solid #00ff00' : '1px solid transparent',
                          color: isWinActive ? '#00ff00' : '#ccc',
                          fontSize: 12, display: 'flex', alignItems: 'center', gap: 4
                        }}>
                        <span>{win.name}</span>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {panels
              .filter(function(p) { return !mobileFilter || (p.name || '').toLowerCase().includes(mobileFilter.toLowerCase()); })
              .map(function(panel, idx) {
              const panelWin = panel.windowId || 'w1';
              const winLabel = (windows.find(function(w) { return w.id === panelWin; }) || {}).name || '';
              return (
                <div key={'mp-' + panel.id}
                  onClick={function() {
                    if (panelWin !== activeWindowId) setActiveWindowId(panelWin);
                    setActivePanel(panel.id);
                    setMobilePanelListOpen(false);
                    setMobileFilter('');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                    backgroundColor: panel.id === activePanel ? 'rgba(0,255,0,0.08)' : 'transparent',
                    borderLeft: panel.id === activePanel ? '3px solid #00ff00' : '3px solid transparent' }}>
                  <span style={{ fontSize: 16 }}>{panel.type === 'rdp' || panel.type === 'vnc' ? '🖥️' : panel.type === 'sftp' ? '📁' : '⬛'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: panel.id === activePanel ? '#00ff00' : '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{panel.name || 'Panel ' + (idx + 1)}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>
                      {(panel.type || 'local').toUpperCase()}
                      {windows.length > 1 && winLabel ? ' · ' + winLabel : ''}
                    </div>
                  </div>
                </div>
              );
            })}
            {minimizedPanels.filter(function(p) { return !mobileFilter || (p.name || '').toLowerCase().includes(mobileFilter.toLowerCase()); }).length > 0 ? (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#555', textTransform: 'uppercase' }}>Minimized</div>
                {minimizedPanels
                  .filter(function(p) { return !mobileFilter || (p.name || '').toLowerCase().includes(mobileFilter.toLowerCase()); })
                  .map(function(panel) {
                  const panelWin = panel.windowId || 'w1';
                  const winLabel = (windows.find(function(w) { return w.id === panelWin; }) || {}).name || '';
                  return (
                    <div key={'mpm-' + panel.id} onClick={function() { handleRestorePanel(panel); setMobilePanelListOpen(false); setMobileFilter(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', opacity: 0.6 }}>
                      <span style={{ fontSize: 16 }}>⬛</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{panel.name || 'Panel'}</div>
                        {windows.length > 1 && winLabel ? (
                          <div style={{ fontSize: 10, color: '#555' }}>{winLabel}</div>
                        ) : null}
                      </div>
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
        const winName = (wid) => {
          const w = windows.find(x => x.id === (wid || 'w1'));
          return w ? w.name : 'Window 1';
        };
        const winShort = (wid) => {
          const w = windows.find(x => x.id === (wid || 'w1'));
          if (!w) return 'W1';
          // Build short badge from window name: "Window 2" → "W2", "Proyecto A" → "PA", "Work" → "Wo"
          const words = w.name.trim().split(/\s+/);
          if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
          const match = w.name.match(/(\D*)(\d+)/);
          if (match) return (match[1][0] || 'W').toUpperCase() + match[2];
          return w.name.slice(0, 2).toUpperCase();
        };
        const allPanels = [
          ...panels.map((p, i) => ({
            ...p, status: 'active',
            displayName: p.name || `Terminal ${i + 1}`,
            windowShort: winShort(p.windowId),
            windowFullName: winName(p.windowId)
          })),
          ...minimizedPanels.map(p => ({
            ...p, status: 'minimized',
            displayName: p.name || 'Terminal',
            windowShort: winShort(p.windowId),
            windowFullName: winName(p.windowId)
          }))
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
                    // Don't close if filter input is focused
                    if (sidebarFilterRef.current && sidebarFilterRef.current === document.activeElement) return;
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
                  {/* Actives — grouped by window */}
                  {(() => {
                    // Group panels by window
                    const grouped = {};
                    for (const p of filteredActive) {
                      const wid = p.windowId || 'w1';
                      if (!grouped[wid]) grouped[wid] = [];
                      grouped[wid].push(p);
                    }
                    // Sort windows by their natural order
                    const winOrder = windows.map(w => w.id);
                    const sortedWids = Object.keys(grouped).sort((a, b) => {
                      const ai = winOrder.indexOf(a), bi = winOrder.indexOf(b);
                      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                    });
                    const showHeaders = sortedWids.length > 1 && !sidebarFilter;
                    return sortedWids.map(wid => {
                      const wPanels = grouped[wid];
                      const winObj = windows.find(w => w.id === wid);
                      const winLabel = winObj ? winObj.name : 'Window';
                      return (
                        <React.Fragment key={`grp-${wid}`}>
                          {showHeaders && (
                            <Box sx={{ px: '10px', pt: '6px', pb: '2px' }}>
                              <Typography variant="caption" sx={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {winLabel}
                              </Typography>
                            </Box>
                          )}
                          {wPanels.map(panel => (
                    <Box
                      key={`sidebar-active-${panel.id}`}
                      draggable
                      onDragStart={(e) => {
                        setDragPanelId(panel.id);
                        setDraggingPanelForWindow(panel.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragPanelId && panel.id !== dragPanelId) setDragOverPanelId(panel.id);
                      }}
                      onDragLeave={() => { if (dragOverPanelId === panel.id) setDragOverPanelId(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragPanelId && dragPanelId !== panel.id) {
                          setPanels(prev => {
                            const arr = [...prev];
                            const fromIdx = arr.findIndex(p => p.id === dragPanelId);
                            const toIdx = arr.findIndex(p => p.id === panel.id);
                            if (fromIdx < 0 || toIdx < 0) return prev;
                            [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
                            return arr;
                          });
                        }
                        setDragPanelId(null);
                        setDragOverPanelId(null);
                        setDraggingPanelForWindow(null);
                      }}
                      onDragEnd={() => { setDragPanelId(null); setDragOverPanelId(null); setDraggingPanelForWindow(null); setDragOverWindowTab(null); }}
                      onClick={() => {
                        const panelWin = panel.windowId || 'w1';
                        if (panelWin !== activeWindowId) setActiveWindowId(panelWin);
                        setActivePanel(panel.id);
                        setSidebarOpen(false);
                        setSidebarFilter('');
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 12px',
                        cursor: dragPanelId ? 'grabbing' : 'pointer',
                        backgroundColor: dragOverPanelId === panel.id ? 'rgba(0, 255, 0, 0.15)' :
                          panel.id === activePanel ? 'rgba(0, 255, 0, 0.08)' : 'transparent',
                        borderLeft: panel.id === activePanel ? '2px solid #00ff00' : '2px solid transparent',
                        borderTop: dragOverPanelId === panel.id ? '2px solid #00ff00' : '2px solid transparent',
                        opacity: dragPanelId === panel.id ? 0.4 : 1,
                        transition: 'background-color 0.1s ease, opacity 0.1s ease',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          '& .sidebar-minimize': { opacity: 1 }
                        }
                      }}
                    >
                      <DotIcon sx={{ fontSize: 8, color: '#00ff00' }} />
                      <Typography variant="caption" sx={{ fontSize: '9px', color: panel.id === activePanel ? '#00aa00' : '#666', minWidth: '28px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        {(panel.type || 'local').replace('local', 'term')}
                      </Typography>
                      {!showHeaders && windows.length > 1 && (
                        <Box title={panel.windowFullName} sx={{
                          fontSize: '8px', color: panel.id === activePanel ? '#00aa00' : '#888',
                          backgroundColor: panel.id === activePanel ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.05)',
                          padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace', flexShrink: 0
                        }}>{panel.windowShort}</Box>
                      )}
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
                        title={panel.displayName}
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
                        </React.Fragment>
                      );
                    });
                  })()}

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
                          draggable
                          onDragStart={(e) => {
                            setDragMinId(panel.id);
                            setDraggingPanelForWindow(panel.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragMinId && panel.id !== dragMinId) setDragOverMinId(panel.id);
                          }}
                          onDragLeave={() => { if (dragOverMinId === panel.id) setDragOverMinId(null); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragMinId && dragMinId !== panel.id) {
                              setMinimizedPanels(prev => {
                                const arr = [...prev];
                                const fromIdx = arr.findIndex(p => p.id === dragMinId);
                                const toIdx = arr.findIndex(p => p.id === panel.id);
                                if (fromIdx < 0 || toIdx < 0) return prev;
                                [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
                                return arr;
                              });
                            }
                            setDragMinId(null);
                            setDragOverMinId(null);
                            setDraggingPanelForWindow(null);
                          }}
                          onDragEnd={() => { setDragMinId(null); setDragOverMinId(null); setDraggingPanelForWindow(null); setDragOverWindowTab(null); }}
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
                            cursor: dragMinId ? 'grabbing' : 'pointer',
                            borderLeft: '2px solid transparent',
                            borderTop: dragOverMinId === panel.id ? '2px solid #00ff00' : '2px solid transparent',
                            backgroundColor: dragOverMinId === panel.id ? 'rgba(0, 255, 0, 0.1)' : 'transparent',
                            opacity: dragMinId === panel.id ? 0.3 : 0.5,
                            transition: 'background-color 0.1s ease, opacity 0.1s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              opacity: 1
                            }
                          }}
                        >
                          <DotIcon sx={{ fontSize: 8, color: '#444' }} />
                          <Typography variant="caption" sx={{ fontSize: '9px', color: '#555', minWidth: '28px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                            {(panel.type || 'local').replace('local', 'term')}
                          </Typography>
                          {windows.length > 1 && (
                            <Box title={panel.windowFullName} sx={{
                              fontSize: '8px', color: '#888',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace', flexShrink: 0
                            }}>{panel.windowShort}</Box>
                          )}
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
                            title={panel.displayName}
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

      {/* Panel Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '16px' }}>Panel Settings</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Panel Name" fullWidth variant="outlined"
            value={settingsPanelName} onChange={(e) => setSettingsPanelName(e.target.value)}
          />
          <TextField
            margin="dense" label="Startup command (runs on reboot)" fullWidth variant="outlined" size="small"
            placeholder="e.g. claude --dangerously-skip-permissions --continue"
            value={settingsStartupCommand} onChange={(e) => setSettingsStartupCommand(e.target.value)}
            helperText="This command will execute automatically when the terminal is restored after a reboot"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmPanelSettings} variant="contained">Save</Button>
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
                placeholder={localPasswordCached ? '••••••••  (stored locally)' : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setLocalPasswordCached(false);
                  if (newTerminalType === 'rdp') setRdpPassword(v);
                  else if (newTerminalType === 'vnc') setVncPassword(v);
                  else if (newTerminalType === 'sftp') setSftpPassword(v);
                  else setSshPassword(v);
                }}
                helperText={localPasswordCached ? 'Password stored locally — leave empty to use it' : ''}
                onKeyPress={(e) => { if (e.key === 'Enter') handleCreateTerminal(); }}
              />

              {/* Domain (RDP only) */}
              {newTerminalType === 'rdp' && (
                <TextField margin="dense" label="Domain (optional)" fullWidth variant="outlined" size="small"
                  value={rdpDomain} onChange={(e) => setRdpDomain(e.target.value)}
                />
              )}

              {/* Initial path (SSH only) */}
              {newTerminalType === 'ssh' && (
                <TextField margin="dense" label="Initial path (optional)" fullWidth variant="outlined" size="small"
                  value={sshInitialPath} onChange={(e) => setSshInitialPath(e.target.value)}
                  placeholder="/var/www/myproject"
                  helperText="Runs `cd <path>` once the SSH session is ready (~2.5s after connect)"
                />
              )}

              {/* Initial path (SFTP only) */}
              {newTerminalType === 'sftp' && (
                <TextField margin="dense" label="Initial path (optional)" fullWidth variant="outlined" size="small"
                  value={sftpInitialPath} onChange={(e) => setSftpInitialPath(e.target.value)}
                  placeholder="/var/www/myproject"
                  helperText="Opens the file browser in this folder instead of the home directory"
                />
              )}

              {/* Unified credential search */}
              {newTerminalType !== 'local' && (
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #333' }}>
                  <TextField
                    fullWidth size="small" margin="dense"
                    label="🔍 Search credentials"
                    placeholder="Type to filter..."
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                  />
                  <Box sx={{ maxHeight: '180px', overflow: 'auto', border: '1px solid #333', borderRadius: 1, mt: 0.5 }}>
                    {/* Local saved connections */}
                    {(() => {
                      const localConns = newTerminalType === 'rdp' ? rdpConnections
                        : newTerminalType === 'vnc' ? vncConnections
                        : sshConnections; // ssh and sftp use ssh connections
                      // Build a Set of vault keys to detect locals that are also stored in Bitwarden.
                      const scheme = newTerminalType === 'sftp' ? 'ssh' : newTerminalType;
                      const vaultKeys = new Set();
                      (vaultItems || []).forEach(item => {
                        (item.connections || []).forEach(c => {
                          vaultKeys.add(`${c.scheme}:${c.host}:${c.port || ''}:${item.username || ''}`);
                        });
                      });
                      const isInVault = (conn) => vaultKeys.has(`${scheme}:${conn.host}:${conn.port || ''}:${conn.username || ''}`);
                      return localConns
                        .filter(c => !vaultSearch || c.name?.toLowerCase().includes(vaultSearch.toLowerCase()) || c.host?.includes(vaultSearch))
                        .map(conn => (
                          <Box key={`local-${conn.id}`}
                            onClick={() => {
                              if (newTerminalType === 'rdp') setSelectedRdpConnection(String(conn.id));
                              else if (newTerminalType === 'vnc') setSelectedVncConnection(String(conn.id));
                              else setSelectedSshConnection(String(conn.id));
                              if (newTerminalType === 'ssh') {
                                setSshHost(conn.host); setSshPort(String(conn.port || 22)); setSshUsername(conn.username || '');
                                setSshInitialPath(conn.initial_path || '');
                              } else if (newTerminalType === 'sftp') {
                                setSftpHost(conn.host); setSftpPort(String(conn.port || 22)); setSftpUsername(conn.username || '');
                                setSftpInitialPath(conn.initial_path || '');
                              } else if (newTerminalType === 'rdp') {
                                setRdpHost(conn.host); setRdpPort(String(conn.port || 3389)); setRdpUsername(conn.username || '');
                              } else if (newTerminalType === 'vnc') {
                                setVncHost(conn.host); setVncPort(String(conn.port || 5900));
                              }
                              setLocalPasswordCached(true);
                              setVaultSearch('');
                            }}
                            sx={{
                              p: 0.8, cursor: 'pointer', borderBottom: '1px solid #222',
                              '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ fontSize: '12px', color: '#ccc' }}>
                                💾 {conn.name || `${conn.username}@${conn.host}`}
                                {isInVault(conn) && (
                                  <Box component="span" sx={{ ml: 0.5, color: '#00aa55', fontSize: '11px' }} title="Also stored in Bitwarden">🔗</Box>
                                )}
                              </Box>
                              <Box sx={{ fontSize: '10px', color: '#666' }}>{conn.host}:{conn.port} {conn.username && `• ${conn.username}`}</Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.3, ml: 0.5 }}>
                              {/* Edit local */}
                              <Box onClick={(e) => {
                                e.stopPropagation();
                                const connType = newTerminalType === 'sftp' ? 'ssh' : newTerminalType;
                                setVaultEditFields({ name: conn.name || `${conn.username || ''}@${conn.host}`, username: conn.username || '', password: '', host: conn.host || '', port: String(conn.port || ''), type: connType, initialPath: conn.initial_path || '' });
                                setVaultEditDialog({ mode: 'edit-local', connId: conn.id, connType });
                              }} sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#aaa' } }} title="Edit">✏️</Box>
                              {/* Delete local */}
                              <Box onClick={(e) => {
                                e.stopPropagation();
                                const connType = newTerminalType === 'sftp' ? 'ssh' : newTerminalType;
                                setVaultEditDialog({ mode: 'delete-local', connId: conn.id, connType, item: { name: conn.name || `${conn.username || ''}@${conn.host}` } });
                              }}
                                sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#f44' } }} title="Delete">🗑️</Box>
                            </Box>
                          </Box>
                        ));
                    })()}
                    {/* Bitwarden vault items */}
                    {vaultLoggedIn && vaultItems
                      .filter(i => i.connections.some(c => c.scheme === newTerminalType || (newTerminalType === 'sftp' && c.scheme === 'ssh')))
                      .filter(i => !vaultSearch || i.name.toLowerCase().includes(vaultSearch.toLowerCase()) || i.connections.some(c => c.host.includes(vaultSearch)))
                      .map(item => (
                        <Box key={`vault-${item.id}`}
                          sx={{
                            p: 0.8, cursor: 'pointer', borderBottom: '1px solid #222',
                            backgroundColor: selectedVaultItem?.id === item.id ? 'rgba(0,255,0,0.1)' : 'transparent',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                          }}>
                          <Box onClick={() => { applyVaultItem(item); setVaultSearch(''); }} sx={{ flex: 1 }}>
                            <Box sx={{ fontSize: '12px', color: '#ccc' }}>🔐 {item.name}</Box>
                            <Box sx={{ fontSize: '10px', color: '#666' }}>
                              {item.connections.map(c => `${c.scheme}://${c.host}${c.port ? ':' + c.port : ''}`).join(', ')}
                              {item.username && ` • ${item.username}`}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.3, ml: 0.5 }}>
                            <Box onClick={async (e) => {
                              e.stopPropagation();
                              setVaultEditDialog({ mode: 'loading' });
                              try {
                                const res = await fetch(`/api/vault/item/${item.id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
                                if (!vaultSessionCheck(res)) { setVaultEditDialog(null); return; }
                                const data = await res.json();
                                if (data.status !== 'ok') { setVaultEditDialog(null); return; }
                                const conn = item.connections[0] || {};
                                setVaultEditFields({ name: data.item.name, username: data.item.username || '', password: data.item.password || '', host: conn.host || '', port: String(conn.port || ''), type: conn.scheme || newTerminalType, initialPath: data.item.initialPath || '' });
                                setVaultEditDialog({ mode: 'edit', item });
                              } catch (err) { setVaultEditDialog(null); }
                            }} sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#aaa' } }} title="Edit">✏️</Box>
                            <Box onClick={(e) => { e.stopPropagation(); setVaultEditDialog({ mode: 'delete', item }); }}
                              sx={{ p: 0.3, cursor: 'pointer', color: '#555', fontSize: '11px', '&:hover': { color: '#f44' } }} title="Delete">🗑️</Box>
                          </Box>
                        </Box>
                      ))
                    }
                    {vaultItemsLoading && (
                      <Box sx={{ p: 1.5, textAlign: 'center', color: '#888', fontSize: '11px' }}>🔄 Loading...</Box>
                    )}
                    {(() => {
                      const localConns = newTerminalType === 'rdp' ? rdpConnections : newTerminalType === 'vnc' ? vncConnections : sshConnections;
                      const vaultCount = vaultLoggedIn ? vaultItems.filter(i => i.connections.some(c => c.scheme === newTerminalType || (newTerminalType === 'sftp' && c.scheme === 'ssh'))).length : 0;
                      if (!vaultItemsLoading && localConns.length === 0 && vaultCount === 0) {
                        return <Box sx={{ p: 1.5, textAlign: 'center', color: '#555', fontSize: '11px' }}>
                          No saved credentials{!vaultLoggedIn ? ' — connect Bitwarden in ⚙️ Settings' : ''}
                        </Box>;
                      }
                      return null;
                    })()}
                  </Box>
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
          {vaultLoggedIn && newTerminalType !== 'local' && <Box sx={{ flex: 1 }} />}
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

      {/* Vault migration prompt — first time vault is connected with pending local creds */}
      <Dialog open={!!migrationPrompt} onClose={() => setMigrationPrompt(null)} maxWidth="sm" fullWidth>
        <DialogTitle>☁️ Subir credenciales locales a Bitwarden</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#ccc', mb: 1.5 }}>
            Se detectaron <b>{migrationPrompt?.candidates?.length || 0}</b> credenciales SSH guardadas localmente que no existen en tu vault.
            ¿Las subo a Bitwarden?
          </Typography>
          <Box sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid #333', borderRadius: 1, p: 1 }}>
            {(migrationPrompt?.candidates || []).map(conn => (
              <Box key={conn.id} sx={{ fontSize: '12px', color: '#aaa', py: 0.3, display: 'flex', alignItems: 'center', gap: 0.5, '&:hover .del-btn': { opacity: 1 } }}>
                <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  💾 {conn.name || `${conn.username}@${conn.host}`} <Box component="span" sx={{ color: '#666' }}>— {conn.host}:{conn.port}</Box>
                </Box>
                <Box
                  className="del-btn"
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (migrationPrompt?.uploading) return;
                    const label = conn.name || `${conn.username || ''}@${conn.host}`;
                    if (!window.confirm(`Eliminar credencial local "${label}"?\nNo se subirá a Bitwarden y se borra del vault local. No se puede deshacer.`)) return;
                    socket.emit('delete-ssh-connection', { id: conn.id });
                    setMigrationPrompt(p => {
                      if (!p) return null;
                      const remaining = p.candidates.filter(c => c.id !== conn.id);
                      if (remaining.length === 0) return null;
                      return { ...p, candidates: remaining };
                    });
                  }}
                  sx={{
                    cursor: 'pointer', color: '#888', fontSize: '13px', px: 0.5, opacity: 0, transition: 'opacity 0.1s',
                    '&:hover': { color: '#f44' }
                  }}
                  title="Eliminar credencial local (no subirla a Bitwarden)"
                >🗑️</Box>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '11px', color: '#777', mt: 1 }}>
            Los passwords se toman del caché local encriptado. Si alguno no existe en caché, el item se creará sin password (lo pedirá al conectar). Hacé hover en cada ítem para eliminarlo del local sin subirlo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => { localStorage.setItem('muxterm_vault_migration_dismissed', 'true'); setMigrationPrompt(null); }}
            disabled={migrationPrompt?.uploading}
            title="Dejar de mostrar este diálogo, incluso si agregás credenciales locales nuevas más adelante."
            sx={{ color: '#888' }}
          >
            No volver a preguntar
          </Button>
          <Button
            onClick={() => setMigrationPrompt(null)}
            disabled={migrationPrompt?.uploading}
            title="Volver a preguntar la próxima vez que te conectes a Bitwarden."
          >
            Más tarde
          </Button>
          <Button variant="contained" onClick={uploadMigrationCandidates} disabled={migrationPrompt?.uploading}>
            {migrationPrompt?.uploading ? <CircularProgress size={16} /> : `Subir las ${migrationPrompt?.candidates?.length || 0}`}
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
          {/* Auto-update */}
          {isAdmin && (
            <Box sx={{ mb: 2, p: 1.5, border: '1px solid #333', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '13px', color: '#ccc' }}>⬆️ Automatic updates</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#666' }}>
                    Checks for updates every 6 hours and applies them in the background.
                  </Typography>
                </Box>
                <Button size="small" variant={autoUpdateEnabled ? 'contained' : 'outlined'}
                  color={autoUpdateEnabled ? 'success' : 'inherit'}
                  onClick={async () => {
                    const next = !autoUpdateEnabled;
                    setAutoUpdateEnabled(next);
                    try {
                      await fetch('/api/system-settings', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ autoUpdateEnabled: next })
                      });
                    } catch (e) {}
                  }}
                >{autoUpdateEnabled ? 'ON' : 'OFF'}</Button>
              </Box>
            </Box>
          )}

          {/* Diagnostics */}
          <Box sx={{ mb: 2, p: 1.5, border: '1px solid #333', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '13px', color: '#ccc' }}>🩺 Diagnostics</Typography>
                <Typography sx={{ fontSize: '11px', color: '#666' }}>Collect events to help debug issues. Only enable if reporting a problem.</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button size="small" variant="outlined" onClick={() => { loadDiagLogs(); setDiagOpen(true); }}>View logs</Button>
                <Button size="small" variant={isDiagEnabled() ? 'contained' : 'outlined'}
                  color={isDiagEnabled() ? 'success' : 'inherit'}
                  onClick={() => { setDiagEnabled(!isDiagEnabled()); setSettingsOpen(false); setTimeout(() => setSettingsOpen(true), 100); }}
                >{isDiagEnabled() ? 'ON' : 'OFF'}</Button>
              </Box>
            </Box>
          </Box>

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
        ) : vaultEditDialog?.mode === 'delete' || vaultEditDialog?.mode === 'delete-local' ? (
          <>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: '13px' }}>
                Are you sure you want to delete <strong>{vaultEditDialog?.item?.name}</strong>?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setVaultEditDialog(null)} disabled={vaultActionLoading}>Cancel</Button>
              <Button color="error" variant="contained" disabled={vaultActionLoading} onClick={async () => {
                setVaultActionLoading(true);
                try {
                  if (vaultEditDialog.mode === 'delete-local') {
                    socket.emit(`delete-${vaultEditDialog.connType}-connection`, { id: vaultEditDialog.connId });
                    setVaultEditDialog(null);
                  } else {
                    const res = await fetch(`/api/vault/item/${vaultEditDialog.item.id}`, {
                      method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` }
                    });
                    if (!vaultSessionCheck(res)) return;
                    const data = await res.json();
                    if (data.status === 'ok') { setVaultEditDialog(null); loadVaultItems(newTerminalType); }
                    else alert(data.message);
                  }
                } catch (err) { alert(err.message); }
                finally { setVaultActionLoading(false); }
              }}>{vaultActionLoading ? <CircularProgress size={18} /> : 'Delete'}</Button>
            </DialogActions>
          </>
        ) : vaultEditDialog?.mode === 'save-duplicate' ? (
          <>
            <DialogTitle>Credential Already Exists</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: '13px', mb: 1 }}>
                A similar credential already exists in the vault:
              </Typography>
              <Box sx={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', p: 1.5, mb: 2 }}>
                <Typography sx={{ fontSize: '13px', color: '#00ff00', fontWeight: 500 }}>
                  {vaultEditDialog.duplicateItem?.name}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#888', mt: 0.5 }}>
                  {vaultEditDialog.duplicateItem?.username} @ {vaultEditDialog.duplicateItem?.connections?.[0]?.host}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '12px', color: '#aaa' }}>
                What would you like to do?
              </Typography>
            </DialogContent>
            <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2, alignItems: 'stretch' }}>
              <Button variant="contained" size="small" disabled={vaultActionLoading} onClick={async () => {
                setVaultActionLoading(true);
                try {
                  const r = await fetch(`/api/vault/item/${vaultEditDialog.duplicateItem.id}`, {
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
              }} sx={{ textTransform: 'none' }}>
                {vaultActionLoading ? <CircularProgress size={18} /> : 'Update existing credential'}
              </Button>
              <Button variant="outlined" size="small" disabled={vaultActionLoading} onClick={() => {
                setVaultEditDialog({ mode: 'save' });
              }} sx={{ textTransform: 'none' }}>
                Create new credential
              </Button>
              <Button size="small" disabled={vaultActionLoading} onClick={() => setVaultEditDialog(null)} sx={{ textTransform: 'none', color: '#888' }}>
                Cancel
              </Button>
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
                value={vaultEditFields.password}
                placeholder={localPasswordCached && vaultEditDialog?.mode === 'save' ? '••••••••  (stored locally)' : ''}
                helperText={localPasswordCached && !vaultEditFields.password && vaultEditDialog?.mode === 'save' ? 'Password from local storage will be used' : ''}
                onChange={(e) => setVaultEditFields(p => ({ ...p, password: e.target.value }))} />
              {vaultEditFields.type === 'ssh' && (
                <TextField margin="dense" label="Initial path (optional)" fullWidth variant="outlined" size="small"
                  value={vaultEditFields.initialPath || ''}
                  placeholder="/var/www/myproject"
                  helperText="Runs `cd <path>` once the SSH session is ready (~2.5s after connect)"
                  onChange={(e) => setVaultEditFields(p => ({ ...p, initialPath: e.target.value }))} />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setVaultEditDialog(null)} disabled={vaultActionLoading}>Cancel</Button>
              <Button variant="contained" disabled={vaultActionLoading} onClick={async () => {
                if (vaultEditDialog?.mode === 'save') {
                  executeVaultSave();
                } else if (vaultEditDialog?.mode === 'edit-local') {
                  setVaultActionLoading(true);
                  try {
                    const { name, host, port, username, password, type, initialPath } = vaultEditFields;
                    socket.emit(`update-${vaultEditDialog.connType}-connection`, {
                      id: vaultEditDialog.connId, name, host, port: parseInt(port), username, password,
                      initialPath: type === 'ssh' ? initialPath : undefined
                    });
                    // Cache password if provided
                    if (password) {
                      socket.emit('cache-credential', { type: vaultEditDialog.connType, host, port: parseInt(port), username, password });
                    }
                    setVaultEditDialog(null);
                  } catch (err) { alert(err.message); }
                  finally { setVaultActionLoading(false); }
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

      {/* Diagnostics logs modal */}
      <Dialog open={diagOpen} onClose={() => setDiagOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { backgroundColor: '#1a1a1a', height: '80vh' } }}>
        <DialogTitle sx={{ fontSize: '14px', borderBottom: '1px solid #333', py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🩺 Diagnostics ({diagLogs.length} events)</span>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={loadDiagLogs}>Refresh</Button>
            <Button size="small" color="error" onClick={clearDiagLogs}>Clear</Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, fontFamily: 'monospace', fontSize: '11px' }}>
          {diagLoading ? <Box sx={{ p: 2, textAlign: 'center', color: '#888' }}>Loading...</Box> : (
            <Box sx={{ overflow: 'auto', height: '100%' }}>
              {diagLogs.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', color: '#555' }}>No events yet</Box>
              ) : diagLogs.map((log) => {
                let data = null;
                try { data = JSON.parse(log.data); } catch (e) { data = log.data; }
                const date = new Date(log.ts);
                const time = date.toLocaleTimeString('es-CL', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
                const color = log.kind === 'js-error' || log.kind === 'promise-reject' ? '#f44'
                  : log.kind === 'metrics' ? '#888' : '#0f0';
                return (
                  <Box key={log.id} sx={{ display: 'flex', gap: 1, p: '2px 8px', borderBottom: '1px solid #1e1e1e', '&:hover': { backgroundColor: '#222' } }}>
                    <span style={{ color: '#666', width: 90, flexShrink: 0 }}>{time}</span>
                    <span style={{ color, width: 120, flexShrink: 0 }}>{log.kind}</span>
                    <span style={{ color: '#ccc', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                      {typeof data === 'object' ? JSON.stringify(data) : String(data || '')}
                    </span>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto-update non-blocking toast (hidden while the UpdateProgress modal is open) */}
      {updateStatus.state === 'in-progress' && !updateModalOpen && (
        <Box sx={{
          position: 'fixed', top: 70, right: 16, zIndex: 2000,
          backgroundColor: 'rgba(30, 30, 30, 0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #333', borderRadius: 2, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 1.5, maxWidth: 320,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.25s ease-out',
          '@keyframes slideInRight': { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } }
        }}>
          <CircularProgress size={18} sx={{ color: '#00ff00' }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
              Actualizando muxterm{updateStatus.target ? ` a v${updateStatus.target}` : ''}...
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#888' }}>
              Se aplicará sin interrumpir tu trabajo
            </Typography>
          </Box>
          <IconButton size="small" sx={{ color: '#666', p: 0.3 }}
            onClick={() => setUpdateStatus({ state: 'idle' })}
            title="Ocultar">
            <Typography sx={{ fontSize: 14 }}>✕</Typography>
          </IconButton>
        </Box>
      )}

      {updateStatus.state === 'applied' && (
        <Box sx={{
          position: 'fixed', top: 70, right: 16, zIndex: 2000,
          backgroundColor: 'rgba(20, 40, 20, 0.97)', backdropFilter: 'blur(8px)',
          border: '1px solid #00aa00', borderRadius: 2, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 1.5, maxWidth: 360,
          boxShadow: '0 8px 24px rgba(0,255,0,0.15)'
        }}>
          <Typography sx={{ fontSize: '18px' }}>✅</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
              muxterm actualizado a v{updateStatus.target}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#aaa' }}>
              Recargá la página para usar la nueva versión
            </Typography>
          </Box>
          <Button size="small" variant="contained" color="success"
            onClick={() => window.location.reload()}
            sx={{ fontSize: '11px', textTransform: 'none' }}>
            Recargar
          </Button>
          <IconButton size="small" sx={{ color: '#888', p: 0.3 }}
            onClick={() => setUpdateStatus({ state: 'idle' })}
            title="Después">
            <Typography sx={{ fontSize: 14 }}>✕</Typography>
          </IconButton>
        </Box>
      )}

    </Box>
  );
}

export default TerminalView;