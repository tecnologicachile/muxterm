import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function Terminal({ terminalId, onClose, onTerminalCreated, isActive, panelId, onActivityChange, sshConnectionId }) {
  const iframeRef = useRef(null);
  const { socket, isReconnected } = useSocket();
  const [localTerminalId, setLocalTerminalId] = useState(terminalId);
  const [iframeReady, setIframeReady] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const activityTimeoutRef = useRef(null);
  const terminalCreatedRef = useRef(false);

  // Cleanup activity timeout on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  // Request terminal creation if new
  useEffect(() => {
    if (!socket) return;
    if (localTerminalId || terminalId || terminalCreatedRef.current) return;

    terminalCreatedRef.current = true;
    const createData = {};
    if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
    socket.emit('create-terminal', createData);
  }, [socket, localTerminalId, terminalId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleTerminalCreated = (data) => {
      if (!localTerminalId) {
        setLocalTerminalId(data.terminalId);
        if (onTerminalCreated) onTerminalCreated(data.terminalId);
      }
    };

    const handleTerminalRestored = (data) => {
      if (data.terminalId === (localTerminalId || terminalId)) {
        if (!localTerminalId) setLocalTerminalId(data.terminalId);
        setIframeReady(true);
      }
    };

    const handleTerminalError = (data) => {
      logger.error('Terminal error:', data);
      // If terminal not found, recreate it
      if (data.message && (data.message.includes('not found') || data.message.includes('No terminal'))) {
        logger.info('Terminal lost, recreating...');
        setLocalTerminalId(null);
        terminalCreatedRef.current = false;
        const createData = {};
        if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
        socket.emit('create-terminal', createData);
      }
    };

    const handleTerminalActivity = (data) => {
      if (data.terminalId === localTerminalId) {
        setHasActivity(true);
        if (onActivityChange) onActivityChange(panelId, true);
        if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = setTimeout(() => {
          setHasActivity(false);
          if (onActivityChange) onActivityChange(panelId, false);
        }, 2000);
      }
    };

    socket.on('terminal-created', handleTerminalCreated);
    socket.on('terminal-restored', handleTerminalRestored);
    socket.on('terminal-error', handleTerminalError);
    socket.on('terminal-activity', handleTerminalActivity);

    return () => {
      socket.off('terminal-created', handleTerminalCreated);
      socket.off('terminal-restored', handleTerminalRestored);
      socket.off('terminal-error', handleTerminalError);
      socket.off('terminal-activity', handleTerminalActivity);
    };
  }, [socket, localTerminalId, terminalId, onTerminalCreated, panelId, onActivityChange]);

  // Restore terminal if we have an existing ID
  useEffect(() => {
    if (!socket || !localTerminalId && !terminalId) return;
    const tid = localTerminalId || terminalId;
    socket.emit('restore-terminal', { terminalId: tid, sshConnectionId });
  }, [socket, localTerminalId, terminalId]);

  // Handle reconnection
  useEffect(() => {
    if (isReconnected && localTerminalId && socket) {
      socket.emit('restore-terminal', { terminalId: localTerminalId, sshConnectionId });
    }
  }, [isReconnected, localTerminalId, socket]);


  const getToken = () => {
    try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
  };

  const tid = localTerminalId || terminalId;
  const token = getToken();
  const ttydUrl = tid ? `/ttyd/${tid}/?token=${encodeURIComponent(token)}` : null;

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '50px',
          minWidth: '100px'
        }}
      >
        {ttydUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={ttydUrl}
              onLoad={() => {
                try {
                  const doc = iframeRef.current?.contentDocument;
                  if (doc) {
                    // Hide xterm.js scrollbar and pre-connection messages
                    const style = doc.createElement('style');
                    style.textContent = '.xterm-viewport::-webkit-scrollbar { display: none !important; } .xterm-viewport { scrollbar-width: none !important; overflow: hidden !important; } body { background: #000 !important; } body > :not(#terminal-container):not(.xterm) { display: none !important; }';
                    doc.head.appendChild(style);
                    // Propagate clicks to parent for panel selection
                    doc.addEventListener('mousedown', () => {
                      const container = iframeRef.current?.closest('[data-panel-id]');
                      if (container) container.click();
                    });
                  }
                } catch(e) {}
              }}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#000'
              }}
              allow="clipboard-read; clipboard-write"
              title={`Terminal ${panelId}`}
            />
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#555',
            fontSize: '14px'
          }}>
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(Terminal);
