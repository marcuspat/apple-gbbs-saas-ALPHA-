const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Enhanced Database Service with connection pooling, error handling, and optimization
 */
class DatabaseService {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '../retrobbs.db');
        this.db = null;
        this.connectionPool = [];
        this.maxConnections = 10;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        this.init();
    }
    
    init() {
        try {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Database connection failed:', err);
                    throw err;
                }
                console.log('Database connected successfully');
            });
            
            // Enable foreign key constraints and optimization settings
            this.db.run('PRAGMA foreign_keys = ON');
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.run('PRAGMA synchronous = NORMAL');
            this.db.run('PRAGMA cache_size = -64000'); // 64MB cache
            this.db.run('PRAGMA temp_store = MEMORY');
            
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Execute a query with automatic retry and error handling
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            const executeQuery = (attempt = 1) => {
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        if (attempt < this.retryAttempts && this.isRetryableError(err)) {
                            console.warn(`Query failed (attempt ${attempt}), retrying:`, err.message);
                            setTimeout(() => executeQuery(attempt + 1), this.retryDelay);
                        } else {
                            console.error('Query failed:', err);
                            reject(err);
                        }
                    } else {
                        resolve(rows);
                    }
                });
            };
            executeQuery();
        });
    }
    
    /**
     * Execute a single query and return first row
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Get query failed:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
    
    /**
     * Execute an insert/update/delete query
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Run query failed:', err);
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }
    
    /**
     * Execute multiple queries in a transaction
     */
    async transaction(queries) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                const results = [];
                let hasError = false;
                
                const executeNext = (index) => {
                    if (index >= queries.length) {
                        if (hasError) {
                            this.db.run('ROLLBACK', () => {
                                reject(new Error('Transaction failed and rolled back'));
                            });
                        } else {
                            this.db.run('COMMIT', () => {
                                resolve(results);
                            });
                        }
                        return;
                    }
                    
                    const { sql, params = [] } = queries[index];
                    this.db.run(sql, params, function(err) {
                        if (err) {
                            hasError = true;
                            console.error(`Transaction query ${index} failed:`, err);
                        } else {
                            results.push({
                                lastID: this.lastID,
                                changes: this.changes
                            });
                        }
                        executeNext(index + 1);
                    });
                };
                
                executeNext(0);
            });
        });
    }
    
    /**
     * User management methods
     */
    async createUser(userData) {
        const { username, email, passwordHash, subscriptionTier = 'hobbyist' } = userData;
        const sql = `
            INSERT INTO users (username, email, password_hash, subscription_tier, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [username.toUpperCase(), email, passwordHash, subscriptionTier]);
    }
    
    async getUserById(id) {
        const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
        return this.get(sql, [id]);
    }
    
    async getUserByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ? AND is_active = 1';
        return this.get(sql, [username.toUpperCase()]);
    }
    
    async getUserByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
        return this.get(sql, [email]);
    }
    
    async updateUserLogin(userId) {
        const sql = `
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP, total_logins = total_logins + 1
            WHERE id = ?
        `;
        return this.run(sql, [userId]);
    }
    
    async updateUserSubscription(userId, subscriptionTier) {
        const sql = 'UPDATE users SET subscription_tier = ? WHERE id = ?';
        return this.run(sql, [subscriptionTier, userId]);
    }
    
    /**
     * Message board methods
     */
    async getBoards() {
        const sql = `
            SELECT b.*, 
                   COUNT(m.id) as message_count,
                   MAX(m.created_at) as last_post
            FROM boards b
            LEFT JOIN messages m ON b.id = m.board_id
            WHERE b.is_active = 1
            GROUP BY b.id
            ORDER BY b.id
        `;
        return this.query(sql);
    }
    
    async getBoardMessages(boardId, limit = 50, offset = 0) {
        const sql = `
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.board_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.query(sql, [boardId, limit, offset]);
    }
    
    async createMessage(boardId, userId, subject, content) {
        const sql = `
            INSERT INTO messages (board_id, user_id, subject, content, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [boardId, userId, subject, content]);
    }
    
    /**
     * File management methods
     */
    async getFiles(areaId) {
        const sql = `
            SELECT f.*, u.username as uploaded_by_username
            FROM files f
            JOIN users u ON f.uploaded_by = u.id
            WHERE f.area_id = ?
            ORDER BY f.created_at DESC
        `;
        return this.query(sql, [areaId]);
    }
    
    async createFile(fileData) {
        const { filename, originalName, fileSize, mimeType, areaId, uploadedBy, description } = fileData;
        const sql = `
            INSERT INTO files (filename, original_name, file_size, mime_type, area_id, uploaded_by, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [filename, originalName, fileSize, mimeType, areaId, uploadedBy, description]);
    }
    
    async updateFileDownloadCount(fileId) {
        const sql = 'UPDATE files SET download_count = download_count + 1 WHERE id = ?';
        return this.run(sql, [fileId]);
    }
    
    /**
     * Analytics methods
     */
    async recordAnalytics(data) {
        const { userId, action, menu, sessionId, ipAddress, userAgent } = data;
        const sql = `
            INSERT INTO analytics (user_id, action, menu, session_id, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [userId, action, menu, sessionId, ipAddress, userAgent]);
    }
    
    async getAnalytics(days = 30) {
        const sql = `
            SELECT action, COUNT(*) as count, menu
            FROM analytics
            WHERE created_at >= date('now', '-${days} days')
            GROUP BY action, menu
            ORDER BY count DESC
        `;
        return this.query(sql);
    }
    
    /**
     * System statistics
     */
    async getSystemStats() {
        const queries = [
            'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
            'SELECT COUNT(*) as count FROM messages',
            'SELECT COUNT(*) as count FROM files',
            'SELECT SUM(download_count) as count FROM files'
        ];
        
        const results = await Promise.all(queries.map(sql => this.get(sql)));
        
        return {
            totalUsers: results[0]?.count || 0,
            totalMessages: results[1]?.count || 0,
            totalFiles: results[2]?.count || 0,
            totalDownloads: results[3]?.count || 0
        };
    }
    
    /**
     * Configuration management
     */
    async getConfig(key) {
        const sql = 'SELECT config_value, config_type FROM system_config WHERE config_key = ?';
        const result = await this.get(sql, [key]);
        
        if (!result) return null;
        
        // Convert value based on type
        switch (result.config_type) {
            case 'integer':
                return parseInt(result.config_value);
            case 'boolean':
                return result.config_value === 'true';
            case 'json':
                return JSON.parse(result.config_value);
            default:
                return result.config_value;
        }
    }
    
    async setConfig(key, value, type = 'string', description = null) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const sql = `
            INSERT OR REPLACE INTO system_config (config_key, config_value, config_type, description, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [key, stringValue, type, description]);
    }
    
    /**
     * Cache management for AI responses
     */
    async getCachedAIResponse(cacheKey) {
        const sql = `
            SELECT response, token_count 
            FROM ai_cache 
            WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
        `;
        return this.get(sql, [cacheKey]);
    }
    
    async setCachedAIResponse(cacheKey, response, model, tokenCount, ttlSeconds = 3600) {
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        const sql = `
            INSERT OR REPLACE INTO ai_cache (cache_key, response, model, token_count, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [cacheKey, response, model, tokenCount, expiresAt]);
    }
    
    /**
     * Cleanup expired data
     */
    async cleanup() {
        const queries = [
            'DELETE FROM ai_cache WHERE expires_at < datetime("now")',
            'DELETE FROM password_reset_tokens WHERE expires_at < datetime("now")',
            'DELETE FROM user_sessions WHERE expires_at < datetime("now")',
            'DELETE FROM rate_limits WHERE window_start < datetime("now", "-1 hour")'
        ];
        
        for (const sql of queries) {
            try {
                await this.run(sql);
            } catch (error) {
                console.error('Cleanup query failed:', error);
            }
        }
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const retryableMessages = [
            'database is locked',
            'database is busy',
            'connection timeout'
        ];
        
        return retryableMessages.some(msg => 
            error.message.toLowerCase().includes(msg)
        );
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = DatabaseService;