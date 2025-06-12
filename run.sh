#!/bin/bash

echo "🚀 Starting RetroBBS SaaS Application..."
echo "📍 Make sure you're in the project directory"
echo ""

# Check if we're in the right place
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found. Make sure you're in the project root."
    exit 1
fi

echo "🔧 Server Configuration:"
echo "   Port: 3000"
echo "   Frontend: ./frontend/"
echo "   Backend: ./server.js"
echo ""

echo "🌐 Starting server..."
echo "   Frontend: http://localhost:3000"
echo "   API Status: http://localhost:3000/api/status"
echo "   System Stats: http://localhost:3000/api/stats"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.js