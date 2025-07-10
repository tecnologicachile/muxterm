import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

function PanelLayout({ panels, activePanel, onPanelSelect, onPanelClose, renderPanel, layoutDirection = 'horizontal' }) {

  const renderPanelWithHeader = (panel) => {
    const isActive = panel.id === activePanel;

    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          border: isActive ? '2px solid #00ff00' : '1px solid #333',
          backgroundColor: '#000'
        }}
        onClick={() => onPanelSelect(panel.id)}
      >
        <Box className="panel-header">
          <Typography variant="caption" className="panel-title">
            Terminal {panels.indexOf(panel) + 1}
          </Typography>
          <div className="panel-actions">
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
                  '&:hover': { color: '#fff' }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </div>
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderPanel(panel)}
        </Box>
      </Box>
    );
  };

  if (panels.length === 0) {
    return null;
  }

  if (panels.length === 1) {
    return renderPanelWithHeader(panels[0]);
  }

  return (
    <PanelGroup direction={layoutDirection} style={{ height: '100%' }}>
      {panels.map((panel, index) => (
        <React.Fragment key={panel.id}>
          <Panel 
            id={`panel-${panel.id}`}
            order={index}
            defaultSize={100 / panels.length}
            minSize={10}
          >
            {renderPanelWithHeader(panel)}
          </Panel>
          {index < panels.length - 1 && (
            <PanelResizeHandle 
              style={{
                width: layoutDirection === 'horizontal' ? '4px' : '100%',
                height: layoutDirection === 'horizontal' ? '100%' : '4px',
                backgroundColor: '#333',
                cursor: layoutDirection === 'horizontal' ? 'col-resize' : 'row-resize',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#00ff00';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#333';
              }}
            />
          )}
        </React.Fragment>
      ))}
    </PanelGroup>
  );
}

export default PanelLayout;