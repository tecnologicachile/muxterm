// Script to clean up problematic terminals
const terminalManager = require('./server/terminal');

console.log('Cleaning up terminals with duplicate prompts...');

// Get all terminals
const terminals = terminalManager.terminals;
console.log(`Found ${terminals.size} terminals`);

// Clean each terminal
for (const [id, terminal] of terminals) {
  if (terminal.buffer && terminal.buffer.length > 0) {
    const fullBuffer = terminal.buffer.join('');
    const prompts = (fullBuffer.match(/usuario@usuario/g) || []).length;
    
    console.log(`\nTerminal ${id}:`);
    console.log(`  Buffer size: ${fullBuffer.length} bytes`);
    console.log(`  Prompts found: ${prompts}`);
    
    if (prompts > 5) {
      console.log('  ⚠️ Too many prompts, cleaning buffer...');
      
      // Keep only the last 1KB of content
      const cleanBuffer = fullBuffer.slice(-1000);
      terminal.buffer = [cleanBuffer];
      
      console.log('  ✅ Buffer cleaned');
    }
  }
}

console.log('\nDone!');