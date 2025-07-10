import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useSocket } from '../utils/SocketContext';

function Terminal({ terminalId, sessionId, onClose, onTerminalCreated, isActive, autoYes: autoYesProp = false, onAutoYesLog, panelId }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const { socket } = useSocket();
  const [localTerminalId, setLocalTerminalId] = useState(terminalId);
  const [isInitialized, setIsInitialized] = useState(false);
  const dataHandlerRef = useRef(null);
  const outputHandlerRef = useRef(null);
  const mountedRef = useRef(false);
  const mobileInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const lastOutputRef = useRef('');
  
  console.log(`[Terminal Component] Render - terminalId prop: ${terminalId}, localTerminalId: ${localTerminalId}, mounted: ${mountedRef.current}`);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize terminal
  useLayoutEffect(() => {
    console.log('[Terminal] useLayoutEffect triggered, mounted:', mountedRef.current, 'isInitialized:', isInitialized, 'terminalId:', terminalId, 'localTerminalId:', localTerminalId);
    console.log('[Terminal] Container dimensions:', containerRef.current?.offsetWidth, 'x', containerRef.current?.offsetHeight);
    
    if (!containerRef.current || !socket) {
      console.log('[Terminal] Missing dependencies - container:', !!containerRef.current, 'socket:', !!socket);
      return;
    }
    
    // Mark as mounted
    if (!mountedRef.current) {
      mountedRef.current = true;
      console.log('[Terminal] First mount detected');
    }
    
    if (isInitialized && terminalRef.current) {
      console.log('[Terminal] Already initialized with terminal instance, skipping');
      return;
    }
    
    // If we already have a terminalId but no terminal instance, we need to restore
    if ((terminalId || localTerminalId) && !terminalRef.current) {
      console.log('[Terminal] Have terminalId but no instance, will restore');
    }

    console.log('[Terminal Init] Starting initialization - Session:', sessionId);
    setIsInitialized(true);

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Fira Code, monospace',
      theme: {
        background: '#000000',
        foreground: '#f0f0f0',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: 'rgba(255, 255, 255, 0.3)'
      },
      allowTransparency: true,
      scrollback: 10000,
      cols: 80,
      rows: 24
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    // Open terminal
    term.open(containerRef.current);
    
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit terminal
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn('Initial fit failed:', e);
    }
    
    // Request terminal creation/restoration
    const existingId = localTerminalId || terminalId;
    if (!existingId) {
      console.log('[Terminal] Requesting NEW terminal creation');
      socket.emit('create-terminal', { sessionId });
    } else {
      console.log('[Terminal] Restoring existing terminal:', existingId);
      const terminalElement = containerRef.current;
      const cols = terminalElement ? Math.floor(terminalElement.offsetWidth / 9) : 80;
      const rows = terminalElement ? Math.floor(terminalElement.offsetHeight / 17) : 24;
      socket.emit('restore-terminal', { 
        terminalId: existingId, 
        sessionId,
        cols,
        rows
      });
    }

    return () => {
      console.log('Cleaning up terminal - terminalId:', localTerminalId);
      
      setIsInitialized(false);
      if (dataHandlerRef.current) {
        dataHandlerRef.current.dispose();
        dataHandlerRef.current = null;
      }
      if (outputHandlerRef.current) {
        outputHandlerRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [socket, sessionId]); // Remove isInitialized from dependencies

  // Set up data handler
  useEffect(() => {
    if (!terminalRef.current || !localTerminalId || !socket) return;

    console.log('Setting up data handler for:', localTerminalId);
    
    // Remove old handler
    if (dataHandlerRef.current) {
      dataHandlerRef.current.dispose();
    }

    // Add new handler
    dataHandlerRef.current = terminalRef.current.onData(data => {
      console.log('Input:', localTerminalId, 'data:', data);
      socket.emit('terminal-input', { terminalId: localTerminalId, input: data });
    });

    return () => {
      if (dataHandlerRef.current) {
        dataHandlerRef.current.dispose();
        dataHandlerRef.current = null;
      }
    };
  }, [socket, localTerminalId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleTerminalOutput = (data) => {
      if (data.terminalId === localTerminalId && terminalRef.current) {
        terminalRef.current.write(data.data);
        
        // Store last output for pattern detection
        lastOutputRef.current += data.data;
        // Keep only last 500 chars to avoid memory issues
        if (lastOutputRef.current.length > 500) {
          lastOutputRef.current = lastOutputRef.current.slice(-500);
        }
        
        // Auto-yes detection
        if (autoYesProp) {
          const patterns = [
            /Do you want to proceed\?.*❯\s*1\.\s*Yes/s,
            /Continue\?\s*\[Y\/n\]/i,
            /Are you sure.*\[y\/N\]/i,
            /Proceed\?\s*\(y\/n\)/i
          ];
          
          for (const pattern of patterns) {
            if (pattern.test(lastOutputRef.current)) {
              console.log('[Auto-Yes] Detected confirmation prompt, sending "1"');
              
              // Log the auto-yes action
              if (onAutoYesLog && panelId) {
                onAutoYesLog(panelId, lastOutputRef.current, '1');
              }
              
              setTimeout(() => {
                socket.emit('terminal-input', { 
                  terminalId: localTerminalId, 
                  input: '1\r' 
                });
                lastOutputRef.current = ''; // Clear after responding
              }, 100);
              break;
            }
          }
        }
      }
    };

    const handleTerminalCreated = (data) => {
      console.log('Terminal created event:', data);
      if (data.sessionId === sessionId && !localTerminalId) {
        console.log('Accepting terminal ID:', data.terminalId);
        setLocalTerminalId(data.terminalId);
        if (onTerminalCreated) {
          onTerminalCreated(data.terminalId);
        }
      }
    };

    const handleTerminalRestored = (data) => {
      if (data.terminalId === localTerminalId) {
        console.log('Terminal restored:', data.terminalId);
        socket.emit('get-terminal-buffer', { terminalId: localTerminalId });
      }
    };

    const handleTerminalError = (data) => {
      console.error('Terminal error:', data);
    };

    socket.on('terminal-output', handleTerminalOutput);
    socket.on('terminal-created', handleTerminalCreated);
    socket.on('terminal-restored', handleTerminalRestored);
    socket.on('terminal-error', handleTerminalError);

    // Store reference for cleanup
    outputHandlerRef.current = handleTerminalOutput;

    return () => {
      socket.off('terminal-output', handleTerminalOutput);
      socket.off('terminal-created', handleTerminalCreated);
      socket.off('terminal-restored', handleTerminalRestored);
      socket.off('terminal-error', handleTerminalError);
    };
  }, [socket, sessionId, localTerminalId, onTerminalCreated, autoYesProp, onAutoYesLog, panelId]);

  // Handle resize
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current || !localTerminalId || !socket || !containerRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current && containerRef.current) {
        try {
          // Don't fit if container is too small (avoid clearing terminal)
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 50) {
            console.log('[Terminal] Container too small, skipping resize:', rect.width, 'x', rect.height);
            return;
          }
          
          console.log('[Terminal] Handling resize for terminal:', localTerminalId, 'size:', rect.width, 'x', rect.height);
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;
          socket.emit('resize-terminal', { terminalId: localTerminalId, cols, rows });
          
          // Force xterm to refresh/redraw
          terminalRef.current.refresh(0, terminalRef.current.rows - 1);
        } catch (error) {
          console.warn('Resize error:', error);
        }
      }
    };

    // Use ResizeObserver to detect container size changes
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        handleResize();
      }, 100); // Debounce resize events
    });
    
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    
    // Initial resize
    handleResize();
    
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [socket, localTerminalId]);

  // Handle focus
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isActive]);

  const handleClick = () => {
    if (terminalRef.current) {
      terminalRef.current.focus();
    }
    
    // On mobile, also focus the hidden input
    if (isMobile && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  };
  
  // Handle mobile input
  const handleMobileInput = (e) => {
    if (!socket || !localTerminalId) return;
    
    const input = e.target.value;
    if (input) {
      // Send each character
      for (let char of input) {
        socket.emit('terminal-input', { terminalId: localTerminalId, input: char });
      }
      // Clear the input
      e.target.value = '';
    }
  };
  
  // Handle mobile key events
  const handleMobileKeyDown = (e) => {
    if (!socket || !localTerminalId) return;
    
    // Handle special keys
    if (e.key === 'Enter') {
      e.preventDefault();
      socket.emit('terminal-input', { terminalId: localTerminalId, input: '\r' });
      e.target.value = '';
    } else if (e.key === 'Backspace' && e.target.value === '') {
      // Send backspace if input is empty
      e.preventDefault();
      socket.emit('terminal-input', { terminalId: localTerminalId, input: '\x7f' });
    }
  };


  return (
    <div 
      ref={containerRef} 
      onClick={handleClick}
      style={{ 
        height: '100%', 
        width: '100%',
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'text',
        minHeight: '100px',  // Ensure container has minimum dimensions
        minWidth: '100px'
      }} 
    >
      {isMobile && (
        <input
          ref={mobileInputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          onInput={handleMobileInput}
          onKeyDown={handleMobileKeyDown}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
}

export default React.memo(Terminal);