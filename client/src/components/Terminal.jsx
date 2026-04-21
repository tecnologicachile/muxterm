import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function Terminal({ terminalId, onClose, onTerminalCreated, isActive, panelId, onActivityChange, sshConnectionId }) {
  const iframeRef = useRef(null);
  const { socket, isReconnected } = useSocket();
  const [localTerminalId, setLocalTerminalId] = useState(terminalId);
  const [iframeReady, setIframeReady] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [retryPassword, setRetryPassword] = useState('');
  const [retrying, setRetrying] = useState(false);
  const activityTimeoutRef = useRef(null);
  const terminalCreatedRef = useRef(false);
  const requestIdRef = useRef(null);
  const retryCountRef = useRef(0);

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
    requestIdRef.current = uuidv4();
    const createData = { requestId: requestIdRef.current };
    if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
    socket.emit('create-terminal', createData);
  }, [socket, localTerminalId, terminalId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleTerminalCreated = (data) => {
      if (!localTerminalId) {
        setLocalTerminalId(data.terminalId);
        setIframeReady(true);
        if (onTerminalCreated) onTerminalCreated(data.terminalId);
      }
    };

    const handleTerminalRestored = (data) => {
      if (data.terminalId === (localTerminalId || terminalId)) {
        if (!localTerminalId) setLocalTerminalId(data.terminalId);
        setIframeReady(true);
        // Force iframe reload on every terminal-restored.
        // terminal-restored only fires after a socket reconnect that triggered
        // restore-terminal, so we can safely assume ttyd's WS on the client
        // side is now stale: the previous xterm.js buffer still holds whatever
        // was rendered before the server restarted, and if we leave it alone
        // ttyd re-sends the current tmux snapshot which xterm.js APPENDS
        // without clearing, producing duplicated content on each restart.
        // Reloading the iframe src gives us a fresh xterm.js that attaches to
        // the (new) ttyd process with a clean buffer.
        // The conditional-detection approach we had before (poll for
        // "Reconnect" text at 500ms) missed cases where ttyd hadn't yet shown
        // the overlay, letting the duplication accumulate.
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src;
        }
      }
    };

    const handleTerminalError = (data) => {
      logger.error('Terminal error:', data);
      if (data.message && (data.message.includes('not found') || data.message.includes('No terminal'))) {
        retryCountRef.current++;
        if (sshConnectionId && retryCountRef.current >= 2) {
          // SSH failed multiple times — likely auth failure
          setAuthFailed(true);
          return;
        }
        if (retryCountRef.current <= 3) {
          logger.info('Terminal lost, recreating (attempt ' + retryCountRef.current + ')...');
          setLocalTerminalId(null);
          terminalCreatedRef.current = false;
          requestIdRef.current = uuidv4();
          const createData = { requestId: requestIdRef.current };
          if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
          socket.emit('create-terminal', createData);
        }
      }
    };

    const handleAuthFailed = (data) => {
      if (data.terminalId === localTerminalId) {
        setAuthFailed(true);
        retryCountRef.current = 999; // Stop auto-retry
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

    // Listen on correlated event if we have a requestId, otherwise generic
    const createdEvent = requestIdRef.current ? `terminal-created-${requestIdRef.current}` : 'terminal-created';
    socket.on(createdEvent, handleTerminalCreated);
    socket.on('terminal-restored', handleTerminalRestored);
    socket.on('terminal-error', handleTerminalError);
    socket.on('terminal-activity', handleTerminalActivity);
    socket.on('terminal-auth-failed', handleAuthFailed);

    return () => {
      socket.off(createdEvent, handleTerminalCreated);
      socket.off('terminal-restored', handleTerminalRestored);
      socket.off('terminal-error', handleTerminalError);
      socket.off('terminal-activity', handleTerminalActivity);
      socket.off('terminal-auth-failed', handleAuthFailed);
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

  // Watch container size changes + periodic re-measure on activation/mount.
  // Fixes distorted rendering when xterm.js gets out of sync with actual container size
  // (tab switches, panel activations, resize handle drags, etc.)
  useEffect(() => {
    if (!iframeRef.current) return;
    const dispatchResize = () => {
      try { iframeRef.current?.contentWindow?.dispatchEvent(new Event('resize')); } catch (e) {}
    };
    let debounceTimer = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(dispatchResize, 120);
    };

    // 1) ResizeObserver for actual size changes
    const target = iframeRef.current.parentElement;
    let ro = null;
    if (target && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(target);
    }

    // 2) Staggered dispatch on activate/remount to cover cases where the container
    //    size doesn't change but xterm.js still has a stale column count (tab switch, etc.)
    const timers = [];
    if (isActive && iframeReady) {
      [100, 350, 800, 1500].forEach(delay => {
        timers.push(setTimeout(dispatchResize, delay));
      });
    }

    return () => {
      if (ro) ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      timers.forEach(clearTimeout);
    };
  }, [iframeReady, isActive]);


  const getToken = () => {
    try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
  };

  const tid = localTerminalId || terminalId;
  const token = getToken();
  // Only load iframe after server confirms terminal is ready (iframeReady)
  // For new terminals: iframeReady is set by handleTerminalCreated flow
  // For restored terminals: iframeReady is set by handleTerminalRestored
  const ttydUrl = tid && iframeReady ? `/ttyd/${tid}/?token=${encodeURIComponent(token)}` : null;

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
      {/* Auth failed overlay */}
      {authFailed && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10
        }}>
          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ color: '#f44', fontSize: '14px', marginBottom: '12px' }}>Authentication Failed</div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
              The password was rejected. Enter the correct password to reconnect.
            </div>
            <input
              type="password"
              placeholder="New password"
              value={retryPassword}
              onChange={(e) => setRetryPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && retryPassword && !retrying) {
                  setRetrying(true);
                  requestIdRef.current = uuidv4();
                  socket.emit('retry-ssh-connection', {
                    terminalId: localTerminalId,
                    sshConnectionId,
                    password: retryPassword,
                    requestId: requestIdRef.current
                  });
                  setAuthFailed(false);
                  setRetryPassword('');
                  setRetrying(false);
                  retryCountRef.current = 0;
                  terminalCreatedRef.current = false;
                  setLocalTerminalId(null);
                }
              }}
              style={{
                width: '100%', padding: '8px 12px', backgroundColor: '#222',
                border: '1px solid #444', borderRadius: '4px', color: '#fff',
                fontSize: '13px', marginBottom: '12px', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  if (!retryPassword || retrying) return;
                  setRetrying(true);
                  requestIdRef.current = uuidv4();
                  socket.emit('retry-ssh-connection', {
                    terminalId: localTerminalId,
                    sshConnectionId,
                    password: retryPassword,
                    requestId: requestIdRef.current
                  });
                  setAuthFailed(false);
                  setRetryPassword('');
                  setRetrying(false);
                  retryCountRef.current = 0;
                  terminalCreatedRef.current = false;
                  setLocalTerminalId(null);
                }}
                disabled={!retryPassword || retrying}
                style={{
                  padding: '6px 16px', backgroundColor: '#00ff00', color: '#000',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                }}
              >Reconnect</button>
              <button
                onClick={() => setAuthFailed(false)}
                style={{
                  padding: '6px 16px', backgroundColor: '#333', color: '#888',
                  border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                }}
              >Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(Terminal);
