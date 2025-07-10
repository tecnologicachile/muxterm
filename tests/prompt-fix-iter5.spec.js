const { test } = require('@playwright/test');
const io = require('socket.io-client');

test.describe('Prompt Fix - Iteration 5', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  
  test('Iteration 5: Debug cleanup execution', async () => {
    console.log('=== ITERATION 5: Debug cleanup execution ===');
    
    // Get auth
    const loginResponse = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test123' })
    });
    
    const { token } = await loginResponse.json();
    
    // Single connection to trigger cleanup
    const socket = io(serverUrl, { auth: { token } });
    
    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('Connected to server');
        
        socket.on('terminal-output', (data) => {
          console.log(`\nReceived terminal output:`);
          console.log(`  Terminal ID: ${data.terminalId}`);
          console.log(`  Buffer size: ${data.data.length} bytes`);
          
          const prompts = (data.data.match(/usuario@usuario/g) || []).length;
          console.log(`  Prompts found: ${prompts}`);
          
          setTimeout(() => {
            socket.disconnect();
            resolve();
          }, 500);
        });
        
        console.log('\nRestoring terminal bf657e50-6933-42d5-baf3-2761577ba56a...');
        socket.emit('restore-terminal', { 
          terminalId: 'bf657e50-6933-42d5-baf3-2761577ba56a',
          sessionId: '8a248684-387f-4195-9dae-a52a90518a07'
        });
      });
    });
    
    console.log('\n✅ Check server logs for [BUFFER CLEANUP] messages');
  });
});