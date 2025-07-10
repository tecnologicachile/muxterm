import React, { useRef, useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import Terminal from './Terminal';

function PersistentTerminalManager({ panels, activePanel, onPanelSelect, onPanelClose, onTerminalCreated, sessionId }) {
  // Keep track of which terminals have been created
  const terminalsRef = useRef(new Set());
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Track created terminals
  useEffect(() => {
    panels.forEach(panel => {
      if (!terminalsRef.current.has(panel.id)) {
        console.log(`[PersistentTerminalManager] New panel detected: ${panel.id}`);
        terminalsRef.current.add(panel.id);
      }
    });
    
    // Remove terminals that are no longer in panels
    const currentPanelIds = new Set(panels.map(p => p.id));
    terminalsRef.current.forEach(id => {
      if (!currentPanelIds.has(id)) {
        console.log(`[PersistentTerminalManager] Removing terminal: ${id}`);
        terminalsRef.current.delete(id);
      }
    });
  }, [panels]);
  
  const renderTerminal = (panel) => {
    const isActive = panel.id === activePanel;
    
    return (
      <Box
        key={`panel-box-${panel.id}`}
        sx={{
          height: '100%',
          width: '100%',
          border: isActive ? '2px solid #00ff00' : '1px solid #333',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={() => onPanelSelect(panel.id)}
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
  };

  if (panels.length === 0) return null;
  
  // Always use consistent structure
  if (panels.length === 1) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id={`panel-${panels[0].id}`} minSize={100}>
          {renderTerminal(panels[0])}
        </Panel>
      </PanelGroup>
    );
  }
  
  if (panels.length === 2) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id={`panel-${panels[0].id}`} minSize={30}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id={`panel-${panels[1].id}`} minSize={30}>
          {renderTerminal(panels[1])}
        </Panel>
      </PanelGroup>
    );
  }
  
  // 3 or 4 panels - use grid layout
  if (panels.length === 3) {
    return (
      <PanelGroup direction="horizontal" style={{ height: '100%' }}>
        <Panel id={`panel-left-${panels[0].id}`} minSize={30}>
          {renderTerminal(panels[0])}
        </Panel>
        <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
        <Panel id="panel-right-group" minSize={30}>
          <PanelGroup direction="vertical" style={{ height: '100%' }}>
            <Panel id={`panel-tr-${panels[1].id}`} minSize={30}>
              {renderTerminal(panels[1])}
            </Panel>
            <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
            <Panel id={`panel-br-${panels[2].id}`} minSize={30}>
              {renderTerminal(panels[2])}
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  }
  
  // 4 panels in 2x2 grid
  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      <Panel id="panel-left-group" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id={`panel-tl-${panels[0].id}`} minSize={30}>
            {renderTerminal(panels[0])}
          </Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id={`panel-bl-${panels[2].id}`} minSize={30}>
            {renderTerminal(panels[2])}
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle style={{ width: '4px', backgroundColor: '#333' }} />
      <Panel id="panel-right-group" minSize={30}>
        <PanelGroup direction="vertical" style={{ height: '100%' }}>
          <Panel id={`panel-tr-${panels[1].id}`} minSize={30}>
            {renderTerminal(panels[1])}
          </Panel>
          <PanelResizeHandle style={{ height: '4px', backgroundColor: '#333' }} />
          <Panel id={`panel-br-${panels[3].id}`} minSize={30}>
            {renderTerminal(panels[3])}
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default PersistentTerminalManager;