import React, { useState } from 'react';
import { Box } from '@mui/material';

const KEY_GROUPS = [
  // Modifiers (toggle)
  { label: 'Ctrl', type: 'modifier', key: 'ctrl' },
  { label: 'Alt', type: 'modifier', key: 'alt' },
  // Common Ctrl combos
  { label: 'C-c', type: 'combo', seq: '\x03' },
  { label: 'C-d', type: 'combo', seq: '\x04' },
  { label: 'C-z', type: 'combo', seq: '\x1a' },
  { label: 'C-l', type: 'combo', seq: '\x0c' },
  // Action keys
  { label: 'Esc', type: 'action', seq: '\x1b' },
  { label: 'Tab', type: 'action', seq: '\t' },
  // Arrow keys
  { label: '\u2191', type: 'action', seq: '\x1b[A' },
  { label: '\u2193', type: 'action', seq: '\x1b[B' },
  { label: '\u2190', type: 'action', seq: '\x1b[D' },
  { label: '\u2192', type: 'action', seq: '\x1b[C' },
  // Symbols hard to reach on mobile
  { label: '|', type: 'action', seq: '|' },
  { label: '~', type: 'action', seq: '~' },
  { label: '`', type: 'action', seq: '`' },
  { label: '\\', type: 'action', seq: '\\' },
  { label: '{', type: 'action', seq: '{' },
  { label: '}', type: 'action', seq: '}' },
  { label: '[', type: 'action', seq: '[' },
  { label: ']', type: 'action', seq: ']' },
  { label: '/', type: 'action', seq: '/' },
  { label: '-', type: 'action', seq: '-' },
  { label: '_', type: 'action', seq: '_' },
];

function SpecialKeysToolbar({ onKeyPress, isVisible, onDismissKeyboard }) {
  const [activeModifiers, setActiveModifiers] = useState({ ctrl: false, alt: false });

  if (!isVisible) return null;

  const handleKey = (keyDef) => {
    if (keyDef.type === 'modifier') {
      setActiveModifiers(prev => ({ ...prev, [keyDef.key]: !prev[keyDef.key] }));
      return;
    }

    let seq = keyDef.seq;

    // Apply modifiers for regular action keys (single char)
    if (activeModifiers.ctrl && seq.length === 1) {
      const code = seq.toUpperCase().charCodeAt(0) - 64;
      if (code > 0 && code < 32) {
        seq = String.fromCharCode(code);
      }
    }

    onKeyPress(seq);

    // Clear modifiers after use
    setActiveModifiers({ ctrl: false, alt: false });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        overflowX: 'auto',
        backgroundColor: '#111',
        borderTop: '1px solid #333',
        padding: '4px 6px',
        gap: '4px',
        minHeight: '36px',
        alignItems: 'center',
        WebkitOverflowScrolling: 'touch',
        '&::-webkit-scrollbar': { height: '2px' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: '#555' }
      }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Dismiss keyboard button */}
      {onDismissKeyboard && (
        <Box
          onClick={onDismissKeyboard}
          sx={{
            minWidth: '36px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            mr: '4px',
            '&:active': { backgroundColor: '#555' }
          }}
        >
          ⌨↓
        </Box>
      )}
      {KEY_GROUPS.map((keyDef, idx) => {
        const isModActive = keyDef.type === 'modifier' && activeModifiers[keyDef.key];
        return (
          <Box
            key={idx}
            onClick={() => handleKey(keyDef)}
            sx={{
              minWidth: keyDef.label.length > 2 ? '40px' : '32px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isModActive ? '#00ff00' : '#222',
              color: isModActive ? '#000' : '#ccc',
              border: '1px solid',
              borderColor: isModActive ? '#00ff00' : '#444',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: '"Fira Code", "Courier New", monospace',
              fontWeight: isModActive ? 'bold' : 'normal',
              cursor: 'pointer',
              flexShrink: 0,
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              '&:active': {
                backgroundColor: isModActive ? '#00cc00' : '#444',
              }
            }}
          >
            {keyDef.label}
          </Box>
        );
      })}
    </Box>
  );
}

export default SpecialKeysToolbar;
