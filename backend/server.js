const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const AIService = require('./ai-service');
const PaymentService = require('./payment-service');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize services
const aiService = new AIService();
const paymentService = new PaymentService();

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'retrobbs-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Database setup
const db = new sqlite3.Database('./retrobbs.db');

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        subscription_tier TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1,
        total_logins INTEGER DEFAULT 0
    )`);
    
    // Message boards table
    db.run(`CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )`);
    
    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER,
        user_id INTEGER,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES boards (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        area_id INTEGER,
        uploaded_by INTEGER,
        description TEXT,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users (id)
    )`);
    
    // Analytics table
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT,
        menu TEXT,
        session_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Subscriptions table
    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        stripe_subscription_id TEXT,
        plan_id TEXT,
        status TEXT,
        current_period_start DATETIME,
        current_period_end DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Insert default boards
    db.run(`INSERT OR IGNORE INTO boards (name, description) VALUES 
        ('General Discussion', 'General chat and discussions'),
        ('Retro Computing', 'Talk about vintage computers and systems'),
        ('BBS Nostalgia', 'Share memories of the BBS era'),
        ('Programming', 'Programming discussions and help'),
        ('Apple II Help', 'Help and support for Apple II systems')`);
    
    // Create default admin user
    bcrypt.hash('admin123', SALT_ROUNDS, (err, hash) => {
        if (err) throw err;
        db.run(`INSERT OR IGNORE INTO users (username, email, password_hash, subscription_tier) 
                VALUES ('SYSOP', 'admin@retrobbs.com', ?, 'enterprise')`, [hash]);
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// WebSocket connection handling
const connectedUsers = new Map();

wss.on('connection', (ws, req) => {
    const sessionId = Math.random().toString(36).substring(7);
    connectedUsers.set(sessionId, { ws, user: null });
    
    console.log(`New WebSocket connection: ${sessionId}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(sessionId, data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        connectedUsers.delete(sessionId);
        console.log(`WebSocket disconnected: ${sessionId}`);
        broadcastUserCount();
    });
    
    // Send initial user count
    ws.send(JSON.stringify({
        type: 'user_count',
        data: connectedUsers.size
    }));
});

function handleWebSocketMessage(sessionId, data) {
    const connection = connectedUsers.get(sessionId);
    if (!connection) return;
    
    switch (data.type) {
        case 'chat':
            handleChatMessage(sessionId, data.data);
            break;
        case 'analytics':
            handleAnalytics(sessionId, data.data);
            break;
        default:
            console.log('Unknown WebSocket message type:', data.type);
    }
}

function handleChatMessage(sessionId, data) {
    const connection = connectedUsers.get(sessionId);
    if (!connection || !data.message) return;
    
    const chatMessage = {
        type: 'chat',
        data: {
            username: connection.user?.username || 'GUEST',
            message: data.message,
            timestamp: new Date().toISOString()
        }
    };
    
    // Broadcast to all connected users
    connectedUsers.forEach((conn, id) => {
        if (conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(JSON.stringify(chatMessage));
        }
    });
}

function handleAnalytics(sessionId, data) {
    const connection = connectedUsers.get(sessionId);
    if (!connection) return;
    
    // Store analytics data
    db.run(`INSERT INTO analytics (user_id, action, menu, session_id, created_at) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
           [connection.user?.id || null, data.command, data.menu, sessionId]);
}

function broadcastUserCount() {
    const message = JSON.stringify({
        type: 'user_count',
        data: connectedUsers.size
    });
    
    connectedUsers.forEach((connection) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(message);
        }
    });
}

// API Routes

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        db.run(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
               [username.toUpperCase(), email, passwordHash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Username or email already exists' });
                }
                return res.status(500).json({ message: 'Registration failed' });
            }
            
            const token = jwt.sign({ id: this.lastID, username: username.toUpperCase() }, JWT_SECRET);
            res.json({
                message: 'Registration successful',
                token,
                user: { id: this.lastID, username: username.toUpperCase(), email }
            });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }
    
    db.get(`SELECT * FROM users WHERE username = ? AND is_active = 1`,
           [username.toUpperCase()], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        try {
            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (!isValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            // Update login stats
            db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP, total_logins = total_logins + 1 
                    WHERE id = ?`, [user.id]);
            
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    subscription_tier: user.subscription_tier
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });
});

// Message board routes
app.get('/api/boards', (req, res) => {
    db.all(`SELECT b.*, COUNT(m.id) as message_count,
            MAX(m.created_at) as last_post
            FROM boards b
            LEFT JOIN messages m ON b.id = m.board_id
            WHERE b.is_active = 1
            GROUP BY b.id
            ORDER BY b.id`, (err, boards) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        res.json(boards);
    });
});

app.get('/api/boards/:id/messages', (req, res) => {
    const boardId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(`SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.board_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?`, [boardId, limit, offset], (err, messages) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        res.json(messages);
    });
});

app.post('/api/boards/:id/messages', authenticateToken, (req, res) => {
    const { subject, content } = req.body;
    const boardId = req.params.id;
    
    if (!subject || !content) {
        return res.status(400).json({ message: 'Subject and content required' });
    }
    
    db.run(`INSERT INTO messages (board_id, user_id, subject, content) VALUES (?, ?, ?, ?)`,
           [boardId, req.user.id, subject, content], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Failed to post message' });
        }
        res.json({ message: 'Message posted successfully', id: this.lastID });
    });
});

// File routes
app.get('/api/files/:area', (req, res) => {
    const areaId = req.params.area;
    
    db.all(`SELECT f.*, u.username as uploaded_by_username
            FROM files f
            JOIN users u ON f.uploaded_by = u.id
            WHERE f.area_id = ?
            ORDER BY f.created_at DESC`, [areaId], (err, files) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        res.json(files);
    });
});

app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { description, area_id } = req.body;
    
    db.run(`INSERT INTO files (filename, original_name, file_size, mime_type, area_id, uploaded_by, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
           [req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, 
            area_id || 1, req.user.id, description], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Failed to record file upload' });
        }
        res.json({ message: 'File uploaded successfully', id: this.lastID });
    });
});

