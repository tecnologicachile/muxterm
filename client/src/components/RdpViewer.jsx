import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function RdpViewer({ rdpConnectionId, vncConnectionId, connectionType = 'rdp', isActive, panelId, onActivityChange, displayMode = 'fit' }) {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const clientRef = useRef(null);
  const keyboardRef = useRef(null);
  const mouseRef = useRef(null);
  const { socket } = useSocket();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [clipboardText, setClipboardText] = useState('');
  const clipboardOpenRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const toolbarTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [currentMode, setCurrentMode] = useState(displayMode);
  const tokenRequestedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const retryTimerRef = useRef(null);
  const [reconnecting, setReconnecting] = useState(false);
  const mobileInputRef = useRef(null);
  const keyboardSinkRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchRef = useRef({ startDist: 0, startZoom: 1, isPinching: false });
  const baseScaleRef = useRef(1);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { clipboardOpenRef.current = clipboardOpen; }, [clipboardOpen]);

  const uploadFile = (file) => {
    if (!clientRef.current || !file) return;
    const stream = clientRef.current.createFileStream(file.type || 'application/octet-stream', file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      const bytes = new Uint8Array(buffer);
      const CHUNK = 4096;
      let offset = 0;
      const sendChunk = () => {
        if (offset >= bytes.length) {
          stream.sendEnd();
          return;
        }
        const chunk = bytes.slice(offset, offset + CHUNK);
        const base64 = btoa(String.fromCharCode(...chunk));
        stream.sendBlob(base64);
        offset += CHUNK;
      };
      // Attach onack BEFORE first sendChunk to avoid losing acknowledgment
      stream.onack = (status) => {
        if (status.code !== 0) return;
        sendChunk();
      };
      sendChunk();
    };
    reader.readAsArrayBuffer(file);
  };
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Pinch-to-zoom and pan gesture handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchDist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    let twoFingerStartCenter = null;

    const getTouchCenter = (touches) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    });

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchRef.current.startDist = getTouchDist(e.touches);
        pinchRef.current.startZoom = zoom;
        pinchRef.current.isPinching = true;
        twoFingerStartCenter = getTouchCenter(e.touches);
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const distChange = Math.abs(dist - pinchRef.current.startDist);

        // Only handle as pinch if fingers are actually separating/joining
        if (distChange > 20) {
          e.preventDefault();
          const scale = dist / pinchRef.current.startDist;
          const newZoom = Math.max(1, Math.min(5, pinchRef.current.startZoom * scale));
          setZoom(newZoom);
          if (clientRef.current) {
            const display = clientRef.current.getDisplay();
            const baseScale = baseScaleRef.current || 1;
            display.scale(baseScale * newZoom);
          }
        }
        // If fingers move together (no pinch), let native scroll handle it
      }
    };

    const onTouchEnd = () => {
      pinchRef.current.isPinching = false;
      twoFingerStartCenter = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [zoom]);

  // Request connection token and connect
  useEffect(() => {
    const connId = connectionType === 'vnc' ? vncConnectionId : rdpConnectionId;
    if (!socket || !connId || tokenRequestedRef.current) return;
    tokenRequestedRef.current = true;

    const requestId = panelId || connId;
    const tokenEvent = connectionType === 'vnc' ? `vnc-token-created-${requestId}` : `rdp-token-created-${requestId}`;
    const errorEvent = connectionType === 'vnc' ? `vnc-error-${requestId}` : `rdp-error-${requestId}`;
    const emitEvent = connectionType === 'vnc' ? 'create-vnc-token' : 'create-rdp-token';
    const keyboardLayout = navigator.language || navigator.userLanguage || 'en-US';
    const emitData = connectionType === 'vnc'
      ? { vncConnectionId: connId, requestId }
      : { rdpConnectionId: connId, keyboardLayout, requestId };

    const handleToken = (data) => {
      socket.off(tokenEvent, handleToken);
      connectRdp(data.token);
    };

    const handleError = (data) => {
      socket.off(errorEvent, handleError);
      setError(data.message);
    };

    socket.on(tokenEvent, handleToken);
    socket.on(errorEvent, handleError);
    socket.emit(emitEvent, emitData);

    return () => {
      socket.off(tokenEvent, handleToken);
      socket.off(errorEvent, handleError);
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch (e) {}
        clientRef.current = null;
      }
      tokenRequestedRef.current = false;
    };
  }, [socket, rdpConnectionId, vncConnectionId, connectionType]);

  const reconnect = () => {
    setError(null);
    setConnected(false);
    tokenRequestedRef.current = false;
    if (clientRef.current) {
      try { clientRef.current.disconnect(); } catch (e) {}
      clientRef.current = null;
    }
    const connId = connectionType === 'vnc' ? vncConnectionId : rdpConnectionId;
    const requestId = panelId || connId;
    const tokenEvent = connectionType === 'vnc' ? `vnc-token-created-${requestId}` : `rdp-token-created-${requestId}`;
    const emitEvent = connectionType === 'vnc' ? 'create-vnc-token' : 'create-rdp-token';
    const keyboardLayout = navigator.language || navigator.userLanguage || 'en-US';
    const emitData = connectionType === 'vnc'
      ? { vncConnectionId: connId, requestId }
      : { rdpConnectionId: connId, keyboardLayout, requestId };
    const handleToken = (data) => {
      socket.off(tokenEvent, handleToken);
      connectRdp(data.token);
    };
    socket.on(tokenEvent, handleToken);
    socket.emit(emitEvent, emitData);
  };

  const reconnectAttemptsRef = useRef(0);

  const handleConnectionError = (msg) => {
    // Prevent infinite loop — max 5 consecutive reconnect cycles
    reconnectAttemptsRef.current++;
    if (reconnectAttemptsRef.current > 5) {
      setReconnecting(false);
      setError(msg);
      reconnectAttemptsRef.current = 0;
      return;
    }

    setReconnecting(true);
    setError(null);
    if (clientRef.current) {
      try { clientRef.current.disconnect(); } catch (e) {}
      clientRef.current = null;
    }
    // Poll guacd health until ready, then reconnect with delay
    const pollHealth = () => {
      fetch('/api/guacd-health').then(r => r.json()).then(data => {
        if (data.status === 'ok') {
          // Wait 5 seconds after guacd is ready before reconnecting
          retryTimerRef.current = setTimeout(() => {
            setReconnecting(false);
            reconnect();
          }, 5000);
        } else {
          retryTimerRef.current = setTimeout(pollHealth, 3000);
        }
      }).catch(() => {
        retryTimerRef.current = setTimeout(pollHealth, 3000);
      });
    };
    retryTimerRef.current = setTimeout(pollHealth, 2000);
  };

  // Cleanup retry timer
  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  const connectRdp = (token) => {
    if (!canvasContainerRef.current) return;

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:4823/`;

      const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
      const client = new Guacamole.Client(tunnel);
      clientRef.current = client;

      // Expose client on DOM for special keys toolbar
      const panelElement = canvasContainerRef.current.closest('[data-panel-id]');
      if (panelElement) panelElement.__guacClient = client;

      // Append display canvas - constrain within container
      const displayElement = client.getDisplay().getElement();
      displayElement.style.cursor = 'default';
      canvasContainerRef.current.innerHTML = '';
      canvasContainerRef.current.appendChild(displayElement);

      // Click on canvas focuses keyboard sink and closes toolbar
      displayElement.addEventListener('mousedown', () => {
        if (keyboardSinkRef.current && !clipboardOpenRef.current) {
          keyboardSinkRef.current.focus();
        }
        setToolbarOpen(false);
      });

      // Mouse input - adjust coordinates for display scale (use copy to avoid mutation)
      const mouse = new Guacamole.Mouse(displayElement);
      mouseRef.current = mouse;
      const sendMouse = (mouseState) => {
        const scale = client.getDisplay().getScale();
        if (scale && scale !== 1) {
          const adjusted = new Guacamole.Mouse.State(
            mouseState.x / scale,
            mouseState.y / scale,
            mouseState.left,
            mouseState.middle,
            mouseState.right,
            mouseState.up,
            mouseState.down
          );
          client.sendMouseState(adjusted);
        } else {
          client.sendMouseState(mouseState);
        }
      };
      mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = sendMouse;

      // Touch input for mobile - relative/trackpad mode
      // Drag = move cursor by same distance as finger (1:1)
      // Tap = click at current cursor position
      let touchStartTime = 0;
      let touchStartPos = { x: 0, y: 0 };
      let lastScreenPos = { x: 0, y: 0 };
      let cursorPos = { x: 0, y: 0 };
      const TAP_THRESHOLD = 200;
      const LONG_PRESS_THRESHOLD = 700;
      const MOVE_THRESHOLD = 10;
      let hasMoved = false;
      let cursorInitialized = false;
      let longPressTimer = null;

      displayElement.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        touchStartTime = Date.now();
        touchStartPos = { x: t.clientX, y: t.clientY };
        lastScreenPos = { x: t.clientX, y: t.clientY };
        hasMoved = false;
        if (!cursorInitialized) {
          const display = client.getDisplay();
          cursorPos = { x: display.getWidth() / 2, y: display.getHeight() / 2 };
          cursorInitialized = true;
        }
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (!hasMoved) {
            if (navigator.vibrate) navigator.vibrate(50);
            client.sendMouseState(new Guacamole.Mouse.State(
              cursorPos.x, cursorPos.y, false, false, true, false, false
            ));
            setTimeout(() => {
              client.sendMouseState(new Guacamole.Mouse.State(
                cursorPos.x, cursorPos.y, false, false, false, false, false
              ));
            }, 50);
            longPressTimer = null;
          }
        }, LONG_PRESS_THRESHOLD);
      }, { passive: true });

      displayElement.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        const display = client.getDisplay();

        const dx = t.clientX - lastScreenPos.x;
        const dy = t.clientY - lastScreenPos.y;
        lastScreenPos = { x: t.clientX, y: t.clientY };

        const totalDx = t.clientX - touchStartPos.x;
        const totalDy = t.clientY - touchStartPos.y;
        if (Math.abs(totalDx) > MOVE_THRESHOLD || Math.abs(totalDy) > MOVE_THRESHOLD) {
          hasMoved = true;
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        }

        cursorPos.x = Math.max(0, Math.min(display.getWidth(), cursorPos.x + dx));
        cursorPos.y = Math.max(0, Math.min(display.getHeight(), cursorPos.y + dy));

        client.sendMouseState(new Guacamole.Mouse.State(
          cursorPos.x, cursorPos.y, false, false, false, false, false
        ));
      }, { passive: false });

      displayElement.addEventListener('touchend', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        const elapsed = Date.now() - touchStartTime;
        if (elapsed < TAP_THRESHOLD && !hasMoved) {
          client.sendMouseState(new Guacamole.Mouse.State(
            cursorPos.x, cursorPos.y, true, false, false, false, false
          ));
          setTimeout(() => {
            client.sendMouseState(new Guacamole.Mouse.State(
              cursorPos.x, cursorPos.y, false, false, false, false, false
            ));
          }, 50);
        }
      }, { passive: true });

      // Keyboard input - sink div for PC, also listen on mobile textarea
      if (keyboardSinkRef.current) {
        keyboardSinkRef.current.tabIndex = 0;
        keyboardSinkRef.current.style.outline = 'none';
        keyboardSinkRef.current.focus();
        const keyboard = new Guacamole.Keyboard(keyboardSinkRef.current);
        keyboardRef.current = keyboard;
        // Also listen on mobile textarea for virtual keyboard
        if (mobileInputRef.current) {
          keyboard.listenTo(mobileInputRef.current);
        }
        keyboard.onkeydown = (keysym) => {
          if (!isActiveRef.current || clipboardOpenRef.current) return false;
          client.sendKeyEvent(1, keysym);
          return true;
        };
        keyboard.onkeyup = (keysym) => {
          if (!isActiveRef.current || clipboardOpenRef.current) return;
          client.sendKeyEvent(0, keysym);
        };
      }


      // Clipboard: remote → local
      client.onclipboard = (stream, mimetype) => {
        if (mimetype === 'text/plain') {
          let clipData = '';
          const reader = new Guacamole.StringReader(stream);
          reader.ontext = (text) => { clipData += text; };
          reader.onend = () => {
            if (clipData && navigator.clipboard) {
              navigator.clipboard.writeText(clipData).catch(() => {});
            }
          };
        }
      };

      // File download from remote
      client.onfile = (stream, mimetype, filename) => {
        const reader = new Guacamole.BlobReader(stream, mimetype);
        reader.onend = () => {
          const blob = reader.getBlob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        };
        stream.sendAck('OK', 0x0000);
      };

      // State changes
      client.onstatechange = (state) => {

        if (state === 3) { // CONNECTED
          setConnected(true);
          setError(null);
          setReconnecting(false);
          reconnectAttemptsRef.current = 0;
          if (onActivityChange) onActivityChange(panelId, true);
          setTimeout(() => {
            if (clientRef.current && canvasContainerRef.current) {
              const display = clientRef.current.getDisplay();
              const container = canvasContainerRef.current;
              if (display.getWidth() && container.offsetWidth) {
                const fitScale = Math.min(
                  container.offsetWidth / display.getWidth(),
                  container.offsetHeight / display.getHeight()
                );
                baseScaleRef.current = fitScale;
                display.scale(fitScale);
              }
            }
          }, 500);
        } else if (state === 5) { // DISCONNECTED
          const wasConnected = connected;
          setConnected(false);
          if (onActivityChange) onActivityChange(panelId, false);
          // If was previously connected, show disconnect message (not reconnect loop)
          if (wasConnected) {
            setError('Connection lost. The remote session was disconnected.');
          }
        }
      };

      client.onerror = (status) => {
        console.error('[REMOTE] Client error:', status);
        const code = status.code || 0;
        const msg = `Connection error: ${status.message || code || 'Unknown error'}`;
        // Code 519 = upstream not found (guacd issue), others = RDP server issue
        if (code === 519 || code === 514 || code === 512) {
          handleConnectionError(msg);
        } else {
          setError(msg);
        }
      };

      tunnel.onerror = (status) => {
        console.error('[REMOTE] Tunnel error:', status);
        const code = status.code || 0;
        const msg = `Tunnel error: ${status.message || code || 'Unknown error'}`;
        // Tunnel errors are always guacd related
        handleConnectionError(msg);
      };

      // Connect with token and container dimensions
      const container = canvasContainerRef.current;
      const width = container.offsetWidth || 1024;
      const height = container.offsetHeight || 768;
      const connectString = `token=${encodeURIComponent(token)}&GUAC_WIDTH=${width}&GUAC_HEIGHT=${height}&GUAC_DPI=96`;
      client.connect(connectString);

    } catch (err) {
      logger.error('Failed to connect RDP:', err);
      setError(err.message);
    }
  };

  // Rescale display based on current mode
  const rescale = () => {
    const client = clientRef.current;
    if (!client || !canvasContainerRef.current) return;

    const display = client.getDisplay();
    const container = canvasContainerRef.current;
    const displayWidth = display.getWidth();
    const displayHeight = display.getHeight();

    if (!displayWidth || !displayHeight) return;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const element = display.getElement();

    if (currentMode === 'fit') {
      const scale = Math.min(containerWidth / displayWidth, containerHeight / displayHeight);
      display.scale(scale);
      element.style.margin = 'auto';
    } else if (currentMode === 'stretch') {
      const scaleX = containerWidth / displayWidth;
      const scaleY = containerHeight / displayHeight;
      display.scale(1);
      element.style.transformOrigin = '0 0';
      element.style.transform = `scale(${scaleX}, ${scaleY})`;
    } else { // native
      display.scale(1);
      element.style.transform = 'none';
    }
  };

  // Update mode and rescale
  useEffect(() => {
    setCurrentMode(displayMode);
  }, [displayMode]);

  useEffect(() => {
    rescale();
  }, [currentMode]);

  // Handle container resize
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const observer = new ResizeObserver(() => rescale());
    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [currentMode]);

  // Set viewport to overlay mode when RDP/VNC panel is active
  useEffect(function() {
    if (!isActive) return;
    // Change viewport to overlays-content for RDP/VNC
    var meta = document.querySelector('meta[name=viewport]');
    var original = meta ? meta.getAttribute('content') : '';
    if (meta) {
      meta.setAttribute('content', original.replace('resizes-content', 'overlays-content'));
    }
    if ('virtualKeyboard' in navigator) {
      navigator.virtualKeyboard.overlaysContent = true;
    }
    function onScroll() { window.scrollTo(0, 0); }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('scroll', onScroll);
    }
    return function() {
      // Restore to resizes-content when leaving RDP/VNC
      if (meta) meta.setAttribute('content', original.replace('overlays-content', 'resizes-content'));
      if ('virtualKeyboard' in navigator) navigator.virtualKeyboard.overlaysContent = false;
      if (window.visualViewport) window.visualViewport.removeEventListener('scroll', onScroll);
    };
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (keyboardRef.current) {
        keyboardRef.current.onkeydown = null;
        keyboardRef.current.onkeyup = null;
      }
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  if (reconnecting) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000', color: '#ffaa00', fontSize: '14px',
        flexDirection: 'column', gap: '12px'
      }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #333', borderTop: '3px solid #ffaa00', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span>Waiting for remote desktop service...</span>
        <span style={{ color: '#666', fontSize: '11px' }}>Will reconnect automatically when ready</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000', color: '#ff4444', fontSize: '14px',
        flexDirection: 'column', gap: '8px'
      }}>
        <span>{connectionType === 'vnc' ? 'VNC' : 'RDP'} Error</span>
        <span style={{ color: '#888', fontSize: '12px' }}>{error}</span>
        <button onClick={() => { setError(null); reconnect(); }} style={{
          marginTop: '8px', padding: '6px 16px', backgroundColor: '#333',
          color: '#ccc', border: '1px solid #555', borderRadius: '4px',
          cursor: 'pointer', fontSize: '12px'
        }}>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onDragOver={connectionType === 'rdp' ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={connectionType === 'rdp' ? () => setDragOver(false) : undefined}
      onDrop={connectionType === 'rdp' ? (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer?.files;
        if (files) {
          for (let i = 0; i < files.length; i++) uploadFile(files[i]);
        }
      } : undefined}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: zoom > 1 ? 'auto' : 'hidden',
        position: 'relative',
        border: dragOver ? '2px dashed #00ff00' : 'none'
      }}
    >
      {/* Keyboard sink - receives keyboard focus for remote desktop input */}
      <div ref={keyboardSinkRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
      {/* Canvas container - React does NOT manage children of this div */}
      <textarea
        ref={mobileInputRef}
        style={{
          position: 'fixed',
          opacity: 0,
          width: '1px',
          height: '1px',
          bottom: '50%',
          left: '50%',
          zIndex: -1,
          pointerEvents: 'none',
          fontSize: '16px'
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      <div
        ref={canvasContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: zoom > 1 ? 'flex-start' : 'center',
          justifyContent: zoom > 1 ? 'flex-start' : 'center'
        }}
      />
      {/* Zoom reset button */}
      {zoom > 1 && (
        <div
          onClick={() => setZoom(1)}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff00',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            zIndex: 10,
            userSelect: 'none'
          }}
        >
          {Math.round(zoom * 100)}% ✕
        </div>
      )}
      {/* Mobile keyboard toggle button */}

      {/* Toolbar tab - right edge, like sidebar pattern */}
      {connected && !toolbarOpen && (
        <div
          onMouseEnter={() => { clearTimeout(toolbarTimeoutRef.current); setToolbarOpen(true); }}
          onClick={() => setToolbarOpen(true)}
          style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            transform: 'translateY(-50%)',
            width: '14px',
            height: '48px',
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            borderRadius: '6px 0 0 6px',
            border: '1px solid #333',
            borderRight: 'none',
            zIndex: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '3px', height: '20px', backgroundColor: '#555', borderRadius: '2px' }} />
        </div>
      )}
      {connected && toolbarOpen && (
        <div
          onMouseEnter={() => clearTimeout(toolbarTimeoutRef.current)}
          onMouseLeave={() => { toolbarTimeoutRef.current = setTimeout(() => { if (!clipboardOpen) setToolbarOpen(false); }, 400); }}
          style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #333',
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '8px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 10,
            animation: 'slideInRight 0.15s ease-out'
          }}
        >
          <style>{`@keyframes slideInRight { from { opacity:0; transform: translateY(-50%) translateX(10px); } to { opacity:1; transform: translateY(-50%) translateX(0); }}`}</style>
          <div onClick={() => { if (!clipboardOpen) setClipboardText(''); setClipboardOpen(!clipboardOpen); }}
            title="Clipboard"
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', cursor: 'pointer', backgroundColor: clipboardOpen ? 'rgba(0,255,0,0.15)' : 'transparent', border: '1px solid #333', fontSize: '14px', transition: 'all 0.1s' }}>
            📋
          </div>
          {connectionType === 'rdp' && (
            <div onClick={() => fileInputRef.current?.click()}
              title="Upload file"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #333', fontSize: '14px', transition: 'all 0.1s' }}>
              📁
            </div>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => {
        const files = e.target.files;
        if (files) { for (let i = 0; i < files.length; i++) uploadFile(files[i]); }
        e.target.value = '';
      }} />
      {/* Clipboard textarea */}
      {clipboardOpen && (
        <div style={{
          position: 'absolute',
          top: 36,
          right: 8,
          width: '280px',
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '10px',
          zIndex: 20
        }}>
          <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '6px', lineHeight: '1.4' }}>
            Paste your text below, then click <b style={{ color: '#00aa00' }}>Send</b>
          </div>
          <textarea
            value={clipboardText}
            onChange={(e) => setClipboardText(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text/plain');

              if (text && clientRef.current) {
                setClipboardText(text);
                try {
                  const stream = clientRef.current.createClipboardStream('text/plain');
                  const writer = new Guacamole.StringWriter(stream);
                  writer.sendText(text);
                  writer.sendEnd();
                  // Auto Ctrl+V in remote
                  setTimeout(() => {
                    clientRef.current.sendKeyEvent(1, 0xFFE3);
                    clientRef.current.sendKeyEvent(1, 0x76);
                    clientRef.current.sendKeyEvent(0, 0x76);
                    clientRef.current.sendKeyEvent(0, 0xFFE3);
                  }, 200);
                } catch (err) {}
                setTimeout(() => {
                  setClipboardOpen(false);
                  if (keyboardSinkRef.current) keyboardSinkRef.current.focus();
                }, 500);
              }
              e.preventDefault();
            }}
            placeholder="Ctrl+V here..."
            style={{
              width: '100%',
              height: '60px',
              backgroundColor: '#111',
              color: '#ccc',
              border: '1px solid #333',
              borderRadius: '4px',
              padding: '6px',
              fontSize: '12px',
              resize: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <button
              onClick={() => {

                if (clipboardText && clientRef.current) {
                  try {
                    const stream = clientRef.current.createClipboardStream('text/plain');
                    const writer = new Guacamole.StringWriter(stream);
                    writer.sendText(clipboardText);
                    writer.sendEnd();
                    // Auto Ctrl+V in remote after clipboard synced
                    setTimeout(() => {
                      clientRef.current.sendKeyEvent(1, 0xFFE3); // Ctrl down
                      clientRef.current.sendKeyEvent(1, 0x76);   // v down
                      clientRef.current.sendKeyEvent(0, 0x76);   // v up
                      clientRef.current.sendKeyEvent(0, 0xFFE3); // Ctrl up
                    }, 200);
                  } catch (err) {}
                  setClipboardOpen(false);
                  if (keyboardSinkRef.current) keyboardSinkRef.current.focus();
                }
              }}
              style={{
                flex: 1, padding: '4px', backgroundColor: '#00aa00', color: '#fff',
                border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px'
              }}
            >
              Send
            </button>
            <button
              onClick={() => { setClipboardOpen(false); if (keyboardSinkRef.current) keyboardSinkRef.current.focus(); }}
              style={{
                padding: '4px 8px', backgroundColor: '#333', color: '#ccc',
                border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Drag overlay - RDP only */}
      {dragOver && connectionType === 'rdp' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ff00', fontSize: '16px', fontWeight: 'bold',
          pointerEvents: 'none', zIndex: 15
        }}>
          Drop files to upload
        </div>
      )}
      {!connected && !error && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#888', fontSize: '14px', pointerEvents: 'none'
        }}>
          Connecting to {connectionType === 'vnc' ? 'VNC' : 'RDP'}...
        </div>
      )}
    </div>
  );
}

export default RdpViewer;
