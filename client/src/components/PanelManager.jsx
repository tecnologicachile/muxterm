import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import Terminal from './Terminal';
import RdpViewer from './RdpViewer';
import SftpViewer from './SftpViewer';
import LocalFileBrowser from './LocalFileBrowser';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

function PanelManager({ panels, activePanel, onPanelSelect, onPanelClose, onTerminalCreated, onRenamePanel, onMinimizePanel, onReorderPanels }) {
  const { socket } = useSocket();

  // Track activity state for each panel
  const [activityStates, setActivityStates] = useState({});

  // Drag & drop reorder state
  const [dragPanelId, setDragPanelId] = useState(null);
  const [dragOverPanelId, setDragOverPanelId] = useState(null);

  // File browser modal (local terminal CWD or SSH home)
  const [fileBrowserTerminalId, setFileBrowserTerminalId] = useState(null);
  const [fileBrowserKey, setFileBrowserKey] = useState(0);
  const [fileBrowserMode, setFileBrowserMode] = useState('local');
  const [fileBrowserSshId, setFileBrowserSshId] = useState(null);
  const openFileBrowser = (tid, mode = 'local', sshId = null) => {
    setFileBrowserKey(k => k + 1);
    setFileBrowserMode(mode);
    setFileBrowserSshId(sshId);
    setFileBrowserTerminalId(tid || 'ssh');
  };

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
  
  // Overlay to block panel content during resize (prevents lag from iframes/canvas)
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    const onMouseDown = (e) => {
      if (e.target.closest('[data-panel-resize-handle-id]')) setIsResizing(true);
    };
    const onMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // Maximized panel state
  const [maximizedPanel, setMaximizedPanel] = useState(null);

  // Handle activity changes from terminals
  const handleActivityChange = (panelId, isActive) => {
    setActivityStates(prev => ({
      ...prev,
      [panelId]: isActive
    }));
  };
  // For simplicity, we'll use a 2x2 grid layout
  // This allows up to 4 terminals in a grid pattern
  
  const hStyle = (dir) => ({
    width: dir === 'h' ? '6px' : undefined,
    height: dir === 'v' ? '6px' : undefined,
    backgroundColor: isResizing ? '#555' : '#333',
    cursor: dir === 'h' ? 'col-resize' : 'row-resize',
    transition: 'background-color 0.15s'
  });

  const renderTerminal = (panel) => {
    const isActive = panel.id === activePanel;
    logger.debug(`[PanelManager] Rendering terminal for panel ${panel.id}, terminalId: ${panel.terminalId}, active: ${isActive}`);
    
    return (
      <Box
        key={`panel-box-${panel.id}`}
        data-panel-id={panel.id}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragPanelId && panel.id !== dragPanelId) setDragOverPanelId(panel.id);
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the panel entirely (not entering a child)
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOverPanelId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragPanelId && dragPanelId !== panel.id && onReorderPanels) {
            onReorderPanels(dragPanelId, panel.id);
          }
          setDragPanelId(null);
          setDragOverPanelId(null);
        }}
        sx={{
          height: '100%',
          width: '100%',
          border: dragOverPanelId === panel.id ? '2px solid #00ff00' : isActive ? '2px solid #00ff00' : '1px solid #333',
          boxShadow: dragOverPanelId === panel.id ? 'inset 0 0 20px rgba(0, 255, 0, 0.15)' : 'none',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          opacity: dragPanelId === panel.id ? 0.4 : 1,
          transition: 'box-shadow 0.15s, opacity 0.15s'
        }}
        onClick={() => onPanelSelect(panel.id)}
      >
        {/* Overlay - blocks iframe/canvas mouse capture during resize or drag */}
        {(isResizing || (dragPanelId && dragPanelId !== panel.id)) && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 100, cursor: isResizing ? 'col-resize' : 'default'
          }} />
        )}
        <Box
          className="panel-header"
          draggable={panels.length > 1}
          onDragStart={(e) => {
            setDragPanelId(panel.id);
            e.dataTransfer.effectAllowed = 'move';
            // Use full panel as drag ghost image
            const panelEl = e.currentTarget.closest('[data-panel-id]');
            if (panelEl) {
              e.dataTransfer.setDragImage(panelEl, panelEl.offsetWidth / 2, 20);
            }
          }}
          onDragEnd={() => { setDragPanelId(null); setDragOverPanelId(null); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
            padding: '2px 8px',
            minHeight: '24px',
            cursor: dragPanelId ? 'grabbing' : 'default',
            transition: 'background-color 0.1s'
          }}
        >
          <Typography
            variant="caption"
            onClick={(e) => {
              e.stopPropagation();
              if (onRenamePanel) onRenamePanel(panel.id);
            }}
            sx={{
              color: isActive ? '#00ff00' : '#888',
              fontSize: '11px',
              fontWeight: isActive ? 'bold' : 'normal',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            title="Click to rename"
          >
            {panel.name || `Terminal ${panels.indexOf(panel) + 1}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* Scroll buttons */}
            {panel.terminalId && (
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
                    if (socket) socket.emit('terminal-scroll', { terminalId: panel.terminalId, direction: 'exit' });
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
            
            {/* File browser - local (CWD) or SSH (home) */}
            {((!panel.type || panel.type === 'local') && panel.terminalId) && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); openFileBrowser(panel.terminalId, 'local'); }}
                sx={{ padding: '2px', color: '#666', '&:hover': { color: '#00aaff' } }}
                title="File browser"
              >
                <FolderIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            {(panel.type === 'ssh' && panel.sshConnectionId) && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); openFileBrowser(null, 'ssh', panel.sshConnectionId); }}
                sx={{ padding: '2px', color: '#666', '&:hover': { color: '#00aaff' } }}
                title="SFTP browser (home)"
              >
                <FolderIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}

            {/* Maximize/Restore */}
            {panels.length > 1 && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximizedPanel(maximizedPanel === panel.id ? null : panel.id);
                }}
                sx={{
                  padding: '2px',
                  color: maximizedPanel === panel.id ? '#00ff00' : '#666',
                  '&:hover': { color: '#fff' }
                }}
                title={maximizedPanel === panel.id ? 'Restore' : 'Maximize'}
              >
                <Typography sx={{ fontSize: 12, lineHeight: 1 }}>{maximizedPanel === panel.id ? '⧉' : '□'}</Typography>
              </IconButton>
            )}
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
          {panel.type === 'sftp' ? (
            <SftpViewer
              key={`sftp-${panel.id}`}
              sftpConfig={panel.sftpConfig}
              panelId={panel.id}
            />
          ) : (panel.type === 'rdp' || panel.type === 'vnc') ? (
            <RdpViewer
              key={`remote-${panel.id}`}
              connectionType={panel.type}
              rdpConnectionId={panel.rdpConnectionId}
              vncConnectionId={panel.vncConnectionId}
              isActive={isActive}
              panelId={panel.id}
              onActivityChange={handleActivityChange}
              displayMode={panel.displayMode || 'fit'}
            />
          ) : (
            <Terminal
              key={`terminal-${panel.id}-${panel._restoreKey || 0}`}
              terminalId={panel.terminalId}
              isActive={isActive}
              sshConnectionId={panel.sshConnectionId || null}
              onClose={() => onPanelClose(panel.id)}
              onTerminalCreated={(newTerminalId) => {
                if (onTerminalCreated && !panel.terminalId) {
                  onTerminalCreated(panel.id, newTerminalId);
                }
              }}
              panelId={panel.id}
              onActivityChange={handleActivityChange}
            />
          )}
        </Box>
      </Box>
    );
  };

  const renderLayout = () => {
  if (panels.length === 0) return null;

  // Maximized panel: show only that panel fullscreen, others hidden but mounted
  if (maximizedPanel && panels.some(p => p.id === maximizedPanel)) {
    return (
      <Box sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
        {panels.map(panel => (
          <Box
            key={`max-panel-${panel.id}`}
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              visibility: panel.id === maximizedPanel ? 'visible' : 'hidden',
              zIndex: panel.id === maximizedPanel ? 1 : 0,
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
        <Panel id="panel-0" minSize={5}>
          {renderTerminal(panels[0])}
        </Panel>
      </PanelGroup>
    );
  }
  
  if (panels.length === 2) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-0" minSize={5}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-1" minSize={5}>
          {renderTerminal(panels[1])}
        </Panel>
      </PanelGroup>
    );
  }
  
  if (panels.length === 3) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-0" minSize={5}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-right" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-1" minSize={5}>
              {renderTerminal(panels[1])}
            </Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-2" minSize={5}>
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
      <Panel id="panel-left-group" minSize={5}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-0" minSize={5}>
            {renderTerminal(panels[0])}
          </Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-2" minSize={5}>
            {renderTerminal(panels[2])}
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={hStyle('h')} />
      <Panel id="panel-right-group" minSize={5}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-1" minSize={5}>
            {renderTerminal(panels[1])}
          </Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-3" minSize={5}>
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
        <Panel id="panel-left" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={5}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-1" minSize={5}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-right" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={5}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-3" minSize={5}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-4" minSize={5}>{renderTerminal(panels[4])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 6 paneles: 2x3 grid
  if (panels.length === 6) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-left" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={5}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-1" minSize={5}>{renderTerminal(panels[1])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-2" minSize={5}>{renderTerminal(panels[2])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-right" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-3" minSize={5}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-4" minSize={5}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-5" minSize={5}>{renderTerminal(panels[5])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 7 paneles: 3 columnas (2 + 2 + 3)
  if (panels.length === 7) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id="panel-left" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-0" minSize={5}>{renderTerminal(panels[0])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-1" minSize={5}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-center" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={5}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-3" minSize={5}>{renderTerminal(panels[3])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={hStyle('h')} />
        <Panel id="panel-right" minSize={5}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-4" minSize={5}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-5" minSize={5}>{renderTerminal(panels[5])}</Panel>
            <PanelResizeHandle style={hStyle('v')} />
            <Panel id="panel-6" minSize={5}>{renderTerminal(panels[6])}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 8 paneles: 2x4 grid
  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      <Panel id="panel-left" minSize={5}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-0" minSize={5}>{renderTerminal(panels[0])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-1" minSize={5}>{renderTerminal(panels[1])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-2" minSize={5}>{renderTerminal(panels[2])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-3" minSize={5}>{renderTerminal(panels[3])}</Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={hStyle('h')} />
      <Panel id="panel-right" minSize={5}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-4" minSize={5}>{renderTerminal(panels[4])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-5" minSize={5}>{renderTerminal(panels[5])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-6" minSize={5}>{renderTerminal(panels[6])}</Panel>
          <PanelResizeHandle style={hStyle('v')} />
          <Panel id="panel-7" minSize={5}>{renderTerminal(panels[7])}</Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
  };

  return (
    <>
      {renderLayout()}
      <LocalFileBrowser
        key={`fb-${fileBrowserKey}`}
        open={!!fileBrowserTerminalId}
        onClose={() => setFileBrowserTerminalId(null)}
        terminalId={fileBrowserMode === 'local' ? fileBrowserTerminalId : null}
        mode={fileBrowserMode}
        sshConnectionId={fileBrowserSshId}
      />
    </>
  );
}

export default PanelManager;