import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import Terminal from './Terminal';

// This component preserves terminal instances across layout changes
function TerminalContainer({ panels, activePanel, onPanelSelect, onPanelClose, onTerminalCreated, sessionId }) {
  const terminalsRef = useRef({});
  
  // Render all terminals but only show the ones that are in current panels
  const renderAllTerminals = () => {
    return (
      <>
        {panels.map(panel => {
          const isActive = panel.id === activePanel;
          const isVisible = true; // All panels in the array should be visible
          
          return (
            <Box
              key={`terminal-container-${panel.id}`}
              sx={{
                display: isVisible ? 'block' : 'none',
                height: '100%',
                width: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <Terminal
                key={`terminal-${panel.id}`}
                terminalId={panel.terminalId}
                sessionId={sessionId}
                isActive={isActive}
                onClose={() => onPanelClose(panel.id)}
                onTerminalCreated={(newTerminalId) => {
                  if (onTerminalCreated && !panel.terminalId) {
                    onTerminalCreated(panel.id, newTerminalId);
                  }
                }}
              />
            </Box>
          );
        })}
      </>
    );
  };
  
  return renderAllTerminals();
}

export default TerminalContainer;