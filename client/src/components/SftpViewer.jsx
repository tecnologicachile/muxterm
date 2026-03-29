import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Filemanager, WillowDark } from '@svar-ui/react-filemanager';
import '@svar-ui/react-filemanager/all.css';

function SftpViewer({ sftpConfig, panelId }) {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const apiRef = useRef(null);

  const getToken = () => localStorage.getItem('token') || '';

  const apiCall = async (endpoint, body = {}) => {
    const res = await fetch(`/api/sftp/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  const loadDir = useCallback(async (sid, dirPath) => {
    const data = await apiCall('list', { sessionId: sid, path: dirPath });
    if (data.status === 'ok') {
      return data.files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size || 0,
        date: f.date ? new Date(f.date) : new Date(),
        type: f.type,
        parent: dirPath === '/' ? 0 : dirPath
      }));
    }
    return [];
  }, []);

  const connect = async () => {
    if (!sftpConfig) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('connect', sftpConfig);
      if (data.status === 'ok') {
        setSessionId(data.sessionId);
        const rootFiles = data.files.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size || 0,
          date: f.date ? new Date(f.date) : new Date(),
          type: f.type,
          parent: 0
        }));
        setFiles(rootFiles);
        setConnected(true);
      } else {
        setError(data.message);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (sftpConfig && !connected) connect();
  }, [sftpConfig]);

  // Handle SVAR events
  const handleRequestData = useCallback(async (ev) => {
    if (!sessionId) return;
    const dirId = ev.id || '/';
    const newFiles = await loadDir(sessionId, dirId);
    setFiles(prev => {
      // Remove old children of this dir, add new ones
      const filtered = prev.filter(f => f.parent !== dirId && f.parent !== ev.id);
      return [...filtered, ...newFiles];
    });
  }, [sessionId, loadDir]);

  const handleDeleteFile = useCallback(async (ev) => {
    if (!sessionId || !ev.id) return;
    const file = files.find(f => f.id === ev.id);
    await apiCall('delete', { sessionId, path: ev.id, isDir: file?.type === 'folder' });
    setFiles(prev => prev.filter(f => f.id !== ev.id));
  }, [sessionId, files]);

  const handleRenameFile = useCallback(async (ev) => {
    if (!sessionId || !ev.id) return;
    const file = files.find(f => f.id === ev.id);
    if (!file) return;
    const parentPath = file.parent === 0 ? '' : file.parent;
    const newPath = `${parentPath}/${ev.name}`;
    await apiCall('rename', { sessionId, from: ev.id, to: newPath });
    setFiles(prev => prev.map(f => f.id === ev.id ? { ...f, id: newPath, name: ev.name } : f));
  }, [sessionId, files]);

  const handleMakeDir = useCallback(async (ev) => {
    if (!sessionId) return;
    const parentPath = ev.parent === 0 ? '' : ev.parent;
    const newPath = `${parentPath}/${ev.name}`;
    await apiCall('mkdir', { sessionId, path: newPath });
    setFiles(prev => [...prev, { id: newPath, name: ev.name, type: 'folder', size: 0, date: new Date(), parent: ev.parent }]);
  }, [sessionId]);

  const handleUploadFile = useCallback(async (ev) => {
    if (!sessionId || !ev.file) return;
    const parentPath = ev.parent === 0 ? '' : ev.parent;
    const destPath = `${parentPath}/${ev.file.name}`;
    const formData = new FormData();
    formData.append('file', ev.file);
    formData.append('sessionId', sessionId);
    formData.append('path', destPath);
    await fetch('/api/sftp/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    // Reload parent dir
    const newFiles = await loadDir(sessionId, ev.parent === 0 ? '/' : ev.parent);
    setFiles(prev => {
      const parentId = ev.parent === 0 ? '/' : ev.parent;
      const filtered = prev.filter(f => f.parent !== parentId);
      return [...filtered, ...newFiles];
    });
  }, [sessionId, loadDir]);

  const handleDownloadFile = useCallback(async (ev) => {
    if (!sessionId || !ev.id) return;
    try {
      const res = await fetch(`/api/sftp/download?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(ev.id)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.name || ev.id.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
    }
  }, [sessionId]);

  if (error && !connected) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#ff4444' }}>
        <span>SFTP Error: {error}</span>
        <button onClick={connect} style={{ padding: '6px 16px', backgroundColor: '#333', color: '#ccc', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!connected) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        {loading ? 'Connecting...' : 'Waiting for connection'}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <WillowDark>
        <Filemanager
          data={files}
          onRequestData={handleRequestData}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onMakeDir={handleMakeDir}
          onUploadFile={handleUploadFile}
          onDownloadFile={handleDownloadFile}
        />
      </WillowDark>
    </div>
  );
}

export default SftpViewer;
