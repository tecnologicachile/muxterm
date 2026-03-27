import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function RdpViewer({ rdpConnectionId, isActive, panelId, onActivityChange, displayMode = 'fit' }) {
  const displayRef = useRef(null);
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
    };
  }, [socket, rdpConnectionId]);

  const connectRdp = (token) => {
    if (!displayRef.current) return;

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/guacamole/`;

      const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
      const client = new Guacamole.Client(tunnel);
      clientRef.current = client;

      // Append display canvas
      const displayElement = client.getDisplay().getElement();
      displayElement.style.cursor = 'default';
      displayRef.current.innerHTML = '';
      displayRef.current.appendChild(displayElement);

      // Mouse input
      const mouse = new Guacamole.Mouse(displayElement);
      mouseRef.current = mouse;
      mouse.onEach(['mousedown', 'mouseup', 'mousemove'], (e) => {
        client.sendMouseState(e.state);
      });

      // Keyboard input (only when panel is active)
      const keyboard = new Guacamole.Keyboard(document);
      keyboardRef.current = keyboard;
      keyboard.onkeydown = (keysym) => {
        if (!isActive) return false;
        client.sendKeyEvent(1, keysym);
        return true;
      };
      keyboard.onkeyup = (keysym) => {
        if (!isActive) return;
        client.sendKeyEvent(0, keysym);
      };

      // State changes
      client.onstatechange = (state) => {
        if (state === 3) { // CONNECTED
          setConnected(true);
          setError(null);
          if (onActivityChange) onActivityChange(panelId, true);
          setTimeout(() => rescale(), 500);
        } else if (state === 5) { // DISCONNECTED
          setConnected(false);
          if (onActivityChange) onActivityChange(panelId, false);
        }
      };

      client.onerror = (status) => {
        logger.error('Guacamole client error:', status);
        setError(`Connection error: ${status.message || 'Unknown error'}`);
      };

      // Connect with token and container dimensions
      const container = displayRef.current;
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
    if (!client || !displayRef.current) return;

    const display = client.getDisplay();
    const container = displayRef.current;
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
    if (!displayRef.current) return;
    const observer = new ResizeObserver(() => rescale());
    observer.observe(displayRef.current);
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
      ref={displayRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: currentMode === 'native' ? 'auto' : 'hidden',
        display: 'flex',
        alignItems: currentMode === 'fit' ? 'center' : 'flex-start',
        justifyContent: currentMode === 'fit' ? 'center' : 'flex-start',
        position: 'relative'
      }}
    >
      {!connected && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#888', fontSize: '14px'
        }}>
          Connecting to RDP...
        </div>
      )}
    </div>
  );
}

export default RdpViewer;
