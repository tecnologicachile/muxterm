// Direct test to force terminal cleanup
const terminalManager = require('./server/terminal');

console.log('=== Forcing terminal cleanup ===\n');

// Get the problematic terminal
const terminalId = 'bf657e50-6933-42d5-baf3-2761577ba56a';
const terminal = terminalManager.getTerminal(terminalId);

if (terminal) {
  const fullBuffer = terminal.buffer.join('');
  const prompts = (fullBuffer.match(/usuario@usuario/g) || []).length;
  
  console.log(`Terminal ${terminalId}:`);
  console.log(`  Current buffer size: ${fullBuffer.length} bytes`);
  console.log(`  Number of prompts: ${prompts}`);
  
  // Force cleanup
  console.log('\nForcing aggressive cleanup...');
  
  // Keep only last 500 bytes
  const cleanBuffer = fullBuffer.slice(-500);
  terminal.buffer = [cleanBuffer];
  
  const newPrompts = (cleanBuffer.match(/usuario@usuario/g) || []).length;
  console.log(`\nAfter cleanup:`);
  console.log(`  New buffer size: ${cleanBuffer.length} bytes`);
  console.log(`  Number of prompts: ${newPrompts}`);
  
  console.log('\n✅ Cleanup forced successfully');
} else {
  console.log('❌ Terminal not found');
}

// Do the same for the other terminal
const terminalId2 = 'b24ebce3-988c-47fe-8fa1-e6b75f7f1e6a';
const terminal2 = terminalManager.getTerminal(terminalId2);

if (terminal2) {
  const fullBuffer = terminal2.buffer.join('');
  const prompts = (fullBuffer.match(/usuario@usuario/g) || []).length;
  
  console.log(`\nTerminal ${terminalId2}:`);
  console.log(`  Current buffer size: ${fullBuffer.length} bytes`);
  console.log(`  Number of prompts: ${prompts}`);
  
  // Force cleanup
  const cleanBuffer = fullBuffer.slice(-500);
  terminal2.buffer = [cleanBuffer];
  
  const newPrompts = (cleanBuffer.match(/usuario@usuario/g) || []).length;
  console.log(`  After cleanup - size: ${cleanBuffer.length} bytes, prompts: ${newPrompts}`);
}