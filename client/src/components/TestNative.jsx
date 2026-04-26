/**
 * Test page for the new TerminalNative (Option A).
 * Reachable at /test/native (route added in App.jsx). Lets you attach
 * to any tmux session by name and exercise the new stack end-to-end.
 *
 * Not part of the regular MuxTerm UI — only present in the experiment
 * branch for validation.
 */

import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useSocket } from '../utils/SocketContext';
import TerminalNative from './TerminalNative';

function TestNative() {
  const { socket } = useSocket();
  const [sessionName, setSessionName] = useState('muxterm-native-test');
  const [active, setActive] = useState(null);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#000', color: '#0f0', p: 2 }}>
      <Typography variant="h6" sx={{ color: '#0f0', mb: 1 }}>
        TerminalNative test (Option A — attach-session direct)
      </Typography>
      <Typography variant="caption" sx={{ color: '#888', mb: 2 }}>
        xterm.js direct in React + node-pty + tmux attach-session. Wheel/swipe scrolls
        natively. Scrollback pre-loaded on connect via tmux capture-pane.
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

      <Box sx={{ flex: 1, minHeight: 0, border: '1px solid #333' }}>
        {active && socket && (
          <TerminalNative
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
