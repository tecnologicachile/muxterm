/**
 * Integration test: spawn a real `tmux -CC` and verify the parser
 * processes its output without errors. Uses a dedicated tmux socket
 * (-L muxterm-test) so it doesn't touch any existing tmux server.
 *
 * Run with: node server/tmux-control/integration-test.js
 */

'use strict';

const { spawn: spawnChild } = require('node:child_process');
const pty = require('node-pty');
const { ControlModeLineBuffer } = require('./parser');

const SOCKET = 'muxterm-test';
const SESSION = 'pcm-integration-test';

function killExistingSession(cb) {
  const k = spawnChild('tmux', ['-L', SOCKET, 'kill-session', '-t', SESSION], { stdio: 'ignore' });
  k.on('close', () => cb());
}

function run() {
  killExistingSession(() => {
    console.log(`Spawning: tmux -L ${SOCKET} -CC new-session -A -s ${SESSION}`);

    // tmux -CC requires a controlling TTY. Use node-pty to give it one.
    const tmux = pty.spawn(
      'tmux',
      ['-L', SOCKET, '-CC', 'new-session', '-A', '-s', SESSION],
      { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.env.HOME, env: process.env },
    );

    const events = [];
    const eventCounts = {};

    const buffer = new ControlModeLineBuffer((event) => {
      events.push(event);
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });

    tmux.onData((chunk) => buffer.feed(chunk.toString()));

    // After ~1s send a refresh-client to force some output, then send a
    // simple command to the shell, then exit cleanly.
    setTimeout(() => {
      tmux.write('refresh-client -S\n');
    }, 1000);

    setTimeout(() => {
      tmux.write('display-message "hello from test"\n');
    }, 2000);

    setTimeout(() => {
      tmux.write('kill-session -t ' + SESSION + '\n');
    }, 3500);

    tmux.onExit((event) => {
      const code = event.exitCode;
      console.log('');
      console.log('=== tmux closed (exit code: ' + code + ') ===');
      console.log('');
      console.log('Events captured by type:');
      const sortedTypes = Object.keys(eventCounts).sort();
      for (const t of sortedTypes) {
        console.log('  ' + t.padEnd(25) + ' ' + eventCounts[t]);
      }
      console.log('');
      console.log('Total events: ' + events.length);

      // Sanity: we expect at least these notifications during a session
      // creation + simple commands + close.
      const required = ['begin', 'end', 'output', 'sessions-changed'];
      const missing = required.filter((t) => !eventCounts[t]);

      if (missing.length > 0) {
        console.error('');
        console.error('FAIL: missing expected event types: ' + missing.join(', '));
        process.exit(1);
      }

      // Show one sample %output to verify decoding worked
      const sampleOutput = events.find((e) => e.type === 'output');
      if (sampleOutput) {
        const preview = sampleOutput.data.length > 80
          ? sampleOutput.data.substring(0, 80) + '…'
          : sampleOutput.data;
        const escaped = preview
          .replace(/\x1b/g, '\\e')
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n');
        console.log('');
        console.log('Sample %output (' + sampleOutput.paneId + '): "' + escaped + '"');
      }

      // Show any unknown notifications — they're either harmless
      // or future extensions to add.
      const unknown = events.filter((e) => e.type === 'unknown');
      if (unknown.length > 0) {
        console.log('');
        console.log('Unknown notifications (' + unknown.length + '):');
        const seen = new Set();
        for (const e of unknown) {
          const head = e.raw.split(' ')[0];
          if (!seen.has(head)) {
            seen.add(head);
            console.log('  ' + head);
          }
        }
      }

      console.log('');
      console.log('PASS: parser processed real tmux -CC output successfully.');
      process.exit(0);
    });

    // Hard timeout
    setTimeout(() => {
      console.error('FAIL: timeout — tmux did not close within 6s');
      try { tmux.kill(); } catch (_) {}
      process.exit(2);
    }, 6000);
  });
}

run();
