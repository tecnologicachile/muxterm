import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Edit as EditIcon,
  Close as CloseIcon,
  Minimize as MinimizeIcon
} from '@mui/icons-material';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import Terminal from './Terminal';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function PanelManager({ panels, activePanel, onPanelSelect, onPanelClose, onTerminalCreated, onRenamePanel, onMinimizePanel, sessionId, sshConnectionId }) {
  const { socket } = useSocket();

  // Track activity state for each panel
  const [activityStates, setActivityStates] = useState({});

  // Detect mobile for single-panel mode (initialize with correct value to avoid flash)
  const [isMobile, setIsMobile] = useState(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobileDevice && window.innerWidth <= 768;
  });
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice && window.innerWidth <= 768);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Disable iframe pointer-events during panel resize to prevent mouse capture issues
  useEffect(() => {
    const disableIframes = () => {
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
    };
    const enableIframes = () => {
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'auto');
    };
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-panel-resize-handle-id]')) disableIframes();
    });
    document.addEventListener('mouseup', enableIframes);
    return () => {
      document.removeEventListener('mouseup', enableIframes);
    };
  }, []);

  // Handle activity changes from terminals
  const handleActivityChange = (panelId, isActive) => {
    setActivityStates(prev => ({
      ...prev,
      [panelId]: isActive
    }));
  };
  // For simplicity, we'll use a 2x2 grid layout
  // This allows up to 4 terminals in a grid pattern
  
  const renderTerminal = (panel) => {
    const isActive = panel.id === activePanel;
    logger.debug(`[PanelManager] Rendering terminal for panel ${panel.id}, terminalId: ${panel.terminalId}, active: ${isActive}`);
    
    return (
      <Box
        key={`panel-box-${panel.id}`}
        data-panel-id={panel.id}
        sx={{
          height: '100%',
          width: '100%',
          border: isActive ? '2px solid #00ff00' : '1px solid #333',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={() => onPanelSelect(panel.id)}
      >
        <Box 
          className="panel-header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
            padding: '2px 8px',
            minHeight: '24px'
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: isActive ? '#00ff00' : '#888',
              fontSize: '11px',
              fontWeight: isActive ? 'bold' : 'normal'
            }}
          >
            {panel.name || `Terminal ${panels.indexOf(panel) + 1}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* Scroll buttons - mobile only */}
            {isMobile && panel.terminalId && (
              <>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    if (socket) socket.emit('terminal-scroll', { terminalId: panel.terminalId, direction: 'up' });
                  }}
                  sx={{
                    width: '22px', height: '18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#333', borderRadius: '3px', cursor: 'pointer',
                    fontSize: '10px', color: '#aaa', userSelect: 'none',
                    '&:active': { backgroundColor: '#555' }
                  }}
                >▲</Box>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    if (socket) socket.emit('terminal-scroll', { terminalId: panel.terminalId, direction: 'down' });
                  }}
                  sx={{
                    width: '22px', height: '18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#333', borderRadius: '3px', cursor: 'pointer',
                    fontSize: '10px', color: '#aaa', userSelect: 'none',
                    '&:active': { backgroundColor: '#555' }
                  }}
                >▼</Box>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    if (socket) socket.emit('send-keys', { terminalId: panel.terminalId, keys: 'q' });
                  }}
                  sx={{
                    width: '22px', height: '18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#555', borderRadius: '3px', cursor: 'pointer',
                    fontSize: '10px', color: '#fff', userSelect: 'none',
                    '&:active': { backgroundColor: '#777' }
                  }}
                >✕</Box>
              </>
            )}
            {/* Activity indicator */}
            <Box 
              sx={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '2px solid #00ff00',
                borderTop: '2px solid transparent',
                opacity: activityStates[panel.id] ? 1 : 0.3,
                transition: 'opacity 0.3s ease',
                animation: activityStates[panel.id] ? 'spin 1s linear infinite' : 'none',
                backgroundColor: activityStates[panel.id] ? 'rgba(0, 255, 0, 0.1)' : 'transparent'
              }}
            />
            
            {onMinimizePanel && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onMinimizePanel(panel.id);
                }}
                sx={{ 
                  padding: '2px',
                  color: '#666',
                  '&:hover': { color: '#fff' }
                }}
                title="Minimize"
              >
                <MinimizeIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            {onRenamePanel && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenamePanel(panel.id);
                }}
                sx={{ 
                  padding: '2px',
                  color: '#666',
                  '&:hover': { color: '#fff' }
                }}
                title="Rename"
              >
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            {panels.length > 1 && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onPanelClose(panel.id);
                }}
                sx={{ 
                  padding: '2px',
                  color: '#666',
                  '&:hover': { color: '#ff4444' }
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Terminal
          key={`terminal-${panel.id}`}
          terminalId={panel.terminalId}
          sessionId={sessionId}
          isActive={isActive}
          sshConnectionId={sshConnectionId}
          onClose={() => onPanelClose(panel.id)}
          onTerminalCreated={(newTerminalId) => {
            if (onTerminalCreated && !panel.terminalId) {
              onTerminalCreated(panel.id, newTerminalId);
            }
          }}
          panelId={panel.id}
          onActivityChange={handleActivityChange}
        />
        </Box>
      </Box>
    );
  };

  if (panels.length === 0) return null;

  // Mobile: single panel view (tabs rendered by TerminalView)
  // All panels stay mounted at full-screen size, only the active one is visible
  if (isMobile && panels.length > 1) {
    return (
      <Box sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
        {panels.map(panel => (
          <Box
            key={`mobile-panel-${panel.id}`}
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              visibility: panel.id === activePanel ? 'visible' : 'hidden',
              zIndex: panel.id === activePanel ? 1 : 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {renderTerminal(panel)}
          </Box>
        ))}
      </Box>
    );
  }

  if (panels.length === 1) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-0" minSize={100}>
          {renderTerminal(panels[0])}
        </Panel>
      </PanelGroup>
    );
  }
  
  if (panels.length === 2) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-0" minSize={30}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-1" minSize={30}>
          {renderTerminal(panels[1])}
        </Panel>
      </PanelGroup>
    );
  }
  
  if (panels.length === 3) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-0" minSize={30}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-1" minSize={30}>
              {renderTerminal(panels[1])}
            </Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-2" minSize={30}>
              {renderTerminal(panels[2])}
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 4 panels: 2x2 grid
  if (panels.length === 4) {
    return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      <Panel id="panel-left-group" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-0" minSize={30}>
            {renderTerminal(panels[0])}
          </Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-2" minSize={30}>
            {renderTerminal(panels[2])}
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
      <Panel id="panel-right-group" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-1" minSize={30}>
            {renderTerminal(panels[1])}
          </Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-3" minSize={30}>
            {renderTerminal(panels[3])}
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
    );
  }
  
  // 5 paneles: 2 columnas (2 + 3)
  if (panels.length === 5) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-left" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={30}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-1" minSize={30}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={20}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-3" minSize={20}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-4" minSize={20}>{renderTerminal(panels[4])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 6 paneles: 2x3 grid
  if (panels.length === 6) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-left" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={20}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-1" minSize={20}>{renderTerminal(panels[1])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-2" minSize={20}>{renderTerminal(panels[2])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-3" minSize={20}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-4" minSize={20}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-5" minSize={20}>{renderTerminal(panels[5])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 7 paneles: 3 columnas (2 + 2 + 3)
  if (panels.length === 7) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-left" minSize={20}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={30}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-1" minSize={30}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-center" minSize={20}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={30}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-3" minSize={30}>{renderTerminal(panels[3])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
        <Panel id="panel-right" minSize={20}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-4" minSize={20}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-5" minSize={20}>{renderTerminal(panels[5])}</Panel>
            <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
            <Panel id="panel-6" minSize={20}>{renderTerminal(panels[6])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 8 paneles: 2x4 grid
  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      <Panel id="panel-left" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-0" minSize={15}>{renderTerminal(panels[0])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-1" minSize={15}>{renderTerminal(panels[1])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-2" minSize={15}>{renderTerminal(panels[2])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-3" minSize={15}>{renderTerminal(panels[3])}</Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={{ width: '6px', backgroundColor: '#333', cursor: 'col-resize' }} />
      <Panel id="panel-right" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-4" minSize={15}>{renderTerminal(panels[4])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-5" minSize={15}>{renderTerminal(panels[5])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-6" minSize={15}>{renderTerminal(panels[6])}</Panel>
          <PanelResizeHandle style={{ height: '6px', backgroundColor: '#333', cursor: 'row-resize' }} />
          <Panel id="panel-7" minSize={15}>{renderTerminal(panels[7])}</Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default PanelManager;