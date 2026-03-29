import React, { useState, useRef, useCallback } from 'react';

function SftpViewer({ sftpConfig, panelId }) {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const getToken = () => localStorage.getItem('token') || '';

  const apiCall = async (endpoint, body = {}, method = 'POST') => {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
    };
    if (method === 'POST') opts.body = JSON.stringify(body);
    const url = method === 'GET' ? `/api/sftp/${endpoint}?${new URLSearchParams(body)}` : `/api/sftp/${endpoint}`;
    const res = await fetch(url, opts);
    return res.json();
  };

  const connect = async () => {
    if (!sftpConfig) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('connect', sftpConfig);
      if (data.status === 'ok') {
        setSessionId(data.sessionId);
        setFiles(data.files);
        setCurrentPath('/');
        setConnected(true);
      } else {
        setError(data.message);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const navigate = async (dirPath) => {
    setLoading(true);
    try {
      const data = await apiCall('list', { sessionId, path: dirPath });
      if (data.status === 'ok') {
        setFiles(data.files);
        setCurrentPath(dirPath);
        setSelectedFile(null);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigate(parent);
  };

  const handleDelete = async (file) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    await apiCall('delete', { sessionId, path: file.id, isDir: file.type === 'folder' });
    navigate(currentPath);
  };

  const handleMkdir = async () => {
    const name = prompt('New folder name:');
    if (!name) return;
    await apiCall('mkdir', { sessionId, path: `${currentPath === '/' ? '' : currentPath}/${name}` });
    navigate(currentPath);
  };

  const handleRename = async (file) => {
    const newName = prompt('New name:', file.name);
    if (!newName || newName === file.name) return;
    const newPath = `${currentPath === '/' ? '' : currentPath}/${newName}`;
    await apiCall('rename', { sessionId, from: file.id, to: newPath });
    navigate(currentPath);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('path', `${currentPath === '/' ? '' : currentPath}/${file.name}`);
    await fetch('/api/sftp/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    e.target.value = '';
    navigate(currentPath);
  };

  const handleDownload = async (file) => {
    try {
      const res = await fetch(`/api/sftp/download?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.id)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  // Connect on mount if config provided
  React.useEffect(() => {
    if (sftpConfig && !connected) connect();
  }, [sftpConfig, connected]);

  if (error && !connected) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <span>SFTP Error: {error}</span>
          <button onClick={connect} style={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div style={styles.container}>
        <div style={styles.connecting}>
          {loading ? 'Connecting...' : 'Waiting for connection'}
        </div>
      </div>
    );
  }

  const folders = files.filter(f => f.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
  const regularFiles = files.filter(f => f.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...folders, ...regularFiles];

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button onClick={goUp} style={styles.toolBtn} disabled={currentPath === '/'}>⬆</button>
        <div style={styles.pathBar}>{currentPath}</div>
        <button onClick={handleMkdir} style={styles.toolBtn}>📁+</button>
        <button onClick={() => fileInputRef.current?.click()} style={styles.toolBtn}>⬆📄</button>
        <button onClick={() => navigate(currentPath)} style={styles.toolBtn}>🔄</button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      {/* File list */}
      <div style={styles.fileList}>
        {loading && <div style={styles.loading}>Loading...</div>}
        {sorted.map(file => (
          <div
            key={file.id}
            style={{
              ...styles.fileRow,
              backgroundColor: selectedFile?.id === file.id ? 'rgba(0,255,0,0.1)' : 'transparent'
            }}
            onClick={() => setSelectedFile(file)}
            onDoubleClick={() => {
              if (file.type === 'folder') navigate(file.id);
              else handleDownload(file);
            }}
          >
            <span style={styles.fileIcon}>{file.type === 'folder' ? '📁' : '📄'}</span>
            <span style={styles.fileName}>{file.name}</span>
            <span style={styles.fileSize}>{file.type === 'file' ? formatSize(file.size) : ''}</span>
            <div style={styles.fileActions}>
              <button onClick={(e) => { e.stopPropagation(); handleRename(file); }} style={styles.actionBtn}>✏️</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(file); }} style={styles.actionBtn}>🗑️</button>
              {file.type === 'file' && (
                <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} style={styles.actionBtn}>⬇️</button>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && !loading && (
          <div style={styles.empty}>Empty directory</div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

const styles = {
  container: { width: '100%', height: '100%', backgroundColor: '#1a1a2e', display: 'flex', flexDirection: 'column', color: '#ccc', fontSize: '13px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: '#16213e', borderBottom: '1px solid #333' },
  toolBtn: { padding: '4px 8px', backgroundColor: '#0f3460', color: '#ccc', border: '1px solid #333', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
  pathBar: { flex: 1, padding: '4px 8px', backgroundColor: '#0a0a23', borderRadius: '3px', color: '#00ff00', fontFamily: 'monospace', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileList: { flex: 1, overflow: 'auto', padding: '2px 0' },
  fileRow: { display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #1a1a2e', gap: '8px', transition: 'background-color 0.1s' },
  fileIcon: { fontSize: '16px', flexShrink: 0 },
  fileName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize: { color: '#666', fontSize: '11px', width: '70px', textAlign: 'right', flexShrink: 0 },
  fileActions: { display: 'flex', gap: '2px', opacity: 0.5 },
  actionBtn: { padding: '2px 4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' },
  loading: { padding: '20px', textAlign: 'center', color: '#666' },
  empty: { padding: '40px', textAlign: 'center', color: '#555' },
  connecting: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  error: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#ff4444' },
  retryBtn: { padding: '6px 16px', backgroundColor: '#333', color: '#ccc', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }
};

export default SftpViewer;
