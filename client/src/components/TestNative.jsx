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
        TerminalNative test (tmux control mode)
      </Typography>
      <Typography variant="caption" sx={{ color: '#888', mb: 2 }}>
        Experimental. Spawns a real tmux session via tmux -CC. Wheel/swipe scrolls natively.
      </Typography>

      {!active && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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
