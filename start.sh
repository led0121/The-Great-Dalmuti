#!/bin/bash

# Kill any existing processes on ports 3000 (Server) and 5173 (Client)
echo "Cleaning up ports..."
fuser -k 3000/tcp > /dev/null 2>&1
fuser -k 18000/tcp > /dev/null 2>&1

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
