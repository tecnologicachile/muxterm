// Test prompt fix with multiple refreshes
const io = require('socket.io-client');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMultipleRefreshes() {
  console.log('=== Testing Prompt Fix with Multiple Refreshes ===\n');
  
  // Login
  const loginResponse = await fetch('http://127.0.0.1:3002/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test', password: 'test123' })
  });
  
  const { token } = await loginResponse.json();
  console.log('✅ Logged in successfully\n');
  
  const sessionId = '8a248684-387f-4195-9dae-a52a90518a07';
  const terminalId = 'bf657e50-6933-42d5-baf3-2761577ba56a';
  
  // Test multiple connections
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Refresh ${i} ---`);
    
    const socket = io('http://127.0.0.1:3002', {
      auth: { token }
    });
    
    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('Connected to WebSocket');
        
        let bufferReceived = false;
        
        socket.on('terminal-output', (data) => {
          if (data.terminalId === terminalId && !bufferReceived) {
            bufferReceived = true;
            const content = data.data;
            console.log(`Buffer size: ${content.length} bytes`);
            
            // Count occurrences of common prompt patterns
            const pattern1 = (content.match(/usuario@usuario/g) || []).length;
            const pattern2 = (content.match(/\$ /g) || []).length;
            console.log(`Pattern matches: usuario@usuario: ${pattern1}, $: ${pattern2}`);
            
            setTimeout(() => {
              socket.disconnect();
              resolve();
            }, 500);
          }
        });
        
        socket.on('terminal-restored', () => {
          console.log('Terminal restored');
        });
        
        // Restore terminal
        socket.emit('restore-terminal', { terminalId, sessionId });
      });
    });
    
    await sleep(1000);
  }
  
  console.log('\n✅ Test completed. Buffer sizes should remain stable.');
}

testMultipleRefreshes().catch(console.error);