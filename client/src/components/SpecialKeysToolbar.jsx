import React, { useState } from 'react';
import { Box } from '@mui/material';

const TERMINAL_KEYS = [
  { label: 'Ctrl', type: 'modifier', key: 'ctrl' },
  { label: 'Alt', type: 'modifier', key: 'alt' },
  { label: 'C-c', type: 'combo', seq: '\x03' },
  { label: 'C-d', type: 'combo', seq: '\x04' },
  { label: 'C-z', type: 'combo', seq: '\x1a' },
  { label: 'C-l', type: 'combo', seq: '\x0c' },
  { label: 'Esc', type: 'action', seq: '\x1b' },
  { label: 'Tab', type: 'action', seq: '\t' },
  { label: '\u2191', type: 'action', seq: '\x1b[A' },
  { label: '\u2193', type: 'action', seq: '\x1b[B' },
  { label: '\u2190', type: 'action', seq: '\x1b[D' },
  { label: '\u2192', type: 'action', seq: '\x1b[C' },
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

const RDP_KEYS = [
  { label: '⌨️', type: 'keyboard' },
  { label: 'Ctrl', type: 'modifier', key: 'ctrl', keysym: 0xFFE3 },
  { label: 'Alt', type: 'modifier', key: 'alt', keysym: 0xFFE9 },
  { label: 'Esc', type: 'guac', keysym: 0xFF1B },
  { label: 'Tab', type: 'guac', keysym: 0xFF09 },
  { label: 'Del', type: 'guac', keysym: 0xFFFF },
  { label: 'Win', type: 'guac', keysym: 0xFFEB },
  { label: '\u2191', type: 'guac', keysym: 0xFF52 },
  { label: '\u2193', type: 'guac', keysym: 0xFF54 },
  { label: '\u2190', type: 'guac', keysym: 0xFF51 },
  { label: '\u2192', type: 'guac', keysym: 0xFF53 },
  { label: 'F5', type: 'guac', keysym: 0xFFC2 },
  { label: 'F11', type: 'guac', keysym: 0xFFC8 },
  { label: '|', type: 'guac', keysym: 0x007C },
  { label: '~', type: 'guac', keysym: 0x007E },
  { label: '`', type: 'guac', keysym: 0x0060 },
  { label: '\\', type: 'guac', keysym: 0x005C },
  { label: '{', type: 'guac', keysym: 0x007B },
  { label: '}', type: 'guac', keysym: 0x007D },
  { label: '[', type: 'guac', keysym: 0x005B },
  { label: ']', type: 'guac', keysym: 0x005D },
];

function SpecialKeysToolbar({ onKeyPress, onGuacKey, onToggleKeyboard, isVisible, panelType }) {
  const [activeModifiers, setActiveModifiers] = useState({ ctrl: false, alt: false });

  if (!isVisible) return null;

  const isGuacMode = panelType === 'rdp' || panelType === 'vnc';
  const keys = isGuacMode ? RDP_KEYS : TERMINAL_KEYS;

  const handleKey = (keyDef) => {
    if (keyDef.type === 'keyboard') {
      if (onToggleKeyboard) onToggleKeyboard();
      return;
    }

    if (keyDef.type === 'modifier') {
      setActiveModifiers(prev => ({ ...prev, [keyDef.key]: !prev[keyDef.key] }));
      return;
    }

    if (isGuacMode && onGuacKey) {
      // Send modifier keys down, then the key, then modifiers up
      const mods = [];
      if (activeModifiers.ctrl) mods.push(0xFFE3);
      if (activeModifiers.alt) mods.push(0xFFE9);
      onGuacKey(keyDef.keysym, mods);
      setActiveModifiers({ ctrl: false, alt: false });
      return;
    }

    // Terminal mode
    let seq = keyDef.seq;
    if (activeModifiers.ctrl && seq.length === 1) {
      const code = seq.toUpperCase().charCodeAt(0) - 64;
      if (code > 0 && code < 32) {
        seq = String.fromCharCode(code);
      }
    }
    onKeyPress(seq);
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
      {keys.map((keyDef, idx) => {
        const isModActive = keyDef.type === 'modifier' && activeModifiers[keyDef.key];
        return (
          <Box
            key={idx}
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => { e.preventDefault(); handleKey(keyDef); }}
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
