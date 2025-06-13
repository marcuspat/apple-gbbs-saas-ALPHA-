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
const helmet = require('helmet');
const crypto = require('crypto');
const validator = require('validator');
const AIService = require('./ai-service');
const PaymentService = require('./payment-service');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize services
const aiService = new AIService();
const paymentService = new PaymentService();

// Security Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET environment variable must be set with at least 32 characters');
    process.exit(1);
}

const SALT_ROUNDS = 12; // Increased from 10
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

// Database setup with better error handling
const db = new sqlite3.Database('./retrobbs.db', (err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
});

// Initialize database tables
db.serialize(() => {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON");
    
    // Users table with enhanced security
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
        total_logins INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        two_factor_secret TEXT,
        password_reset_token TEXT,
        password_reset_expires DATETIME
    )`);
    
    // Message boards table
    db.run(`CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);
    
    // Messages table with user relationship
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited_at DATETIME,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (board_id) REFERENCES boards (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Files table with enhanced security
    db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        file_hash TEXT,
        area_id INTEGER,
        uploaded_by INTEGER NOT NULL,
        description TEXT,
        download_count INTEGER DEFAULT 0,
        virus_scanned BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users (id)
    )`);
    
    // Session management table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Audit log table
    db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Insert default boards (without hardcoded admin)
    db.run(`INSERT OR IGNORE INTO boards (name, description) VALUES 
        ('General Discussion', 'General chat and discussions'),
        ('Retro Computing', 'Talk about vintage computers and systems'),
        ('BBS Nostalgia', 'Share memories of the BBS era'),
        ('Programming', 'Programming discussions and help'),
        ('Apple II Help', 'Help and support for Apple II systems')`);
});

// Enhanced security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configuration with whitelist
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Enhanced rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// Secure file upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Whitelist safe file types
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif',
            'text/plain', 'application/pdf',
            'application/zip', 'application/x-zip-compressed'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

// Enhanced authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if session is still valid
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        db.get(
            `SELECT s.*, u.username, u.email, u.subscription_tier 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.token_hash = ? AND s.is_active = 1 AND s.expires_at > datetime('now')`,
            [tokenHash],
            (err, session) => {
                if (err || !session) {
                    return res.status(403).json({ message: 'Invalid or expired session' });
                }
                
                req.user = {
                    id: session.user_id,
                    username: session.username,
                    email: session.email,
                    subscription_tier: session.subscription_tier
                };
                
                // Log the action
                logAuditEvent(req.user.id, 'api_access', req.path, req.ip, req.get('user-agent'), 'success');
                
                next();
            }
        );
    } catch (err) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Audit logging function
function logAuditEvent(userId, action, resource, ip, userAgent, status, details = null) {
    db.run(
        `INSERT INTO audit_log (user_id, action, resource_type, ip_address, user_agent, status, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, action, resource, ip, userAgent, status, details]
    );
}

// Input validation helpers
function validateUsername(username) {
    return username && 
           username.length >= 3 && 
           username.length <= 20 && 
           /^[A-Za-z0-9_]+$/.test(username);
}

function validateEmail(email) {
    return email && validator.isEmail(email);
}

function validatePassword(password) {
    return password && 
           password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
}

// WebSocket connection handling with authentication
const connectedUsers = new Map();

