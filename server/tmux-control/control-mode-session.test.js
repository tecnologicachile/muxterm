/**
 * Integration test: spawns a real tmux -CC session through
 * ControlModeSession and verifies the high-level events.
 *
 * Uses an isolated tmux socket (-L muxterm-test-cms) so it doesn't
 * collide with running MuxTerm.
 */

'use strict';

const { ControlModeSession } = require('./control-mode-session');
const { spawn } = require('node:child_process');

const SOCKET = 'muxterm-test-cms';
const SESSION = 'cms-test-' + process.pid;

function preCleanup(cb) {
  const k = spawn('tmux', ['-L', SOCKET, 'kill-server'], { stdio: 'ignore' });
  k.on('close', () => cb());
}

preCleanup(() => {
  console.log('Spawning ControlModeSession');

  const cms = new ControlModeSession({
    sessionName: SESSION,
    socket: SOCKET,
    cols: 80,
    rows: 24,
  });

  let outputCount = 0;
  let structureCount = 0;
  let unknownCount = 0;
  const seenPanes = new Set();
  const seenWindows = new Set();
  let exited = false;
  let exitCode = null;

  cms.on('output', (e) => {
    outputCount++;
    seenPanes.add(e.paneId);
  });

  cms.on('structure', (snap) => {
    structureCount++;
    for (const w of snap.windows) seenWindows.add(w.id);
  });

  cms.on('unknown', () => unknownCount++);

  cms.on('exit', (e) => {
    exited = true;
    exitCode = e.exitCode;
  });

  cms.start();

  // Drive a small scripted scenario.
  setTimeout(() => cms.writeToPane('%0', 'echo hello\n'), 500);
  setTimeout(() => cms.command('display-message "ping"'), 1500);
  setTimeout(() => cms.command('kill-session -t ' + SESSION), 2800);

  setTimeout(() => {
    console.log('');
    console.log('=== ControlModeSession results ===');
    console.log('output events:    ' + outputCount);
    console.log('structure events: ' + structureCount);
    console.log('unknown events:   ' + unknownCount);
    console.log('panes seen:       ' + Array.from(seenPanes).join(', '));
    console.log('windows seen:     ' + Array.from(seenWindows).join(', '));
    console.log('recent output:    ' + cms.recentOutput().length);
    console.log('exited:           ' + exited + (exitCode != null ? ' (code ' + exitCode + ')' : ''));

    let pass = true;
    if (outputCount === 0) { console.error('FAIL: no output events'); pass = false; }
    if (structureCount === 0) { console.error('FAIL: no structure events'); pass = false; }
    if (seenPanes.size === 0) { console.error('FAIL: no panes registered'); pass = false; }

    console.log('');
    console.log(pass ? 'PASS' : 'FAIL');
    process.exit(pass ? 0 : 1);
  }, 4500);
});
