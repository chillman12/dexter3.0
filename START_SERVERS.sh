#!/bin/bash
# DEXTER 3.0 - Quick Start Script

echo "🚀 Starting DEXTER v3.0 Trading Platform..."
echo ""

# Start the backend server
echo "📦 Starting Rust backend server..."
cd /mnt/c/Users/Corey/des/dexter3.0/backend
RUST_LOG=info cargo run --bin dexter-simple &
BACKEND_PID=$!
echo "✅ Backend starting on ports 3001 (REST) and 3002 (WebSocket)..."

# Wait for backend to start
sleep 5

# Start the frontend server
echo ""
echo "🎨 Starting Next.js frontend..."
cd /mnt/c/Users/Corey/des/dexter3.0/frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend starting on port 3000..."

echo ""
echo "============================================"
echo "🎉 DEXTER v3.0 is starting up!"
echo "============================================"
echo ""
echo "📡 Access Points:"
echo "   • Frontend UI:     http://localhost:3000"
echo "   • REST API:        http://localhost:3001"
echo "   • WebSocket Feed:  ws://localhost:3002/ws"
echo "   • Health Check:    http://localhost:3001/api/health"
echo ""
echo "🛑 To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "💡 Note: Backend is running in simplified mode without Solana dependencies"