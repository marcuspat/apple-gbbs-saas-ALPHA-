#!/bin/bash

# RetroBBS SaaS Startup Script

echo "🚀 Starting RetroBBS SaaS Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Make sure you're in the project root directory."
    exit 1
fi

# Create necessary directories
mkdir -p uploads
mkdir -p logs

# Set default environment variables if not set
export PORT=${PORT:-3000}
export NODE_ENV=${NODE_ENV:-development}

# AI Service Configuration
export OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-"your-openrouter-key-here"}
export APP_URL=${APP_URL:-"http://localhost:3000"}

# Payment Service Configuration  
export STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-"sk_test_your-stripe-key-here"}
export STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-"whsec_your-webhook-secret"}

# Security
export JWT_SECRET=${JWT_SECRET:-"retrobbs-secret-key-change-in-production"}

echo "📦 Installing dependencies..."
cd backend && npm install

echo "🗄️  Setting up database..."
# Database will be created automatically by server.js

# Already in backend directory

echo "🔧 Configuration:"
echo "   Port: $PORT"
echo "   Environment: $NODE_ENV"
echo "   OpenRouter API: ${OPENROUTER_API_KEY:0:10}..."
echo "   Stripe: ${STRIPE_SECRET_KEY:0:10}..."

if [ "$NODE_ENV" = "development" ]; then
    echo "🛠️  Starting in development mode..."
    npm run dev
else
    echo "🚀 Starting in production mode..."
    npm start
fi