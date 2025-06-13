const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'RetroBBS SaaS is running!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Mock data for demo
app.get('/api/stats', (req, res) => {
    res.json({
        total_users: 1247,
        total_messages: 15678,
        total_files: 2143,
        total_downloads: 8901,
        online_users: Math.floor(Math.random() * 20) + 5,
        system_uptime: Math.floor(process.uptime())
    });
});

// Default route - serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Catch all other routes and serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Export for Vercel serverless functions
module.exports = app;

// Start server (only when not in Vercel environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    server.listen(PORT, () => {
        console.log(`🚀 RetroBBS SaaS Server running on port ${PORT}`);
        console.log(`📱 Frontend available at http://localhost:${PORT}`);
        console.log(`🔗 API status at http://localhost:${PORT}/api/status`);
        console.log(`📊 System stats at http://localhost:${PORT}/api/stats`);
        console.log(`📁 Serving files from: ${path.join(__dirname, 'frontend')}`);
        
        // List available files
        try {
            const fs = require('fs');
            const files = fs.readdirSync(path.join(__dirname, 'frontend'));
            console.log(`📄 Available files: ${files.join(', ')}`);
        } catch (error) {
            console.error('❌ Error reading frontend directory:', error.message);
        }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down gracefully...');
        server.close();
    });
}