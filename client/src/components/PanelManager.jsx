import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { 
  Edit as EditIcon, 
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  CheckCircle as CheckCircleIcon 
} from '@mui/icons-material';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import Terminal from './Terminal';

function PanelManager({ panels, activePanel, onPanelSelect, onPanelClose, onTerminalCreated, onRenamePanel, onMinimizePanel, sessionId, onAutoYesLog }) {
  // Track auto-yes state for each panel
  const [autoYesStates, setAutoYesStates] = useState({});
  // For simplicity, we'll use a 2x2 grid layout
  // This allows up to 4 terminals in a grid pattern
  
  const renderTerminal = (panel) => {
    const isActive = panel.id === activePanel;
    console.log(`[PanelManager] Rendering terminal for panel ${panel.id}, terminalId: ${panel.terminalId}, active: ${isActive}`);
    
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
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={autoYesStates[panel.id] ? "Auto-Yes ON" : "Auto-Yes OFF"}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoYesStates(prev => ({
                    ...prev,
                    [panel.id]: !prev[panel.id]
                  }));
                }}
                sx={{ 
                  padding: '2px',
                  color: autoYesStates[panel.id] ? '#00ff00' : '#666',
                  '&:hover': { color: autoYesStates[panel.id] ? '#00ff00' : '#fff' }
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
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
          autoYes={autoYesStates[panel.id] || false}
          onClose={() => onPanelClose(panel.id)}
          onTerminalCreated={(newTerminalId) => {
            console.log(`[PanelManager] Terminal created callback - panelId: ${panel.id}, newTerminalId: ${newTerminalId}`);
            if (onTerminalCreated && !panel.terminalId) {
              onTerminalCreated(panel.id, newTerminalId);
            }
          }}
          onAutoYesLog={onAutoYesLog}
          panelId={panel.id}
        />
        </Box>
      </Box>
    );
  };

  if (panels.length === 0) return null;
  
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
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
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
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-1" minSize={30}>
              {renderTerminal(panels[1])}
            </Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
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
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-2" minSize={30}>
            {renderTerminal(panels[2])}
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
      <Panel id="panel-right-group" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-1" minSize={30}>
            {renderTerminal(panels[1])}
          </Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
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
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-1" minSize={30}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={20}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-3" minSize={20}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
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
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-1" minSize={20}>{renderTerminal(panels[1])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-2" minSize={20}>{renderTerminal(panels[2])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-right" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-3" minSize={20}>{renderTerminal(panels[3])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-4" minSize={20}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
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
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-1" minSize={30}>{renderTerminal(panels[1])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-center" minSize={20}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-2" minSize={30}>{renderTerminal(panels[2])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-3" minSize={30}>{renderTerminal(panels[3])}</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-right" minSize={20}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id="panel-4" minSize={20}>{renderTerminal(panels[4])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id="panel-5" minSize={20}>{renderTerminal(panels[5])}</Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
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
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-1" minSize={15}>{renderTerminal(panels[1])}</Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-2" minSize={15}>{renderTerminal(panels[2])}</Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-3" minSize={15}>{renderTerminal(panels[3])}</Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
      <Panel id="panel-right" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id="panel-4" minSize={15}>{renderTerminal(panels[4])}</Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-5" minSize={15}>{renderTerminal(panels[5])}</Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-6" minSize={15}>{renderTerminal(panels[6])}</Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id="panel-7" minSize={15}>{renderTerminal(panels[7])}</Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default PanelManager;