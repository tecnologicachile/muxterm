import React, { useRef, useEffect, createContext, useContext, useCallback } from 'react';

const PoolContext = createContext(null);

export function useTerminalPool() {
  return useContext(PoolContext);
}

export function TerminalPoolProvider({ children }) {
  const poolRef = useRef(null);
  const slotsRef = useRef({});

  const registerSlot = useCallback((id, el) => {
    if (el) {
      slotsRef.current[id] = el;
    } else {
      delete slotsRef.current[id];
    }
  }, []);

  const attachToSlot = useCallback((iframeEl, slotId) => {
    const slot = slotsRef.current[slotId];
    if (!slot || !iframeEl || !poolRef.current) return;
    try { slot.appendChild(iframeEl); } catch (_) {}
  }, []);

  const detachToPool = useCallback((iframeEl) => {
    if (!iframeEl || !poolRef.current) return;
    try { poolRef.current.appendChild(iframeEl); } catch (_) {}
  }, []);

  return (
    <PoolContext.Provider value={{ poolRef, registerSlot, attachToSlot, detachToPool }}>
      <div
        ref={poolRef}
        id="terminal-pool"
        style={{ position: 'fixed', left: -9999, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
      {children}
    </PoolContext.Provider>
  );
}
