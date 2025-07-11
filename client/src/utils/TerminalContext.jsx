import React, { createContext, useContext, useRef } from 'react';
import logger from './logger';

const TerminalContext = createContext();

export function TerminalProvider({ children }) {
  // Store terminal instances by panel ID
  const terminalsRef = useRef({});
  
  const getTerminal = (panelId) => {
    return terminalsRef.current[panelId];
  };
  
  const setTerminal = (panelId, terminal) => {
    logger.debug(`[TerminalContext] Storing terminal for panel ${panelId}`);
    terminalsRef.current[panelId] = terminal;
  };
  
  const removeTerminal = (panelId) => {
    logger.debug(`[TerminalContext] Removing terminal for panel ${panelId}`);
    const terminal = terminalsRef.current[panelId];
    if (terminal) {
      terminal.dispose();
      delete terminalsRef.current[panelId];
    }
  };
  
  const value = {
    getTerminal,
    setTerminal,
    removeTerminal
  };
  
  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminalContext() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminalContext must be used within TerminalProvider');
  }
  return context;
}