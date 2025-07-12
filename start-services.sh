#!/bin/bash

# Kill any existing processes
pkill -f "node server" || true
pkill -f vite || true
sleep 2

# Start server with debug logging
echo "Starting server with debug logging..."
export LOG_LEVEL=debug
node server/index.js > server.log 2>&1 &
SERVER_PID=$!

# Start client
echo "Starting client..."
cd client
npm start > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"

# Wait for services to be ready
echo "Waiting for services..."
for i in {1..20}; do
  if curl -s http://localhost:3002/api/auth/verify >/dev/null 2>&1 && curl -s http://localhost:3003 >/dev/null 2>&1; then
    echo "Services are ready!"
    break
  fi
  sleep 1
done

echo "You can now test F5 recovery at http://localhost:3003"
echo "Watch server logs with: tail -f server.log | grep -i debug"
echo "Kill services with: kill $SERVER_PID $CLIENT_PID"