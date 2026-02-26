#!/bin/bash

# Kill any existing processes on ports 3000 and 18000
echo "Cleaning up ports..."
kill_port() {
    local port=$1
    command -v fuser &>/dev/null && fuser -k ${port}/tcp > /dev/null 2>&1 || true
    command -v lsof &>/dev/null && lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null || true
    if command -v ss &>/dev/null; then
        ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u | xargs kill -9 2>/dev/null || true
    fi
}
kill_port 3000
kill_port 18000
sleep 3

echo "Starting Great Dalmuti Game..."

# Start Server
echo "Starting Server..."
cd server
npm start &
SERVER_PID=$!
cd ..

# Wait for server to initialize
sleep 2

# Start Client
echo "Starting Client..."
cd client
HOST=0.0.0.0 npm run dev -- --host --port 18000 &
CLIENT_PID=$!
cd ..

echo "Game started!"
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo "Press Ctrl+C to stop both."

# Function to kill processes on exit
cleanup() {
    echo "Stopping processes..."
    kill $SERVER_PID
    kill $CLIENT_PID
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

# Keep script running to maintain processes
wait