app.get('/api/files/download/:id', (req, res) => {
    const fileId = req.params.id;
    
    db.get(`SELECT * FROM files WHERE id = ?`, [fileId], (err, file) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        // Update download count
        db.run(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`, [fileId]);
        
        res.download(path.join(__dirname, '../uploads', file.filename), file.original_name);
    });
});

// Analytics routes
app.get('/api/analytics', authenticateToken, (req, res) => {
    // Only allow admin users to view analytics
    if (req.user.username !== 'SYSOP') {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    db.all(`SELECT action, COUNT(*) as count, menu
            FROM analytics
            WHERE created_at >= date('now', '-30 days')
            GROUP BY action, menu
            ORDER BY count DESC`, (err, analytics) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        res.json(analytics);
    });
});

// AI routes
app.post('/api/ai/welcome', authenticateToken, async (req, res) => {
    const { bbsName, theme } = req.body;
    
    try {
        const welcome = await aiService.generateWelcomeMessage(bbsName, theme);
        res.json({ welcome });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate welcome message' });
    }
});

app.post('/api/ai/respond', authenticateToken, async (req, res) => {
    const { message, context } = req.body;
    
    try {
        const response = await aiService.generateMessageResponse(message, context);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate response' });
    }
});

app.post('/api/ai/game', authenticateToken, async (req, res) => {
    const { gameType } = req.body;
    
    try {
        const game = await aiService.generateDoorGame(gameType);
        res.json({ game });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate game' });
    }
});

app.post('/api/ai/ascii', authenticateToken, async (req, res) => {
    const { text, style } = req.body;
    
    try {
        const ascii = await aiService.generateASCIIArt(text, style);
        res.json({ ascii });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate ASCII art' });
    }
});

app.post('/api/ai/help', async (req, res) => {
    const { question, userLevel } = req.body;
    
    try {
        const help = await aiService.helpUser(question, userLevel);
        res.json({ help });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get help response' });
    }
});

// Payment routes
app.get('/api/plans', (req, res) => {
    res.json(paymentService.getPlans());
});

app.post('/api/checkout', authenticateToken, async (req, res) => {
    const { planId } = req.body;
    const baseUrl = req.protocol + '://' + req.get('host');
    
    try {
        // Create or get Stripe customer
        let customerId = req.user.stripe_customer_id;
        if (!customerId) {
            const customer = await paymentService.createCustomer(
                req.user.email,
                req.user.username,
                { user_id: req.user.id }
            );
            customerId = customer.id;
            
            // Update user with customer ID
            db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', 
                   [customerId, req.user.id]);
        }
        
        const session = await paymentService.createCheckoutSession(
            planId,
            customerId,
            `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            `${baseUrl}/cancel`
        );
        
        res.json({ checkout_url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ message: 'Failed to create checkout session' });
    }
});

app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        event = require('stripe').webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    try {
        await paymentService.handleWebhook(event);
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handling failed:', error);
        res.status(500).json({ message: 'Webhook handling failed' });
    }
});

app.get('/api/billing/portal', authenticateToken, async (req, res) => {
    if (!req.user.stripe_customer_id) {
        return res.status(400).json({ message: 'No billing account found' });
    }
    
    try {
        const portalUrl = await paymentService.getCustomerPortalUrl(
            req.user.stripe_customer_id,
            req.protocol + '://' + req.get('host') + '/account'
        );
        
        res.json({ portal_url: portalUrl });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create billing portal' });
    }
});

// System stats routes
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    Promise.all([
        new Promise((resolve) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
                stats.total_users = result ? result.count : 0;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.get('SELECT COUNT(*) as count FROM messages', (err, result) => {
                stats.total_messages = result ? result.count : 0;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.get('SELECT COUNT(*) as count FROM files', (err, result) => {
                stats.total_files = result ? result.count : 0;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.get('SELECT SUM(download_count) as count FROM files', (err, result) => {
                stats.total_downloads = result ? result.count || 0 : 0;
                resolve();
            });
        })
    ]).then(() => {
        stats.online_users = connectedUsers.size;
        stats.system_uptime = process.uptime();
        res.json(stats);
    });
});

// Default route - serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Catch all other routes and serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
    console.log(`RetroBBS Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Frontend available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    db.close();
    server.close();
});