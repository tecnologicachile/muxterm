import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function RdpViewer({ rdpConnectionId, isActive, panelId, onActivityChange, displayMode = 'fit' }) {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const clientRef = useRef(null);
  const keyboardRef = useRef(null);
  const mouseRef = useRef(null);
  const { socket } = useSocket();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [currentMode, setCurrentMode] = useState(displayMode);
  const tokenRequestedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const mobileInputRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const pinchRef = useRef({ startDist: 0, startZoom: 1, isPinching: false });
  const panRef = useRef({ startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, isPanning: false });

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
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

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        e.preventDefault();
        pinchRef.current.startDist = getTouchDist(e.touches);
        pinchRef.current.startZoom = zoom;
        pinchRef.current.isPinching = true;
      } else if (e.touches.length === 1 && zoom > 1) {
        // Pan start (only when zoomed in)
        panRef.current.startX = e.touches[0].clientX;
        panRef.current.startY = e.touches[0].clientY;
        panRef.current.startOffsetX = panOffset.x;
        panRef.current.startOffsetY = panOffset.y;
        panRef.current.isPanning = true;
      }
    };

    const onTouchMove = (e) => {
      if (pinchRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const scale = dist / pinchRef.current.startDist;
        const newZoom = Math.max(1, Math.min(5, pinchRef.current.startZoom * scale));
        setZoom(newZoom);
        if (newZoom <= 1) setPanOffset({ x: 0, y: 0 });
      } else if (panRef.current.isPanning && e.touches.length === 1 && zoom > 1) {
        const dx = e.touches[0].clientX - panRef.current.startX;
        const dy = e.touches[0].clientY - panRef.current.startY;
        setPanOffset({
          x: panRef.current.startOffsetX + dx,
          y: panRef.current.startOffsetY + dy
        });
      }
    };

    const onTouchEnd = () => {
      pinchRef.current.isPinching = false;
      panRef.current.isPanning = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [zoom, panOffset]);

  // Request RDP token and connect
  useEffect(() => {
    if (!socket || !rdpConnectionId || tokenRequestedRef.current) return;
    tokenRequestedRef.current = true;

    const handleToken = (data) => {
      socket.off('rdp-token-created', handleToken);
      connectRdp(data.token);
    };

    const handleError = (data) => {
      socket.off('rdp-error', handleError);
      setError(data.message);
    };

    socket.on('rdp-token-created', handleToken);
    socket.on('rdp-error', handleError);
    socket.emit('create-rdp-token', { rdpConnectionId });

    return () => {
      socket.off('rdp-token-created', handleToken);
      socket.off('rdp-error', handleError);
      // Disconnect on cleanup to prevent orphaned connections
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch (e) {}
        clientRef.current = null;
      }
      tokenRequestedRef.current = false;
    };
  }, [socket, rdpConnectionId]);

  const connectRdp = (token) => {
    if (!canvasContainerRef.current) return;

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:4823/`;

      const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
      const client = new Guacamole.Client(tunnel);
      clientRef.current = client;

      // Append display canvas - constrain within container
      const displayElement = client.getDisplay().getElement();
      displayElement.style.cursor = 'default';
      displayElement.style.position = 'relative';
      displayElement.style.overflow = 'hidden';
      displayElement.style.maxWidth = '100%';
      displayElement.style.maxHeight = '100%';
      canvasContainerRef.current.innerHTML = '';
      canvasContainerRef.current.appendChild(displayElement);

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

      // Touch input for mobile
      const touch = new Guacamole.Mouse.Touchscreen(displayElement);
      touch.onmousedown = touch.onmouseup = touch.onmousemove = sendMouse;

      // Open virtual keyboard on touch
      displayElement.addEventListener('touchstart', () => {
        if (mobileInputRef.current) mobileInputRef.current.focus();
      }, { passive: true });

      // Keyboard input - use document, only send when panel is active
      const keyboard = new Guacamole.Keyboard(document);
      keyboardRef.current = keyboard;
      keyboard.onkeydown = (keysym) => {
        if (!isActiveRef.current) return false;
        client.sendKeyEvent(1, keysym);
        return true;
      };
      keyboard.onkeyup = (keysym) => {
        if (!isActiveRef.current) return;
        client.sendKeyEvent(0, keysym);
      };

      // State changes
      const stateNames = { 0: 'IDLE', 1: 'CONNECTING', 2: 'WAITING', 3: 'CONNECTED', 4: 'DISCONNECTING', 5: 'DISCONNECTED' };
      client.onstatechange = (state) => {
        console.log('[RDP] State:', stateNames[state] || state);
        if (state === 3) { // CONNECTED
          setConnected(true);
          setError(null);
          if (onActivityChange) onActivityChange(panelId, true);
          setTimeout(() => {
            if (clientRef.current && canvasContainerRef.current) rescale();
          }, 500);
        } else if (state === 5) { // DISCONNECTED
          setConnected(false);
          if (onActivityChange) onActivityChange(panelId, false);
        }
      };

      client.onerror = (status) => {
        console.error('[RDP] Client error:', status);
        setError(`Connection error: ${status.message || status.code || 'Unknown error'}`);
      };

      tunnel.onerror = (status) => {
        console.error('[RDP] Tunnel error:', status);
        setError(`Tunnel error: ${status.message || status.code || 'Unknown error'}`);
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

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000', color: '#ff4444', fontSize: '14px',
        flexDirection: 'column', gap: '8px'
      }}>
        <span>RDP Error</span>
        <span style={{ color: '#888', fontSize: '12px' }}>{error}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: currentMode === 'native' ? 'auto' : 'hidden',
        position: 'relative'
      }}
    >
      {/* Canvas container - React does NOT manage children of this div */}
      <textarea
        ref={mobileInputRef}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '1px',
          height: '1px',
          top: '50%',
          left: '50%',
          zIndex: -1
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
          alignItems: currentMode === 'fit' ? 'center' : 'flex-start',
          justifyContent: currentMode === 'fit' ? 'center' : 'flex-start',
          transformOrigin: 'center center',
          transform: zoom > 1 ? `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)` : 'none'
        }}
      />
      {/* Zoom reset button - only visible when zoomed */}
      {zoom > 1 && (
        <div
          onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
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
      {!connected && !error && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#888', fontSize: '14px', pointerEvents: 'none'
        }}>
          Connecting to RDP...
        </div>
      )}
    </div>
  );
}

export default RdpViewer;
