import { useEffect, useRef } from 'react';

export const useKeyboardShortcuts = (handlers) => {
  const prefixActive = useRef(false);
  const prefixTimer = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+B as prefix key (like tmux)
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        prefixActive.current = true;
        
        // Reset prefix after 2 seconds
        if (prefixTimer.current) {
          clearTimeout(prefixTimer.current);
        }
        prefixTimer.current = setTimeout(() => {
          prefixActive.current = false;
        }, 2000);
        
        return;
      }

      // Handle commands after prefix
      if (prefixActive.current) {
        e.preventDefault();
        prefixActive.current = false;
        
        if (prefixTimer.current) {
          clearTimeout(prefixTimer.current);
        }

        switch (e.key) {
          case '%':
            // Split horizontal
            handlers.splitHorizontal?.();
            break;
          case '"':
            // Split vertical
            handlers.splitVertical?.();
            break;
          case 'x':
            // Close current panel
            handlers.closePanel?.();
            break;
          case 'o':
            // Switch to next panel
            handlers.nextPanel?.();
            break;
          case 'c':
            // Create new terminal
            handlers.newTerminal?.();
            break;
          case 'd':
            // Detach (go back to sessions)
            handlers.detach?.();
            break;
          case '[':
            // Enter copy mode (scroll)
            handlers.enterCopyMode?.();
            break;
          case '?':
            // Show help
            handlers.showHelp?.();
            break;
          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            // Switch to panel by number
            handlers.switchToPanel?.(parseInt(e.key));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (prefixTimer.current) {
        clearTimeout(prefixTimer.current);
      }
    };
  }, [handlers]);

  return prefixActive.current;
};

export const SHORTCUTS = [
  { keys: 'Ctrl+B %', description: 'Split panel horizontally' },
  { keys: 'Ctrl+B "', description: 'Split panel vertically' },
  { keys: 'Ctrl+B x', description: 'Close current panel' },
  { keys: 'Ctrl+B o', description: 'Switch to next panel' },
  { keys: 'Ctrl+B c', description: 'Create new terminal' },
  { keys: 'Ctrl+B d', description: 'Detach from session' },
  { keys: 'Ctrl+B [', description: 'Enter copy/scroll mode' },
  { keys: 'Ctrl+B 0-9', description: 'Switch to panel by number' },
  { keys: 'Ctrl+B ?', description: 'Show keyboard shortcuts' }
];