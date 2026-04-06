import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  Box, Typography, TextField, CircularProgress, Breadcrumbs, Link
} from '@mui/material';
import {
  Folder as FolderIcon, InsertDriveFile as FileIcon,
  ArrowUpward as UpIcon, Refresh as RefreshIcon, Close as CloseIcon,
  CreateNewFolder as NewFolderIcon, Upload as UploadIcon, Delete as DeleteIcon,
  Download as DownloadIcon, Edit as EditIcon
} from '@mui/icons-material';

function LocalFileBrowser({ open, onClose, terminalId, mode = 'local', sshConnectionId = null }) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [renameDialog, setRenameDialog] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sftpSessionId, setSftpSessionId] = useState(null);
  const fileInputRef = useRef(null);

  const getToken = () => { try { return localStorage.getItem('token') || ''; } catch (e) { return ''; } };
  const apiBase = mode === 'ssh' ? '/api/sftp' : '/api/localfs';

  const loadCwd = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'ssh') {
        if (!sshConnectionId) { setError('No SSH connection'); return; }
        const r = await fetch('/api/sftp/connect-by-id', {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ sshConnectionId })
        });
        const d = await r.json();
        if (d.status === 'ok') {
          setSftpSessionId(d.sessionId);
          setCurrentPath(d.path);
          setFiles(d.files);
        } else {
          setError(d.message || 'Failed to connect');
        }
      } else {
        if (!terminalId) return;
        const r = await fetch(`/api/localfs/cwd/${terminalId}?_=${Date.now()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          cache: 'no-store'
        });
        const d = await r.json();
        if (d.status === 'ok') {
          setCurrentPath(d.cwd);
          listDir(d.cwd);
        } else {
          setError(d.message || 'Could not get CWD');
        }
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const listDir = async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const body = mode === 'ssh'
        ? { sessionId: sftpSessionId, path: dirPath }
        : { path: dirPath, _: Date.now() };
      const r = await fetch(`${apiBase}/list`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.status === 'ok') {
        setFiles(d.files);
        setCurrentPath(d.path || dirPath);
      } else {
        setError(d.message);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) loadCwd();
  }, [open, terminalId, sshConnectionId]);

  useEffect(() => {
    if (currentPath) listDir(currentPath);
  }, [currentPath]);

  const goUp = () => {
    const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/';
    setCurrentPath(parent);
  };

  const enterFolder = (file) => {
    if (file.type === 'folder') setCurrentPath(file.path);
  };

  const withSession = (obj) => mode === 'ssh' ? { ...obj, sessionId: sftpSessionId } : obj;

  const downloadFile = (file) => {
    const qs = mode === 'ssh'
      ? `?sessionId=${encodeURIComponent(sftpSessionId)}&path=${encodeURIComponent(file.path)}`
      : `?path=${encodeURIComponent(file.path)}`;
    fetch(`${apiBase}/download${qs}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    }).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  const deleteFile = async (file) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
      const r = await fetch(`${apiBase}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession({ path: file.path, isDir: file.type === 'folder' }))
      });
      const d = await r.json();
      if (d.status === 'ok') listDir(currentPath);
      else alert(d.message);
    } catch (e) { alert(e.message); }
  };

  const doRename = async () => {
    if (!renameDialog || !renameValue.trim()) return;
    const to = renameDialog.path.replace(/\/[^/]+$/, '/' + renameValue.trim());
    try {
      const r = await fetch(`${apiBase}/rename`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession({ from: renameDialog.path, to }))
      });
      const d = await r.json();
      if (d.status === 'ok') { setRenameDialog(null); setRenameValue(''); listDir(currentPath); }
      else alert(d.message);
    } catch (e) { alert(e.message); }
  };

  const doMkdir = async () => {
    if (!newFolderName.trim()) return;
    try {
      const r = await fetch(`${apiBase}/mkdir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(withSession({ path: `${currentPath}/${newFolderName.trim()}` }))
      });
      const d = await r.json();
      if (d.status === 'ok') { setNewFolderDialog(false); setNewFolderName(''); listDir(currentPath); }
      else alert(d.message);
    } catch (e) { alert(e.message); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('path', `${currentPath}/${file.name}`);
    if (mode === 'ssh') fd.append('sessionId', sftpSessionId);
    try {
      const r = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd
      });
      const d = await r.json();
      if (d.status === 'ok') listDir(currentPath);
      else alert(d.message);
    } catch (err) { alert(err.message); }
    e.target.value = '';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { backgroundColor: '#1a1a1a', height: '70vh' } }}>
        <DialogTitle sx={{ color: '#ccc', fontSize: '14px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
          <span>📁 File Browser</span>
          <IconButton size="small" onClick={onClose} sx={{ color: '#888' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1, borderBottom: '1px solid #333', backgroundColor: '#222' }}>
            <IconButton size="small" onClick={goUp} sx={{ color: '#888' }} title="Up"><UpIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => listDir(currentPath)} sx={{ color: '#888' }} title="Refresh"><RefreshIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setNewFolderDialog(true)} sx={{ color: '#888' }} title="New Folder"><NewFolderIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ color: '#888' }} title="Upload"><UploadIcon fontSize="small" /></IconButton>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
            <Box sx={{ flex: 1, ml: 1, fontSize: '11px', color: '#888', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentPath || '/'}
            </Box>
          </Box>

          {/* File list */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>}
            {error && <Box sx={{ p: 2, color: '#f44', fontSize: '12px' }}>{error}</Box>}
            {!loading && !error && files.map(file => (
              <Box key={file.path}
                onDoubleClick={() => enterFolder(file)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, padding: '4px 12px',
                  borderBottom: '1px solid #222',
                  cursor: file.type === 'folder' ? 'pointer' : 'default',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)', '& .file-actions': { opacity: 1 } }
                }}>
                {file.type === 'folder'
                  ? <FolderIcon sx={{ fontSize: 16, color: '#00aaff' }} />
                  : <FileIcon sx={{ fontSize: 16, color: '#888' }} />}
                <Typography sx={{ flex: 1, fontSize: '12px', color: '#ddd' }}>{file.name}</Typography>
                <Typography sx={{ fontSize: '10px', color: '#666', minWidth: 60, textAlign: 'right' }}>{formatSize(file.size)}</Typography>
                <Box className="file-actions" sx={{ display: 'flex', gap: 0.3, opacity: 0, transition: 'opacity 0.1s' }}>
                  {file.type === 'file' && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); downloadFile(file); }} sx={{ p: 0.3, color: '#888' }} title="Download">
                      <DownloadIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRenameDialog(file); setRenameValue(file.name); }} sx={{ p: 0.3, color: '#888' }} title="Rename">
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteFile(file); }} sx={{ p: 0.3, color: '#f44' }} title="Delete">
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}
            {!loading && !error && files.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center', color: '#555', fontSize: '12px' }}>Empty folder</Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onClose={() => setRenameDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '14px' }}>Rename</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" value={renameValue} onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doRename(); }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={doRename}>Rename</Button>
        </DialogActions>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '14px' }}>New Folder</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" placeholder="Folder name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doMkdir(); }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={doMkdir}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default LocalFileBrowser;
