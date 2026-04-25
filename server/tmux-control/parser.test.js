/**
 * Tests for tmux control mode parser.
 * Run with: node server/tmux-control/parser.test.js
 *
 * Plain Node assertions — no test framework dependency, so this file can
 * run in any MuxTerm checkout without touching package.json. If the suite
 * grows we'll add a proper runner.
 */

'use strict';

const assert = require('node:assert/strict');
const {
  decodeTmuxOctal,
  encodeInputAsHex,
  parseControlLine,
  buildSendKeysCommands,
  ControlModeLineBuffer,
} = require('./parser');

let testCount = 0;
let failures = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`        ${e.message}`);
    if (e.expected !== undefined) {
      console.error(`        expected: ${JSON.stringify(e.expected)}`);
      console.error(`        actual:   ${JSON.stringify(e.actual)}`);
    }
  }
}

// --- decodeTmuxOctal -------------------------------------------------------

console.log('decodeTmuxOctal');

test('decodes ESC (\\033)', () => {
  assert.equal(decodeTmuxOctal('\\033[H'), '\x1b[H');
});

test('decodes CR and LF (\\015 \\012)', () => {
  assert.equal(decodeTmuxOctal('hi\\015\\012'), 'hi\r\n');
});

test('decodes backslash (\\134)', () => {
  assert.equal(decodeTmuxOctal('a\\134b'), 'a\\b');
});

test('passes plain ASCII through', () => {
  assert.equal(decodeTmuxOctal('plain text'), 'plain text');
});

test('handles multiple escapes in one string', () => {
  assert.equal(decodeTmuxOctal('\\033[31mred\\033[0m'), '\x1b[31mred\x1b[0m');
});

// --- encodeInputAsHex ------------------------------------------------------

console.log('encodeInputAsHex');

test('encodes ASCII letters', () => {
  assert.equal(encodeInputAsHex('abc'), '61 62 63');
});

test('encodes Enter as 0a', () => {
  assert.equal(encodeInputAsHex('\n'), '0a');
});

test('encodes ESC as 1b', () => {
  assert.equal(encodeInputAsHex('\x1b'), '1b');
});

test('returns empty string for empty input', () => {
  assert.equal(encodeInputAsHex(''), '');
});

// --- parseControlLine — base events ----------------------------------------

console.log('parseControlLine — base events from clsh');

test('%output with simple text', () => {
  const e = parseControlLine('%output %0 hello');
  assert.deepEqual(e, { type: 'output', paneId: '%0', data: 'hello' });
});

test('%output decodes octal', () => {
  const e = parseControlLine('%output %3 \\033[H\\033[J');
  assert.deepEqual(e, { type: 'output', paneId: '%3', data: '\x1b[H\x1b[J' });
});

test('%begin parsed', () => {
  const e = parseControlLine('%begin 1700000000 42 1');
  assert.deepEqual(e, { type: 'begin', timestamp: 1700000000, cmdNumber: 42 });
});

test('%end parsed', () => {
  const e = parseControlLine('%end 1700000001 42 0');
  assert.deepEqual(e, { type: 'end', timestamp: 1700000001, cmdNumber: 42 });
});

test('%error parsed', () => {
  const e = parseControlLine('%error 1700000002 99 1');
  assert.deepEqual(e, { type: 'error', timestamp: 1700000002, cmdNumber: 99 });
});

test('%exit parsed', () => {
  assert.deepEqual(parseControlLine('%exit'), { type: 'exit' });
});

test('non-% line returns null', () => {
  assert.equal(parseControlLine('plain output'), null);
});

// --- parseControlLine — MuxTerm extensions ---------------------------------

console.log('parseControlLine — MuxTerm extensions');

test('%session-changed parsed', () => {
  const e = parseControlLine('%session-changed $0 main');
  assert.deepEqual(e, { type: 'session-changed', sessionId: '$0', name: 'main' });
});

test('%session-changed with name containing spaces', () => {
  const e = parseControlLine('%session-changed $1 my session');
  assert.deepEqual(e, { type: 'session-changed', sessionId: '$1', name: 'my session' });
});

test('%sessions-changed (no args)', () => {
  assert.deepEqual(parseControlLine('%sessions-changed'), { type: 'sessions-changed' });
});

