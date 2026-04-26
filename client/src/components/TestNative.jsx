/**
 * Experimental test page: a single TerminalNative attached to a custom
 * tmux session, using the new control-mode bridge. Reachable at
 * /test/native (router config is set up by the parent App).
 *
 * This page exists only on the experiment branch and is not part of the
 * regular MuxTerm UI. It's used to validate the control-mode integration
 * end-to-end without touching production flows.
 */

import React, { useState } from 'react';
import { Box, Button, TextField, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useSocket } from '../utils/SocketContext';
import TerminalNative from './TerminalNative';
import TerminalNativeMultiPane from './TerminalNativeMultiPane';

function TestNative() {
  const { socket } = useSocket();
  const [sessionName, setSessionName] = useState('muxterm-native-test');
  const [active, setActive] = useState(null);
  const [mode, setMode] = useState('multi'); // 'single' | 'multi'

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#000', color: '#0f0', p: 2 }}>
      <Typography variant="h6" sx={{ color: '#0f0', mb: 1 }}>
        TerminalNative test (tmux control mode)
      </Typography>
      <Typography variant="caption" sx={{ color: '#888', mb: 2 }}>
        Experimental. Spawns a real tmux session via tmux -CC. Wheel/swipe scrolls natively.
      </Typography>

      {!active && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            sx={{ bgcolor: '#111', '& input': { color: '#0f0' } }}
            label="tmux session name"
            InputLabelProps={{ sx: { color: '#888' } }}
          />
          <ToggleButtonGroup
            size="small"
            value={mode}
            exclusive
            onChange={(_e, v) => v && setMode(v)}
          >
            <ToggleButton value="single" sx={{ color: '#0f0', borderColor: '#0f0' }}>
              Single pane
            </ToggleButton>
            <ToggleButton value="multi" sx={{ color: '#0f0', borderColor: '#0f0' }}>
              Multi pane
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" onClick={() => setActive(sessionName)}>
            Attach
          </Button>
        </Box>
      )}

      {active && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Typography sx={{ color: '#0f0' }}>{active}</Typography>
          <Button size="small" onClick={() => setActive(null)}>Detach</Button>
        </Box>
      )}

      <Box sx={{ color: '#0ff', fontSize: '11px', mb: 1 }}>
      <Box data-test-mode={mode} data-test-active={active ? 'yes' : 'no'} sx={{ flex: 1, minHeight: 0, border: '1px solid #333' }}>
        {active && socket && mode === 'single' && (
          <TerminalNative
            socket={socket}
            sessionName={active}
            onExit={() => setActive(null)}
          />
        )}
        {active && socket && mode === 'multi' && (
          <TerminalNativeMultiPane
            socket={socket}
            sessionName={active}
            onExit={() => setActive(null)}
          />
        )}
      </Box>
    </Box>
  );
}

export default TestNative;