wss.on('connection', (ws, req) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    connectedUsers.set(sessionId, { ws, user: null, ip: req.socket.remoteAddress });
    
    console.log(`New WebSocket connection: ${sessionId} from ${req.socket.remoteAddress}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(sessionId, data);
        } catch (error) {
            console.error('WebSocket message error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
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

// API Routes with enhanced security

// Registration with validation
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    // Input validation
    if (!validateUsername(username)) {
        return res.status(400).json({ 
            message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' 
        });
    }
    
    if (!validateEmail(email)) {
        return res.status(400).json({ message: 'Invalid email address' });
    }
    
    if (!validatePassword(password)) {
        return res.status(400).json({ 
            message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers' 
        });
    }
    
    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        db.run(
            `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
            [username.toUpperCase(), email.toLowerCase(), passwordHash],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ message: 'Username or email already exists' });
                    }
                    logAuditEvent(null, 'registration_failed', 'user', req.ip, req.get('user-agent'), 'error', err.message);
                    return res.status(500).json({ message: 'Registration failed' });
                }
                
                // Create session
                const token = jwt.sign(
                    { id: this.lastID, username: username.toUpperCase() },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                
                db.run(
                    `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [this.lastID, tokenHash, req.ip, req.get('user-agent'), expiresAt.toISOString()]
                );
                
                logAuditEvent(this.lastID, 'registration_success', 'user', req.ip, req.get('user-agent'), 'success');
                
                res.json({
                    message: 'Registration successful',
                    token,
                    user: { 
                        id: this.lastID, 
                        username: username.toUpperCase(), 
                        email: email.toLowerCase() 
                    }
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login with brute force protection
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }
    
    db.get(
        `SELECT * FROM users WHERE username = ? AND is_active = 1`,
        [username.toUpperCase()],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!user) {
                logAuditEvent(null, 'login_failed', 'auth', req.ip, req.get('user-agent'), 'error', 'Invalid username');
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            // Check if account is locked
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                return res.status(423).json({ message: 'Account temporarily locked due to multiple failed attempts' });
            }
            
            try {
                const isValid = await bcrypt.compare(password, user.password_hash);
                
                if (!isValid) {
                    // Increment failed attempts
                    const failedAttempts = user.failed_login_attempts + 1;
                    let lockedUntil = null;
                    
                    if (failedAttempts >= 5) {
                        // Lock account for 30 minutes
                        lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                    }
                    
                    db.run(
                        `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
                        [failedAttempts, lockedUntil, user.id]
                    );
                    
                    logAuditEvent(user.id, 'login_failed', 'auth', req.ip, req.get('user-agent'), 'error', 'Invalid password');
                    
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                
                // Reset failed attempts on successful login
                db.run(
                    `UPDATE users SET 
                     last_login = CURRENT_TIMESTAMP, 
                     total_logins = total_logins + 1,
                     failed_login_attempts = 0,
                     locked_until = NULL
                     WHERE id = ?`,
                    [user.id]
                );
                
                // Create session
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                
                db.run(
                    `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [user.id, tokenHash, req.ip, req.get('user-agent'), expiresAt.toISOString()]
                );
                
                logAuditEvent(user.id, 'login_success', 'auth', req.ip, req.get('user-agent'), 'success');
                
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
                console.error('Login error:', error);
                res.status(500).json({ message: 'Server error' });
            }
        }
    );
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    db.run(
        `UPDATE sessions SET is_active = 0 WHERE token_hash = ?`,
        [tokenHash],
        (err) => {
            if (err) {
                return res.status(500).json({ message: 'Logout failed' });
            }
            
            logAuditEvent(req.user.id, 'logout', 'auth', req.ip, req.get('user-agent'), 'success');
            res.json({ message: 'Logged out successfully' });
        }
    );
});

// Message board routes with proper authorization
app.get('/api/boards', authenticateToken, (req, res) => {
    db.all(
        `SELECT b.*, COUNT(m.id) as message_count,
         MAX(m.created_at) as last_post
         FROM boards b
         LEFT JOIN messages m ON b.id = m.board_id AND m.is_deleted = 0
         WHERE b.is_active = 1
         GROUP BY b.id
         ORDER BY b.id`,
        (err, boards) => {
            if (err) {
                console.error('Error fetching boards:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(boards);
        }
    );
});

app.get('/api/boards/:id/messages', authenticateToken, (req, res) => {
    const boardId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    if (isNaN(boardId)) {
        return res.status(400).json({ message: 'Invalid board ID' });
    }
    
    db.all(
        `SELECT m.*, u.username
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.board_id = ? AND m.is_deleted = 0
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [boardId, limit, offset],
        (err, messages) => {
            if (err) {
                console.error('Error fetching messages:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(messages);
        }
    );
});

app.post('/api/boards/:id/messages', authenticateToken, (req, res) => {
    const { subject, content } = req.body;
    const boardId = parseInt(req.params.id);
    
    if (!subject || !content) {
        return res.status(400).json({ message: 'Subject and content required' });
    }
    
    if (isNaN(boardId)) {
        return res.status(400).json({ message: 'Invalid board ID' });
    }
    
    // Validate content length
    if (subject.length > 255 || content.length > 10000) {
        return res.status(400).json({ message: 'Subject or content too long' });
    }
    
    // Check if board exists
    db.get(
        `SELECT id FROM boards WHERE id = ? AND is_active = 1`,
        [boardId],
        (err, board) => {
            if (err || !board) {
                return res.status(404).json({ message: 'Board not found' });
            }
            
            // Sanitize input
            const sanitizedSubject = validator.escape(subject);
            const sanitizedContent = validator.escape(content);
            
            db.run(
                `INSERT INTO messages (board_id, user_id, subject, content) VALUES (?, ?, ?, ?)`,
                [boardId, req.user.id, sanitizedSubject, sanitizedContent],
                function(err) {
                    if (err) {
                        console.error('Error posting message:', err);
                        return res.status(500).json({ message: 'Failed to post message' });
                    }
                    
                    logAuditEvent(req.user.id, 'message_posted', 'message', req.ip, req.get('user-agent'), 'success', `Board: ${boardId}`);
                    
                    res.json({ message: 'Message posted successfully', id: this.lastID });
                }
            );
        }
    );
});

// Secure file upload
app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { description, area_id } = req.body;
    const areaId = parseInt(area_id) || 1;
    
    // Calculate file hash for deduplication
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // Check for duplicate files
    db.get(
        `SELECT id, filename FROM files WHERE file_hash = ?`,
        [fileHash],
        (err, existingFile) => {
            if (existingFile) {
                // Remove duplicate upload
                fs.unlinkSync(req.file.path);
                return res.status(409).json({ 
                    message: 'This file already exists', 
                    id: existingFile.id 
                });
            }
            
            db.run(
                `INSERT INTO files (filename, original_name, file_size, mime_type, file_hash, area_id, uploaded_by, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.file.filename,
                    req.file.originalname,
                    req.file.size,
                    req.file.mimetype,
                    fileHash,
                    areaId,
                    req.user.id,
                    validator.escape(description || '')
                ],
                function(err) {
                    if (err) {
                        console.error('Error recording file upload:', err);
                        return res.status(500).json({ message: 'Failed to record file upload' });
                    }
                    
                    logAuditEvent(req.user.id, 'file_uploaded', 'file', req.ip, req.get('user-agent'), 'success', `File: ${req.file.originalname}`);
                    
                    res.json({ message: 'File uploaded successfully', id: this.lastID });
                }
            );
        }
    );
});

// Secure file download with path validation
app.get('/api/files/download/:id', authenticateToken, (req, res) => {
    const fileId = parseInt(req.params.id);
    
    if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' });
    }
    
    db.get(
        `SELECT * FROM files WHERE id = ?`,
        [fileId],
        (err, file) => {
            if (err) {
                console.error('Error fetching file:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!file) {
                return res.status(404).json({ message: 'File not found' });
            }
            
            // Validate file path to prevent traversal
            const uploadDir = path.join(__dirname, '../uploads');
            const filePath = path.join(uploadDir, file.filename);
            const normalizedPath = path.normalize(filePath);
            
            // Ensure the file path is within the uploads directory
            if (!normalizedPath.startsWith(uploadDir)) {
                logAuditEvent(req.user.id, 'file_download_blocked', 'file', req.ip, req.get('user-agent'), 'error', 'Path traversal attempt');
                return res.status(403).json({ message: 'Access denied' });
            }
            
            // Check if file exists
            if (!fs.existsSync(normalizedPath)) {
                return res.status(404).json({ message: 'File not found on disk' });
            }
            
            // Update download count
            db.run(
                `UPDATE files SET download_count = download_count + 1 WHERE id = ?`,
                [fileId]
            );
            
            logAuditEvent(req.user.id, 'file_downloaded', 'file', req.ip, req.get('user-agent'), 'success', `File: ${file.original_name}`);
            
            res.download(normalizedPath, file.original_name);
        }
    );
});

// Admin-only analytics endpoint
app.get('/api/analytics', authenticateToken, (req, res) => {
    // Check if user is admin (you should implement proper role-based access control)
    if (req.user.subscription_tier !== 'enterprise') {
        logAuditEvent(req.user.id, 'unauthorized_access', 'analytics', req.ip, req.get('user-agent'), 'error');
        return res.status(403).json({ message: 'Access denied' });
    }
    
    db.all(
        `SELECT action, COUNT(*) as count, 
         strftime('%Y-%m-%d', created_at) as date
         FROM audit_log
         WHERE created_at >= date('now', '-30 days')
         GROUP BY action, date
         ORDER BY date DESC, count DESC`,
        (err, analytics) => {
            if (err) {
                console.error('Error fetching analytics:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(analytics);
        }
    );
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't leak error details in production
    const isDev = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        message: err.message || 'Something went wrong!',
        ...(isDev && { stack: err.stack })
    });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Secure RetroBBS Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Frontend available at http://localhost:${PORT}`);
    
    // Clean up expired sessions on startup
    db.run(
        `UPDATE sessions SET is_active = 0 WHERE expires_at < datetime('now')`,
        (err, result) => {
            if (!err) {
                console.log('Cleaned up expired sessions');
            }
        }
    );
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    
    // Close all WebSocket connections
    connectedUsers.forEach((connection) => {
        connection.ws.close();
    });
    
    // Close database
    db.close();
    
    // Close server
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Log to file or monitoring service
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Log to file or monitoring service
});

module.exports = { app, server };