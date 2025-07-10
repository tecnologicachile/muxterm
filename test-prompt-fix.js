// Manual test to verify prompt fix
const io = require('socket.io-client');

async function testPromptFix() {
  console.log('=== Testing Prompt Fix ===\n');
  
  // Login first
  const loginResponse = await fetch('http://127.0.0.1:3002/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test', password: 'test123' })
  });
  
  const { token } = await loginResponse.json();
  console.log('✅ Logged in successfully\n');
  
  // Connect socket
  const socket = io('http://127.0.0.1:3002', {
    auth: { token }
  });
  
  return new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket\n');
      
      // Use existing session
      const sessionId = '8a248684-387f-4195-9dae-a52a90518a07';
      const terminalId = 'bf657e50-6933-42d5-baf3-2761577ba56a';
      
      let bufferReceived = false;
      
      socket.on('terminal-output', (data) => {
        if (data.terminalId === terminalId && !bufferReceived) {
          bufferReceived = true;
          const content = data.data;
          const prompts = (content.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []);
          console.log(`📊 Buffer Analysis:`);
          console.log(`   - Total buffer size: ${content.length} bytes`);
          console.log(`   - Number of prompts found: ${prompts.length}`);
          console.log(`   - First 200 chars: ${content.substring(0, 200).replace(/\n/g, '\\n')}`);
          console.log(`   - Last 200 chars: ${content.substring(content.length - 200).replace(/\n/g, '\\n')}`);
          
          if (prompts.length > 3) {
            console.log('\n❌ Issue still present: Multiple duplicate prompts detected');
          } else {
            console.log('\n✅ Fix appears to be working: Reasonable number of prompts');
          }
          
          socket.disconnect();
          resolve();
        }
      });
      
      socket.on('terminal-restored', (data) => {
        console.log(`✅ Terminal restored: ${data.terminalId}\n`);
      });
      
      socket.on('terminal-error', (error) => {
        console.error('❌ Terminal error:', error);
      });
      
      // Restore terminal
      console.log(`🔄 Restoring terminal ${terminalId}...`);
      socket.emit('restore-terminal', { terminalId, sessionId });
    });
  });
}

testPromptFix().catch(console.error);