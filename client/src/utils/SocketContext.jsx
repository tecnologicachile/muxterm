import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import logger from './logger';

const SocketContext = createContext({});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isReconnected, setIsReconnected] = useState(false);
  // Bumped each time the tab returns to foreground after being backgrounded
  // long enough for a mobile OS to freeze it — used to refresh live terminals.
  const [becameVisible, setBecameVisible] = useState(0);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      const newSocket = io('/', {
        auth: { token },
        // Keep polling as a fallback: on flaky mobile networks a websocket can
        // be slow to re-establish; polling connects fast and upgrades after.
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        // Lower backoff so a return-from-background reconnects quickly.
        reconnectionDelay: 300,
        reconnectionDelayMax: 2000
      });

      newSocket.on('connect', () => {
        logger.debug('Socket connected');
        setConnected(true);
      });

      newSocket.on('reconnect', () => {
        logger.info('Socket reconnected after connection loss');
        setIsReconnected(true);
        // Reset the flag after a short delay to trigger restoration
        setTimeout(() => setIsReconnected(false), 100);
      });

      newSocket.on('disconnect', () => {
        logger.debug('Socket disconnected');
        setConnected(false);
      });

      newSocket.on('error', (error) => {
        logger.error('Socket error:', error);
      });

      // Mobile browsers suspend backgrounded tabs, freezing both socket.io and
      // every ttyd iframe. When the user comes back we don't want to wait for
      // socket.io's own timer (that's the "reconnecting…" / press-Enter delay):
      // force an immediate reconnect and signal terminals to refresh.
      let hiddenAt = 0;
      const handleVisible = () => {
        if (document.visibilityState === 'hidden') {
          hiddenAt = Date.now();
          return;
        }
        // Tab is visible again.
        if (!newSocket.connected) newSocket.connect(); // skip the backoff wait
        const awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        // Only force a terminal refresh if we were away long enough to be frozen.
        if (awayMs > 1500) setBecameVisible((v) => v + 1);
      };
      document.addEventListener('visibilitychange', handleVisible);
      window.addEventListener('focus', handleVisible);
      window.addEventListener('pageshow', handleVisible);

      setSocket(newSocket);

      return () => {
        document.removeEventListener('visibilitychange', handleVisible);
        window.removeEventListener('focus', handleVisible);
        window.removeEventListener('pageshow', handleVisible);
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [token]);

  const value = {
    socket,
    connected,
    isReconnected,
    becameVisible
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};