test('%window-add parsed', () => {
  assert.deepEqual(parseControlLine('%window-add @0'), { type: 'window-add', windowId: '@0' });
});

test('%unlinked-window-add parsed', () => {
  assert.deepEqual(
    parseControlLine('%unlinked-window-add @5'),
    { type: 'unlinked-window-add', windowId: '@5' },
  );
});

test('%window-close parsed', () => {
  assert.deepEqual(parseControlLine('%window-close @3'), { type: 'window-close', windowId: '@3' });
});

test('%window-renamed parsed', () => {
  assert.deepEqual(
    parseControlLine('%window-renamed @0 build'),
    { type: 'window-renamed', windowId: '@0', name: 'build' },
  );
});

test('%window-renamed with multi-word name', () => {
  assert.deepEqual(
    parseControlLine('%window-renamed @2 my new name'),
    { type: 'window-renamed', windowId: '@2', name: 'my new name' },
  );
});

test('%layout-change with full args', () => {
  assert.deepEqual(
    parseControlLine('%layout-change @0 abcd,80x24,0,0,1 abcd,80x24,0,0,1 *'),
    {
      type: 'layout-change',
      windowId: '@0',
      layout: 'abcd,80x24,0,0,1',
      visibleLayout: 'abcd,80x24,0,0,1',
      flags: '*',
    },
  );
});

test('%layout-change with partial args', () => {
  assert.deepEqual(
    parseControlLine('%layout-change @0 abcd,80x24,0,0,1'),
    {
      type: 'layout-change',
      windowId: '@0',
      layout: 'abcd,80x24,0,0,1',
      visibleLayout: null,
      flags: null,
    },
  );
});

test('%client-detached parsed', () => {
  assert.deepEqual(parseControlLine('%client-detached /dev/pts/3'), {
    type: 'client-detached',
    client: '/dev/pts/3',
  });
});

test('unknown %-notification → type=unknown', () => {
  const e = parseControlLine('%totally-new-event foo bar');
  assert.equal(e.type, 'unknown');
  assert.equal(e.raw, '%totally-new-event foo bar');
});

// --- buildSendKeysCommands -------------------------------------------------

console.log('buildSendKeysCommands');

test('single command for short input', () => {
  const cmds = buildSendKeysCommands('myses', 'ls\n');
  assert.deepEqual(cmds, ['send-keys -t myses -H 6c 73 0a']);
});

test('chunks long input into multiple commands', () => {
  const longInput = 'a'.repeat(600);
  const cmds = buildSendKeysCommands('s', longInput);
  assert.equal(cmds.length, 2);
  assert.ok(cmds[0].startsWith('send-keys -t s -H'));
});

test('returns empty array for empty input', () => {
  assert.deepEqual(buildSendKeysCommands('s', ''), []);
});

// --- ControlModeLineBuffer -------------------------------------------------

console.log('ControlModeLineBuffer');

test('emits one event per complete line', () => {
  const events = [];
  const buf = new ControlModeLineBuffer(e => events.push(e));
  buf.feed('%begin 100 1 0\n%end 101 1 0\n');
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'begin');
  assert.equal(events[1].type, 'end');
});

test('holds incomplete line until next feed', () => {
  const events = [];
  const buf = new ControlModeLineBuffer(e => events.push(e));
  buf.feed('%output %0 hel');
  assert.equal(events.length, 0);
  buf.feed('lo\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].data, 'hello');
});

test('handles \\r\\n line endings', () => {
  const events = [];
  const buf = new ControlModeLineBuffer(e => events.push(e));
  buf.feed('%exit\r\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'exit');
});

test('ignores empty lines', () => {
  const events = [];
  const buf = new ControlModeLineBuffer(e => events.push(e));
  buf.feed('\n\n%exit\n\n');
  assert.equal(events.length, 1);
});

test('reset() drops partial line', () => {
  const events = [];
  const buf = new ControlModeLineBuffer(e => events.push(e));
  buf.feed('%begin 1 1 0');
  buf.reset();
  buf.feed(' ignored-prefix\n%exit\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'exit');
});

// --- summary ---------------------------------------------------------------

console.log('');
console.log(`${testCount - failures}/${testCount} tests passed${failures ? ` (${failures} failed)` : ''}`);
process.exit(failures ? 1 : 0);
