#!/bin/bash

echo "Testing MuxTerm with different log levels..."
echo "============================================"

# Test 1: Run with debug logs
echo -e "\n1. Testing with LOG_LEVEL=debug (all logs visible):"
echo "Starting server with debug logs..."
cd server
LOG_LEVEL=debug node index.js &
SERVER_PID=$!
sleep 2

echo "Starting client with debug logs..."
cd ../client
echo "VITE_LOG_LEVEL=debug" > .env
npm run dev &
CLIENT_PID=$!
sleep 3

echo "Server running on PID: $SERVER_PID"
echo "Client running on PID: $CLIENT_PID"
echo "Open http://localhost:5173 and test auto-yes with Claude CLI"
echo "You should see all debug logs in the browser console"
echo -e "\nPress Enter to continue to next test..."
read

# Kill processes
kill $CLIENT_PID $SERVER_PID
sleep 2

# Test 2: Run with error logs only (production mode)
echo -e "\n2. Testing with LOG_LEVEL=error (only errors visible):"
echo "Starting server with error logs only..."
cd ../server
LOG_LEVEL=error node index.js &
SERVER_PID=$!
sleep 2

echo "Starting client with error logs only..."
cd ../client
echo "VITE_LOG_LEVEL=error" > .env
npm run dev &
CLIENT_PID=$!
sleep 3

echo "Server running on PID: $SERVER_PID"
echo "Client running on PID: $CLIENT_PID"
echo "Open http://localhost:5173 and test auto-yes with Claude CLI"
echo "You should NOT see debug logs, only errors (if any)"
echo -e "\nPress Enter to stop all processes..."
read

# Cleanup
kill $CLIENT_PID $SERVER_PID
rm ../client/.env
echo -e "\nTest completed!"