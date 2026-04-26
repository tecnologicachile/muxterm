'use strict';

const assert = require('node:assert/strict');
const { parseLayout, listPaneIds } = require('./layout');

let n = 0, fails = 0;
function t(name, fn) {
  n++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.error('  FAIL ' + name + '\n        ' + e.message); }
}

console.log('parseLayout');

t('single pane with checksum and id', () => {
  const tree = parseLayout('abcd,80x24,0,0,1');
  assert.deepEqual(tree, { type: 'pane', id: '%1', cols: 80, rows: 24, x: 0, y: 0 });
});

t('single pane without checksum still parses', () => {
  // Children inside splits don't have checksums. We support that path
  // even at top-level just in case.
  const tree = parseLayout('80x24,0,0,3');
  assert.equal(tree.type, 'pane');
  assert.equal(tree.id, '%3');
});

t('vertical split (curly braces) two panes', () => {
  const tree = parseLayout('abcd,80x24,0,0{40x24,0,0,1,40x24,40,0,2}');
  assert.equal(tree.type, 'split');
  assert.equal(tree.orientation, 'v');
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].id, '%1');
  assert.equal(tree.children[1].id, '%2');
  assert.equal(tree.children[1].x, 40);
});

t('horizontal split (square brackets) two panes', () => {
  const tree = parseLayout('abcd,80x24,0,0[80x12,0,0,1,80x12,0,12,2]');
  assert.equal(tree.type, 'split');
  assert.equal(tree.orientation, 'h');
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].id, '%1');
  assert.equal(tree.children[1].id, '%2');
  assert.equal(tree.children[1].y, 12);
});

t('three-way vertical split', () => {
  const tree = parseLayout('abcd,90x24,0,0{30x24,0,0,1,30x24,30,0,2,30x24,60,0,3}');
  assert.equal(tree.children.length, 3);
  assert.deepEqual(listPaneIds(tree), ['%1', '%2', '%3']);
});

t('nested split: top + bottom-split-into-two', () => {
  const tree = parseLayout('abcd,80x24,0,0[80x12,0,0,1,80x12,0,12{40x12,0,12,2,40x12,40,12,3}]');
  assert.equal(tree.type, 'split');
  assert.equal(tree.orientation, 'h');
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].id, '%1');
  assert.equal(tree.children[1].type, 'split');
  assert.equal(tree.children[1].orientation, 'v');
  assert.deepEqual(listPaneIds(tree), ['%1', '%2', '%3']);
});

t('listPaneIds returns left-to-right top-to-bottom order', () => {
  const tree = parseLayout('abcd,80x24,0,0{40x24,0,0[40x12,0,0,1,40x12,0,12,2],40x24,40,0,3}');
  assert.deepEqual(listPaneIds(tree), ['%1', '%2', '%3']);
});

t('throws on malformed input', () => {
  assert.throws(() => parseLayout('not-a-layout'));
});

console.log('');
console.log(`${n - fails}/${n} tests passed${fails ? ` (${fails} failed)` : ''}`);
process.exit(fails ? 1 : 0);
