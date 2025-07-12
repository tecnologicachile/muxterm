import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';
import tracer from '../utils/persistenceTracer';

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
  
  // Debug auto-yes prop
  useEffect(() => {
    logger.debug(`[Terminal ${panelId}] autoYesProp changed:`, autoYesProp);
  }, [autoYesProp, panelId]);
  
  logger.debug(`[Terminal Component] Render - terminalId prop: ${terminalId}, localTerminalId: ${localTerminalId}, mounted: ${mountedRef.current}`);

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
    logger.debug('[Terminal] useLayoutEffect triggered, mounted:', mountedRef.current, 'isInitialized:', isInitialized, 'terminalId:', terminalId, 'localTerminalId:', localTerminalId);
    logger.debug('[Terminal] Container dimensions:', containerRef.current?.offsetWidth, 'x', containerRef.current?.offsetHeight);
    
    if (!containerRef.current || !socket) {
      logger.debug('[Terminal] Missing dependencies - container:', !!containerRef.current, 'socket:', !!socket);
      return;
    }
    
    // Mark as mounted
    if (!mountedRef.current) {
      mountedRef.current = true;
      logger.debug('[Terminal] First mount detected');
    }
    
    if (isInitialized && terminalRef.current) {
      logger.debug('[Terminal] Already initialized with terminal instance, skipping');
      return;
    }
    
    // If we already have a terminalId but no terminal instance, we need to restore
    if ((terminalId || localTerminalId) && !terminalRef.current) {
      logger.debug('[Terminal] Have terminalId but no instance, will restore');
    }

    logger.debug('[Terminal Init] Starting initialization - Session:', sessionId);
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
      logger.debug('Initial fit failed:', e);
    }
    
    // Request terminal creation/restoration
    const existingId = localTerminalId || terminalId;
    if (!existingId) {
      logger.debug('[Terminal] Requesting NEW terminal creation');
      tracer.trace('INIT', 'CREATE_NEW_TERMINAL', { sessionId });
      socket.emit('create-terminal', { sessionId });
    } else {
      logger.debug('[Terminal] Restoring existing terminal:', existingId);
      const terminalElement = containerRef.current;
      const cols = terminalElement ? Math.floor(terminalElement.offsetWidth / 9) : 80;
      const rows = terminalElement ? Math.floor(terminalElement.offsetHeight / 17) : 24;
      
      tracer.trace('INIT', 'RESTORE_EXISTING_TERMINAL', {
        terminalId: existingId,
        sessionId,
        cols,
        rows
      });
      
      socket.emit('restore-terminal', { 
        terminalId: existingId, 
        sessionId,
        cols,
        rows
      });
    }

    return () => {
      logger.debug('Cleaning up terminal - terminalId:', localTerminalId);
      
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

      logger.debug('Setting up data handler for:', localTerminalId);
    
    // Remove old handler
    if (dataHandlerRef.current) {
      dataHandlerRef.current.dispose();
    }

    // Add new handler
    dataHandlerRef.current = terminalRef.current.onData(data => {
      logger.debug('Input:', localTerminalId, 'data:', data);
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
      tracer.traceSocketEvent('terminal-output', data);
      
      if (data.terminalId === localTerminalId && terminalRef.current) {
        tracer.traceBuffer('RECEIVED_FROM_SERVER', data.data, {
          terminalId: data.terminalId,
          terminalReady: !!terminalRef.current
        });
        
        terminalRef.current.write(data.data);
        tracer.trace('TERMINAL', 'DATA_WRITTEN', {
          terminalId: data.terminalId,
          dataLength: data.data.length
        });
        
        // Store last output for pattern detection
        lastOutputRef.current += data.data;
        // Keep only last 1000 chars to avoid memory issues (increased for Claude CLI)
        if (lastOutputRef.current.length > 1000) {
          lastOutputRef.current = lastOutputRef.current.slice(-1000);
        }
        
        // Debug logging for auto-yes
        if (data.data.includes('Do you want to proceed')) {
          logger.debug('[Auto-Yes Debug] Found "Do you want to proceed" in output');
          logger.debug('[Auto-Yes Debug] autoYesProp:', autoYesProp);
          logger.debug('[Auto-Yes Debug] Raw data:', data.data);
          logger.debug('[Auto-Yes Debug] Buffer content:', lastOutputRef.current.slice(-500));
        }
        
        // Auto-yes detection - focused on Claude CLI
        if (autoYesProp) {
          // Clean the output for better pattern matching
          const cleanOutput = lastOutputRef.current.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
          
          logger.debug('[Auto-Yes] Full detection check started');
          logger.debug('[Auto-Yes] Buffer length:', lastOutputRef.current.length);
          logger.debug('[Auto-Yes] Clean output length:', cleanOutput.length);
          
          // Claude CLI specific patterns
          const patterns = [
            {
              name: 'Claude CLI - Universal',
              regex: /Do you want[\s\S]*?❯[\s\S]*?1\. Yes/,
              response: '1'
            }
          ];
          
          // Additional check for broken pattern due to ANSI codes
          // More flexible detection for Claude CLI questions
          const hasPrompt = cleanOutput.includes('Do you want to') && cleanOutput.includes('?');
          const hasOption = cleanOutput.includes('1.') && cleanOutput.includes('Yes');
          const hasPointer = cleanOutput.includes('❯');
          
          // Specific Claude CLI indicators
          const hasClaudeOptions = cleanOutput.includes('1. Yes') && 
                                  (cleanOutput.includes('2. No') || 
                                   cleanOutput.includes("2. Yes, and don't ask again") ||
                                   cleanOutput.includes("and don't ask again for"));
          
          logger.debug('[Auto-Yes] Pattern check - hasPrompt:', hasPrompt, 'hasOption:', hasOption, 'hasPointer:', hasPointer);
          
          // Check for specific Claude CLI pattern parts
          const hasOneYes = cleanOutput.includes('1. Yes');
          const hasTwoNo = cleanOutput.includes('2. No');
          const hasArrow = cleanOutput.includes('→') || cleanOutput.includes('❯');
          
          logger.debug('[Auto-Yes] Alternative check - hasOneYes:', hasOneYes, 'hasTwoNo:', hasTwoNo, 'hasArrow:', hasArrow);
          
          // Debug: show last 300 chars of clean output if we have the prompt
          if (hasPrompt) {
            logger.debug('[Auto-Yes] Last 300 chars of clean output:', cleanOutput.slice(-300));
          }
          
          // Show the full buffer if we have any of the key components
          if (hasPointer || hasOption) {
            logger.debug('[Auto-Yes] Full clean buffer (for debugging):', cleanOutput);
          }
          
          // Try multiple detection methods
          const method1 = hasPrompt && hasOption && hasPointer;
          const method2 = hasPrompt && hasOneYes && hasTwoNo;
          const method3 = hasPrompt && hasClaudeOptions && hasPointer;
          
          // Method for Claude's specific pattern with numbered options
          const method4 = cleanOutput.includes('Do you want to') && 
                         cleanOutput.includes('?') &&
                         hasClaudeOptions &&
                         hasPointer;
          
          // Check for partial matches (might be split across buffers)
          const hasDoYouWant = cleanOutput.includes('Do you want');
          const hasProceed = cleanOutput.includes('proceed?') || cleanOutput.includes('make this edit');
          const hasYesOption = cleanOutput.includes('Yes');
          const hasNumberOne = cleanOutput.includes('1.');
          
          logger.debug('[Auto-Yes] Detection methods - method1:', method1, 'method2:', method2, 'method3:', method3, 'method4:', method4);
          logger.debug('[Auto-Yes] Partial checks - hasDoYouWant:', hasDoYouWant, 'hasProceed:', hasProceed, 
                     'hasYesOption:', hasYesOption, 'hasNumberOne:', hasNumberOne);
          
          // Method 5: Check if we have the key Claude CLI elements even without full prompt
          const method5 = hasPointer && hasNumberOne && hasYesOption && 
                         (cleanOutput.includes('Yes, and don\'t ask again') || 
                          cleanOutput.includes('No, and tell Claude') ||
                          cleanOutput.includes('and don\'t ask again for'));
          
          logger.debug('[Auto-Yes] Method 5 (partial Claude CLI):', method5);
          
          // Try simpler detection if any method works
          if (method1 || method2 || method3 || method4 || method5) {
            logger.info('[Auto-Yes] Claude CLI pattern DETECTED via method:', 
                       method1 ? '1' : (method2 ? '2' : (method3 ? '3' : (method4 ? '4' : '5'))));
            logger.info('[Auto-Yes] Sending response "1" now...');
            
            // Log the auto-yes action
            if (onAutoYesLog && panelId) {
              onAutoYesLog(panelId, cleanOutput, '1');
            }
            
            // Send the response immediately
            logger.debug('[Auto-Yes] About to send response to terminal:', localTerminalId);
            socket.emit('terminal-input', { 
              terminalId: localTerminalId, 
              input: '1\r' 
            });
            
            // Send an additional Enter after a short delay (as it was working before)
            setTimeout(() => {
              logger.debug('[Auto-Yes] Sending additional Enter key');
              socket.emit('terminal-input', { 
                terminalId: localTerminalId, 
                input: '\r' 
              });
            }, 100);
            
            logger.debug('[Auto-Yes] Response sent! Clearing buffer...');
            
            // Clear the buffer
            lastOutputRef.current = '';
            return; // Exit early
          }
          
          // Original pattern matching (kept as fallback)
          for (const pattern of patterns) {
            if (pattern.regex.test(cleanOutput)) {
              logger.info(`[Auto-Yes] ${pattern.name} DETECTED via regex!`);
              logger.debug('[Auto-Yes] Pattern matched:', pattern.regex);
              
              // Log the auto-yes action
              if (onAutoYesLog && panelId) {
                onAutoYesLog(panelId, cleanOutput, pattern.response);
              }
              
              // Send the response immediately
              logger.info(`[Auto-Yes] Sending response: "${pattern.response}"`);
              socket.emit('terminal-input', { 
                terminalId: localTerminalId, 
                input: pattern.response + '\r' 
              });
              
              // Send an additional Enter after a short delay
              setTimeout(() => {
                logger.debug('[Auto-Yes] Sending additional Enter key (regex method)');
                socket.emit('terminal-input', { 
                  terminalId: localTerminalId, 
                  input: '\r' 
                });
              }, 100);
              
              // Clear the buffer after a short delay to avoid duplicate responses
              setTimeout(() => {
                lastOutputRef.current = '';
              }, 500);
              
              break;
            }
          }
        }
      }
    };

    const handleTerminalCreated = (data) => {
      logger.debug('Terminal created event:', data);
      if (data.sessionId === sessionId && !localTerminalId) {
        logger.debug('Accepting terminal ID:', data.terminalId);
        setLocalTerminalId(data.terminalId);
        if (onTerminalCreated) {
          onTerminalCreated(data.terminalId);
        }
      }
    };

    const handleTerminalRestored = (data) => {
      tracer.traceSocketEvent('terminal-restored', data);
      
      if (data.terminalId === localTerminalId) {
        logger.debug('Terminal restored:', data.terminalId);
        tracer.trace('RESTORE', 'TERMINAL_RESTORED', {
          terminalId: data.terminalId,
          sessionId: data.sessionId,
          terminalExists: !!terminalRef.current
        });
        
        socket.emit('get-terminal-buffer', { terminalId: localTerminalId });
        tracer.trace('RESTORE', 'BUFFER_REQUESTED', {
          terminalId: localTerminalId
        });
      }
    };

    const handleTerminalError = (data) => {
      logger.error('Terminal error:', data);
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
            logger.debug('[Terminal] Container too small, skipping resize:', rect.width, 'x', rect.height);
            return;
          }
          
          logger.debug('[Terminal] Handling resize for terminal:', localTerminalId, 'size:', rect.width, 'x', rect.height);
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;
          socket.emit('resize-terminal', { terminalId: localTerminalId, cols, rows });
          
          // Force xterm to refresh/redraw
          terminalRef.current.refresh(0, terminalRef.current.rows - 1);
        } catch (error) {
          logger.debug('Resize error:', error);
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
        <textarea
          ref={mobileInputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          inputMode="none"
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