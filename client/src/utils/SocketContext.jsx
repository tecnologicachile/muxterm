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
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      const newSocket = io('/', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
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

      setSocket(newSocket);

      return () => {
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
    isReconnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};