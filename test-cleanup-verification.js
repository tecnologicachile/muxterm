// Quick test to verify cleanup is working
const io = require('socket.io-client');

async function testCleanup() {
  console.log('=== Testing cleanup after server restart ===\n');
  
  // Login
  const loginResponse = await fetch('http://127.0.0.1:3002/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test', password: 'test123' })
  });
  
  const { token } = await loginResponse.json();
  console.log('✅ Logged in\n');
  
  // Connect and restore terminal
  const socket = io('http://127.0.0.1:3002', { auth: { token } });
  
  await new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('Connected to server');
      
      socket.on('terminal-output', (data) => {
        const prompts = (data.data.match(/usuario@usuario/g) || []).length;
        console.log(`\nTerminal output received:`);
        console.log(`  Buffer size: ${data.data.length} bytes`);
        console.log(`  Prompts found: ${prompts}`);
        
        if (prompts <= 3) {
          console.log('\n✅ SUCCESS: Cleanup is working! Prompts reduced to ${prompts}');
        } else {
          console.log('\n⚠️  Still have ${prompts} prompts, but check server logs for cleanup messages');
        }
        
        socket.disconnect();
        resolve();
      });
      
      // Restore the problematic terminal
      socket.emit('restore-terminal', {
        terminalId: 'bf657e50-6933-42d5-baf3-2761577ba56a',
        sessionId: '8a248684-387f-4195-9dae-a52a90518a07'
      });
    });
  });
  
  console.log('\n✅ Test completed. Check server terminal for [AGGRESSIVE CLEANUP] messages.');
}

testCleanup().catch(console.error);