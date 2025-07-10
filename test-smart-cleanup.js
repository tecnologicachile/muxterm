const io = require('socket.io-client');
const http = require('http');

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testSmartCleanup() {
  console.log('=== Testing SMART CLEANUP ===\n');
  
  // Login
  const loginData = await httpPost('http://127.0.0.1:3002/api/auth/login', {
    username: 'test',
    password: 'test123'
  });
  
  const { token, sessionId } = loginData;
  console.log('Logged in, sessionId:', sessionId);
  
  // Connect socket
  const socket = io('http://127.0.0.1:3002', {
    auth: { token }
  });
  
  await new Promise(resolve => socket.on('connect', resolve));
  console.log('Connected to socket\n');
  
  // Create terminal
  const terminalId = await new Promise(resolve => {
    socket.emit('create-terminal', { sessionId }, (response) => {
      console.log('Terminal created:', response.terminalId);
      resolve(response.terminalId);
    });
  });
  
  // Wait for prompt
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Execute some commands
  console.log('Executing commands...');
  socket.emit('terminal-input', { terminalId, input: 'echo "Command 1"\r' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  socket.emit('terminal-input', { terminalId, input: 'ls -la\r' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  socket.emit('terminal-input', { terminalId, input: 'echo "Command 2"\r' });
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Disconnect
  socket.disconnect();
  console.log('\nDisconnected. Reconnecting to trigger restoration...\n');
  
  // Reconnect
  const socket2 = io('http://127.0.0.1:3002', {
    auth: { token }
  });
  
  await new Promise(resolve => socket2.on('connect', resolve));
  console.log('Reconnected');
  
  // Restore terminal
  socket2.emit('restore-terminal', { terminalId }, (response) => {
    console.log('Terminal restored');
  });
  
  // Listen for buffer output
  socket2.on('terminal-output', (data) => {
    if (data.terminalId === terminalId) {
      console.log('\nReceived buffer output (length:', data.output.length, 'bytes)');
    }
  });
  
  // Wait and disconnect
  await new Promise(resolve => setTimeout(resolve, 2000));
  socket2.disconnect();
  
  console.log('\n✅ Test complete - check server logs for SMART CLEANUP messages');
}

testSmartCleanup().catch(console.error);