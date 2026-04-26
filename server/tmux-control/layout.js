/**
 * Parser for tmux layout strings.
 *
 * tmux exposes the geometry of a window as a compact string. Format,
 * recursive:
 *
 *   <checksum>,<cols>x<rows>,<x>,<y>          → leaf pane (just one)
 *   <checksum>,<cols>x<rows>,<x>,<y>,<paneN>  → leaf pane with id
 *   <cols>x<rows>,<x>,<y>{<child1>,<child2>…} → vertical split (panes side by side)
 *   <cols>x<rows>,<x>,<y>[<child1>,<child2>…] → horizontal split (panes stacked)
 *
 * Examples seen on real tmux:
 *   abcd,80x24,0,0,1
 *     One pane, 80×24, top-left at (0,0), pane id %1
 *
 *   abcd,80x24,0,0{40x24,0,0,1,40x24,40,0,2}
 *     Window split vertically: left half = pane %1, right half = pane %2
 *
 *   abcd,80x24,0,0[80x12,0,0,1,80x12,0,12,2]
 *     Window split horizontally: top half = pane %1, bottom half = pane %2
 *
 *   abcd,80x24,0,0[80x12,0,0,1,80x12,0,12{40x12,0,12,2,40x12,40,12,3}]
 *     Top half = pane %1; bottom half is split vertically into %2 and %3.
 *
 * Output of parseLayout(s) is a tree:
 *   { type: 'pane', id: '%1', cols, rows, x, y }
 *   { type: 'split', orientation: 'h' | 'v', cols, rows, x, y, children: [...] }
 *
 * The leading <checksum> on the very first leaf is consumed silently. We
 * don't validate it.
 */

'use strict';

/**
 * Cursor state for the recursive parser.
 */
class Cursor {
  constructor(s) { this.s = s; this.i = 0; }
  peek() { return this.s[this.i]; }
  eat(ch) {
    if (this.s[this.i] !== ch) {
      throw new Error(`expected '${ch}' at ${this.i}, got '${this.s[this.i]}'`);
    }
    this.i++;
  }
  eof() { return this.i >= this.s.length; }
  /** Consume and return characters while pred(ch) is true. */
  takeWhile(pred) {
    let out = '';
    while (this.i < this.s.length && pred(this.s[this.i])) out += this.s[this.i++];
    return out;
  }
}

const isDigit = (ch) => ch >= '0' && ch <= '9';

function readDims(c) {
  const cols = parseInt(c.takeWhile(isDigit), 10);
  c.eat('x');
  const rows = parseInt(c.takeWhile(isDigit), 10);
  return { cols, rows };
}

function readInt(c) {
  return parseInt(c.takeWhile(isDigit), 10);
}

/**
 * Parse one node (pane or split) starting at the cursor.
 * The optional leading checksum (4 hex chars) on the very first node is
 * already eaten by parseLayout() before calling readNode().
 */
function readNode(c) {
  const { cols, rows } = readDims(c);
  c.eat(',');
  const x = readInt(c);
  c.eat(',');
  const y = readInt(c);

  if (c.peek() === '{' || c.peek() === '[') {
    const open = c.peek();
    const orientation = open === '{' ? 'v' : 'h';
    const close = open === '{' ? '}' : ']';
    c.eat(open);
    const children = [readNode(c)];
    while (c.peek() === ',') {
      c.eat(',');
      // Children inside a split don't have leading checksums.
      children.push(readNode(c));
    }
    c.eat(close);
    return { type: 'split', orientation, cols, rows, x, y, children };
  }

  // Leaf pane: optionally followed by `,<paneIndex>`.
  let id = null;
  if (c.peek() === ',') {
    c.eat(',');
    const idx = c.takeWhile(isDigit);
    if (idx) id = '%' + idx;
  }
  return { type: 'pane', id, cols, rows, x, y };
}

/**
 * Parse a tmux layout string into a tree.
 * @param {string} s
 * @returns {object} layout tree
 */
function parseLayout(s) {
  if (typeof s !== 'string' || !s) throw new Error('parseLayout: empty input');
  const c = new Cursor(s);
  // Optional leading checksum (4 hex chars then comma) on the outer-most
  // layout. tmux always emits it on the top-level layout but not on
  // nested children.
  // The shape of a checksum is exactly 4 hex digits before the first comma.
  const isHex = (ch) => (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  if (
    isHex(c.s[0]) && isHex(c.s[1]) && isHex(c.s[2]) && isHex(c.s[3]) && c.s[4] === ','
  ) {
    c.i = 5; // skip "<hhhh>,"
  }
  const node = readNode(c);
  if (!c.eof()) {
    // Some tmux versions emit a trailing flag (e.g. " *"). Ignore.
  }
  return node;
}

/**
 * Walk the tree and collect leaf pane ids in left-to-right, top-to-bottom
 * order. Useful when you want to enumerate all panes regardless of nesting.
 */
function listPaneIds(node, out) {
  if (!out) out = [];
  if (!node) return out;
  if (node.type === 'pane') {
    if (node.id) out.push(node.id);
  } else if (node.type === 'split') {
    for (const c of node.children) listPaneIds(c, out);
  }
  return out;
}

module.exports = { parseLayout, listPaneIds };
