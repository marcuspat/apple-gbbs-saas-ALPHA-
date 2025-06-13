// Optimized RetroBBS Server
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Import modular components
const DatabaseSchema = require('./config/database-schema');
const AuthMiddleware = require('./middleware/auth');
const RateLimitMiddleware = require('./middleware/rate-limit');
const ConnectionManager = require('./websocket/connection-manager');
const AuthRoutes = require('./routes/auth');
const BoardRoutes = require('./routes/boards');

// Import services
const AIService = require('./ai-service');
const PaymentService = require('./payment-service');
const ChatManager = require('./src/chat-manager');
const EmailService = require('./email-service');

class RetroBBSServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.connectionManager = new ConnectionManager();
        
        // Configuration
        this.config = {
            port: process.env.PORT || 3000,
            jwtSecret: process.env.JWT_SECRET || 'retrobbs-secret-key-change-in-production',
            saltRounds: 10,
            dbPath: './retrobbs.db'
        };

        this.initializeServer();
    }

    async initializeServer() {
        try {
            await this.setupDatabase();
            this.setupMiddleware();
            this.setupServices();
            this.setupRoutes();
            this.setupWebSocket();
            this.setupErrorHandling();
            this.start();
        } catch (error) {
            console.error('Failed to initialize server:', error);
            process.exit(1);
        }
    }

    async setupDatabase() {
        this.db = new sqlite3.Database(this.config.dbPath);
        this.dbSchema = new DatabaseSchema(this.db, this.config.saltRounds);
        await this.dbSchema.initializeTables();
        console.log('Database initialized successfully');
    }

    setupMiddleware() {
        // CORS
        this.app.use(cors());
        
        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));
        
        // Static files
        this.app.use(express.static(path.join(__dirname, '../frontend')));
        
        // Rate limiting
        this.app.use('/api/', RateLimitMiddleware.createApiLimiter());
        this.app.use('/api/auth/login', RateLimitMiddleware.createAuthLimiter());
        this.app.use('/api/files/upload', RateLimitMiddleware.createUploadLimiter());

        // Ensure uploads directory exists
        if (!fs.existsSync('./uploads')) {
            fs.mkdirSync('./uploads', { recursive: true });
        }
    }

    setupServices() {
        // Initialize services
        this.aiService = new AIService();
        this.paymentService = new PaymentService();
        this.chatManager = new ChatManager();
        this.emailService = new EmailService();
        this.authMiddleware = new AuthMiddleware(this.config.jwtSecret);

        // Make services available to routes
        this.app.locals.db = this.db;
        this.app.locals.jwtSecret = this.config.jwtSecret;
        this.app.locals.saltRounds = this.config.saltRounds;
        this.app.locals.emailService = this.emailService;
        this.app.locals.aiService = this.aiService;
        this.app.locals.paymentService = this.paymentService;
    }

    setupRoutes() {
        // Authentication routes
        const authRoutes = new AuthRoutes(
            this.db, 
            this.config.jwtSecret, 
            this.config.saltRounds, 
            this.emailService
        );
        this.app.use('/api/auth', authRoutes.getRouter());

        // Board routes
        const boardRoutes = new BoardRoutes(this.db, this.authMiddleware);
        this.app.use('/api/boards', boardRoutes.getRouter());

        // Legacy routes (to be refactored)
        this.setupLegacyRoutes();

        // Default routes
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/index.html'));
        });

        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/index.html'));
        });
    }

    setupLegacyRoutes() {
        // TODO: Move these to separate route files
        
        // File routes (to be refactored)
        this.app.get('/api/files/:area', (req, res) => {
            const areaId = req.params.area;
            
            this.db.all(`SELECT f.*, u.username as uploaded_by_username
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

        // Analytics routes (to be refactored)
        this.app.get('/api/analytics', this.authMiddleware.authenticate(), this.authMiddleware.requireAdmin(), (req, res) => {
            this.db.all(`SELECT action, COUNT(*) as count, menu
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

        // System stats
        this.app.get('/api/stats', (req, res) => {
            this.getSystemStats()
                .then(stats => res.json(stats))
                .catch(() => res.status(500).json({ message: 'Failed to get stats' }));
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            this.connectionManager.handleConnection(ws, req);
        });
    }

    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            console.error('Unhandled error:', err.stack);
            res.status(500).json({ message: 'Something went wrong!' });
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('Shutting down gracefully...');
            this.shutdown();
        });

        process.on('SIGINT', () => {
            console.log('Received SIGINT, shutting down gracefully...');
            this.shutdown();
        });
    }

    async getSystemStats() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            Promise.all([
                this.queryPromise('SELECT COUNT(*) as count FROM users'),
                this.queryPromise('SELECT COUNT(*) as count FROM messages'),
                this.queryPromise('SELECT COUNT(*) as count FROM files'),
                this.queryPromise('SELECT SUM(download_count) as count FROM files')
            ]).then(results => {
                stats.total_users = results[0]?.count || 0;
                stats.total_messages = results[1]?.count || 0;
                stats.total_files = results[2]?.count || 0;
                stats.total_downloads = results[3]?.count || 0;
                stats.online_users = this.connectionManager.connectedUsers.size;
                stats.system_uptime = process.uptime();
                resolve(stats);
            }).catch(reject);
        });
    }

    queryPromise(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    start() {
        this.server.listen(this.config.port, () => {
            console.log(`RetroBBS Server running on port ${this.config.port}`);
            console.log(`WebSocket server ready`);
            console.log(`Frontend available at http://localhost:${this.config.port}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }

    shutdown() {
        console.log('Closing database connection...');
        this.db.close((err) => {
            if (err) console.error('Error closing database:', err);
        });

        console.log('Closing HTTP server...');
        this.server.close((err) => {
            if (err) console.error('Error closing server:', err);
            process.exit(0);
        });
    }
}

// Start the server
if (require.main === module) {
    new RetroBBSServer();
}

module.exports = RetroBBSServer;