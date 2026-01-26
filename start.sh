#!/bin/bash

# The 586 Dynasty - Development Server Startup Script
# Run this script to start both backend and mobile servers

echo "🏈 Starting The 586 Dynasty Development Servers..."
echo ""

# Kill any existing node processes on our ports
echo "Cleaning up existing processes..."
taskkill //F //IM node.exe 2>/dev/null || true
sleep 2

# Start backend server
echo ""
echo "📡 Starting Backend API (port 3000)..."
cd "$(dirname "$0")/backend"
npm run dev &
BACKEND_PID=$!

# Wait for backend to initialize
sleep 3

# Start mobile/web server
echo ""
echo "📱 Starting Mobile/Web App (port 8082)..."
cd "$(dirname "$0")/mobile"
npx expo start --web --port 8082 &
MOBILE_PID=$!

echo ""
echo "✅ Servers starting..."
echo "   Backend API: http://localhost:3000"
echo "   Mobile/Web:  http://localhost:8082"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user interrupt
wait
