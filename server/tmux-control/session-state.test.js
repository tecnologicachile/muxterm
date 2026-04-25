'use strict';

const assert = require('node:assert/strict');
const { SessionState } = require('./session-state');

let n = 0, fails = 0;
function t(name, fn) {
  n++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.error('  FAIL ' + name + '\n        ' + e.message); }
}

console.log('SessionState');

t('starts empty', () => {
  const s = new SessionState();
  const snap = s.snapshot();
  assert.equal(snap.sessions.length, 0);
  assert.equal(snap.windows.length, 0);
  assert.equal(snap.panes.length, 0);
});

t('session-changed registers the session', () => {
  const s = new SessionState();
  s.apply({ type: 'session-changed', sessionId: '$0', name: 'main' });
  assert.equal(s.activeSessionId, '$0');
  assert.equal(s.snapshot().sessions[0].name, 'main');
});

t('window-add registers the window', () => {
  const s = new SessionState();
  s.apply({ type: 'session-changed', sessionId: '$0', name: 'main' });
  s.apply({ type: 'window-add', windowId: '@0' });
  const snap = s.snapshot();
  assert.equal(snap.windows.length, 1);
  assert.equal(snap.windows[0].id, '@0');
  assert.equal(snap.windows[0].sessionId, '$0');
});

t('window-renamed updates name', () => {
  const s = new SessionState();
  s.apply({ type: 'window-add', windowId: '@0' });
  s.apply({ type: 'window-renamed', windowId: '@0', name: 'build' });
  assert.equal(s.snapshot().windows[0].name, 'build');
});

t('window-close removes window and its panes', () => {
  const s = new SessionState();
  s.apply({ type: 'session-changed', sessionId: '$0', name: 'm' });
  s.apply({ type: 'window-add', windowId: '@0' });
  s.activeWindowId = '@0';
  s.apply({ type: 'output', paneId: '%0', data: '' });
  s.apply({ type: 'output', paneId: '%1', data: '' });
  assert.equal(s.snapshot().panes.length, 2);
  s.apply({ type: 'window-close', windowId: '@0' });
  assert.equal(s.snapshot().windows.length, 0);
  assert.equal(s.snapshot().panes.length, 0);
});

t('layout-change updates window layout', () => {
  const s = new SessionState();
  s.apply({ type: 'window-add', windowId: '@0' });
  s.apply({ type: 'layout-change', windowId: '@0', layout: 'abcd,80x24,0,0,1', visibleLayout: 'abcd,80x24,0,0,1', flags: '*' });
  assert.equal(s.snapshot().windows[0].layout, 'abcd,80x24,0,0,1');
});

t('output registers pane under active window', () => {
  const s = new SessionState();
  s.apply({ type: 'session-changed', sessionId: '$0', name: 'm' });
  s.apply({ type: 'window-add', windowId: '@0' });
  s.activeWindowId = '@0';
  s.apply({ type: 'output', paneId: '%0', data: 'hi' });
  const snap = s.snapshot();
  assert.equal(snap.panes.length, 1);
  assert.equal(snap.panes[0].windowId, '@0');
  assert.equal(snap.windows[0].paneIds[0], '%0');
});

t('first output sets activePaneId', () => {
  const s = new SessionState();
  s.apply({ type: 'window-add', windowId: '@0' });
  s.activeWindowId = '@0';
  s.apply({ type: 'output', paneId: '%0', data: '' });
  assert.equal(s.activePaneId, '%0');
});

t('listeners called on structural events', () => {
  const s = new SessionState();
  const calls = [];
  s.on(c => calls.push(c.kind));
  s.apply({ type: 'window-add', windowId: '@0' });
  s.apply({ type: 'output', paneId: '%0', data: '' });    // not structural, no fire
  s.apply({ type: 'window-renamed', windowId: '@0', name: 'x' });
  assert.deepEqual(calls, ['window-add', 'window-renamed']);
});

t('off() unsubscribes', () => {
  const s = new SessionState();
  let fired = 0;
  const fn = () => fired++;
  s.on(fn);
  s.apply({ type: 'window-add', windowId: '@0' });
  s.off(fn);
  s.apply({ type: 'window-add', windowId: '@1' });
  assert.equal(fired, 1);
});

t('snapshot is a plain object (serializable)', () => {
  const s = new SessionState();
  s.apply({ type: 'session-changed', sessionId: '$0', name: 'm' });
  s.apply({ type: 'window-add', windowId: '@0' });
  const snap = s.snapshot();
  // Round-trip through JSON to confirm no Maps/Sets leak out
  const round = JSON.parse(JSON.stringify(snap));
  assert.equal(round.windows[0].id, '@0');
});

console.log('');
console.log(`${n - fails}/${n} tests passed${fails ? ` (${fails} failed)` : ''}`);
process.exit(fails ? 1 : 0);
