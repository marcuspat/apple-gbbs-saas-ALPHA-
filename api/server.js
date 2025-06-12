const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Configuration for Vercel
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());

// For Vercel deployment, static files are handled differently
if (!isProduction) {
    app.use(express.static(path.join(__dirname, '../frontend')));
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'RetroBBS SaaS is running on Vercel!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

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

// Mock authentication endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }
    
    // Mock successful login for demo
    res.json({
        message: 'Login successful',
        token: 'demo-jwt-token',
        user: {
            id: 1,
            username: username.toUpperCase(),
            subscription_tier: 'community'
        }
    });
});

// Mock boards endpoint
app.get('/api/boards', (req, res) => {
    res.json([
        { id: 1, name: 'General Discussion', message_count: 47, last_post: 'Today' },
        { id: 2, name: 'Retro Computing', message_count: 23, last_post: 'Today' },
        { id: 3, name: 'BBS Nostalgia', message_count: 15, last_post: 'Yesterday' },
        { id: 4, name: 'Programming', message_count: 31, last_post: 'Today' },
        { id: 5, name: 'Apple II Help', message_count: 8, last_post: '2 days ago' }
    ]);
});

// Mock messages endpoint
app.get('/api/boards/:id/messages', (req, res) => {
    res.json([
        {
            id: 47,
            subject: 'Welcome to RetroBBS on Vercel!',
            username: 'SYSOP',
            created_at: new Date().toISOString(),
            content: 'Welcome everyone to our cloud-hosted BBS!'
        },
        {
            id: 46,
            subject: 'Anyone remember TradeWars?',
            username: 'RETROGAMER',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            content: 'Looking for other TW players...'
        }
    ]);
});

// Mock files endpoint
app.get('/api/files/:area', (req, res) => {
    res.json([
        {
            id: 1,
            filename: 'APPLESOFT.DSK',
            original_name: 'APPLESOFT.DSK',
            file_size: 143360,
            description: 'Applesoft BASIC Disk',
            created_at: '2024-03-15'
        },
        {
            id: 2,
            filename: 'PRODOS.DSK',
            original_name: 'PRODOS.DSK', 
            file_size: 143360,
            description: 'ProDOS System Disk',
            created_at: '2024-03-15'
        }
    ]);
});

// AI endpoints (mock for deployment)
app.post('/api/ai/welcome', (req, res) => {
    const { bbsName, theme } = req.body;
    
    const welcome = `╔══════════════════════════════════════════════════════════════════════════════╗
║                            WELCOME TO ${(bbsName || 'RETROBBS').toUpperCase().padEnd(20)}                        ║
║                                                                              ║
║                        "WHERE THE PAST MEETS THE FUTURE"                    ║
║                                                                              ║
║  • MESSAGE BOARDS     • FILE LIBRARIES     • DOOR GAMES                     ║
║  • REAL-TIME CHAT     • USER DIRECTORY     • AND MORE!                      ║
║                                                                              ║
║                     ENJOY YOUR STAY ON THE SYSTEM!                          ║
╚══════════════════════════════════════════════════════════════════════════════╝`;
    
    res.json({ welcome });
});

app.post('/api/ai/help', (req, res) => {
    const { question } = req.body;
    
    const help = `Thanks for your question about "${question}"! 

As a helpful BBS sysop from the 1980s, I'd say the best way to learn about BBS systems is to explore the menus and try different commands. 

Most BBS commands are single letters:
- M for Messages
- F for Files  
- G for Games
- U for Users
- Q to Quit

Don't be afraid to experiment - that's how we all learned back in the day! If you get stuck, just type H for help or ask the community in the message boards.

73s (best regards),
The Sysop`;
    
    res.json({ help });
});

// Payment endpoints (mock)
app.get('/api/plans', (req, res) => {
    res.json({
        hobbyist: {
            id: 'hobbyist',
            name: 'Hobbyist',
            price: 900,
            interval: 'month',
            features: [
                'Personal BBS instance',
                'Up to 50 users',
                'Basic message boards (5 boards)',
                'File sharing (1GB storage)',
                'Standard themes',
                'Community support'
            ]
        },
        community: {
            id: 'community', 
            name: 'Community',
            price: 2900,
            interval: 'month',
            features: [
                'Enhanced BBS instance',
                'Up to 250 users',
                'Advanced message boards (25 boards)',
                'File sharing (10GB storage)',
                'Multiple color themes',
                'Door games access',
                'Custom welcome screen',
                'AI-powered features',
                'Priority support'
            ]
        },
        enterprise: {
            id: 'enterprise',
            name: 'Enterprise', 
            price: 9900,
            interval: 'month',
            features: [
                'Multi-tenant hosting',
                'Unlimited users',
                'Unlimited boards',
                '100GB storage',
                'White-label branding',
                'Custom domains',
                'API access',
                'Advanced AI features',
                'Admin analytics dashboard',
                '24/7 premium support'
            ]
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Default route for local development
if (!isProduction) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

module.exports = app;