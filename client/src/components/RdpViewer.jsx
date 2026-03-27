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

      // Mouse input
      const mouse = new Guacamole.Mouse(displayElement);
      mouseRef.current = mouse;
      mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState) => {
        client.sendMouseState(mouseState);
      };

      // Keyboard input - attach to display element to avoid global capture
      const keyboard = new Guacamole.Keyboard(displayElement);
      keyboardRef.current = keyboard;
      keyboard.onkeydown = (keysym) => {
        client.sendKeyEvent(1, keysym);
        return true;
      };
      keyboard.onkeyup = (keysym) => {
        client.sendKeyEvent(0, keysym);
      };
      // Make display focusable for keyboard events
      displayElement.tabIndex = 0;
      displayElement.style.outline = 'none';

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
      <div
        ref={canvasContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: currentMode === 'fit' ? 'center' : 'flex-start',
          justifyContent: currentMode === 'fit' ? 'center' : 'flex-start'
        }}
      />
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
