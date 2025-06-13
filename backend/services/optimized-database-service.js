// Optimized Database Service with Connection Pooling and Caching
const sqlite3 = require('sqlite3').verbose();

class OptimizedDatabaseService {
    constructor(dbPath, options = {}) {
        this.dbPath = dbPath;
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultCacheDuration = options.cacheDuration || 5 * 60 * 1000; // 5 minutes
        this.maxCacheSize = options.maxCacheSize || 1000;
        this.queryQueue = [];
        this.isProcessingQueue = false;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        this.initializeDatabase();
        this.setupPeriodicCleanup();
    }

    initializeDatabase() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Database connection failed:', err);
                throw err;
            }
            console.log('Connected to SQLite database');
        });

        // Enable WAL mode for better concurrency
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
        this.db.exec('PRAGMA cache_size = 10000;');
        this.db.exec('PRAGMA temp_store = MEMORY;');
    }

    setupPeriodicCleanup() {
        // Clean expired cache entries every 5 minutes
        setInterval(() => {
            this.cleanExpiredCache();
        }, 5 * 60 * 1000);
    }

    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, expiry] of this.cacheExpiry.entries()) {
            if (now > expiry) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        }
    }

    generateCacheKey(sql, params = []) {
        return `${sql}:${JSON.stringify(params)}`;
    }

    getCached(key) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() < expiry) {
            this.cacheHits++;
            return this.cache.get(key);
        }
        
        // Remove expired entry
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
        this.cacheMisses++;
        return null;
    }

    setCached(key, value, duration = this.defaultCacheDuration) {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
            this.cacheExpiry.delete(oldestKey);
        }

        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + duration);
    }

    invalidateCache(pattern) {
        const keys = Array.from(this.cache.keys());
        keys.forEach(key => {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        });
    }

    // Promisified database operations
    async get(sql, params = [], useCache = true) {
        const cacheKey = this.generateCacheKey(sql, params);
        
        if (useCache) {
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (useCache && this.isCacheable(sql)) {
                        this.setCached(cacheKey, row);
                    }
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = [], useCache = true) {
        const cacheKey = this.generateCacheKey(sql, params);
        
        if (useCache) {
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    if (useCache && this.isCacheable(sql)) {
                        this.setCached(cacheKey, rows);
                    }
                    resolve(rows);
                }
            });
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
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

    async runBatch(operations) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                const results = [];
                
                operations.forEach((op, index) => {
                    this.db.run(op.sql, op.params, function(err) {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        
                        results[index] = {
                            lastID: this.lastID,
                            changes: this.changes
                        };
                        
                        completed++;
                        if (completed === operations.length) {
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(results);
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    isCacheable(sql) {
        const upperSql = sql.toUpperCase().trim();
        return upperSql.startsWith('SELECT') && 
               !upperSql.includes('CURRENT_TIMESTAMP') &&
               !upperSql.includes('DATETIME(\'NOW\')') &&
               !upperSql.includes('RANDOM()');
    }

    // High-level database operations with optimization
    async getUser(username) {
        return this.get(
            'SELECT * FROM users WHERE username = ? AND is_active = 1',
            [username.toUpperCase()],
            true // Use cache
        );
    }

    async getUserById(id) {
        return this.get(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [id],
            true
        );
    }

    async getBoards() {
        return this.all(`
            SELECT b.*, COUNT(m.id) as message_count,
                   MAX(m.created_at) as last_post
            FROM boards b
            LEFT JOIN messages m ON b.id = m.board_id
            WHERE b.is_active = 1
            GROUP BY b.id
            ORDER BY b.id
        `, [], true);
    }

    async getBoardMessages(boardId, limit = 50, offset = 0) {
        return this.all(`
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.board_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [boardId, limit, offset], true);
    }

    async createMessage(boardId, userId, subject, content) {
        const result = await this.run(
            'INSERT INTO messages (board_id, user_id, subject, content) VALUES (?, ?, ?, ?)',
            [boardId, userId, subject, content]
        );
        
        // Invalidate related cache
        this.invalidateCache(`messages`);
        this.invalidateCache('boards');
        
        return result;
    }

    async getFiles(areaId) {
        return this.all(`
            SELECT f.*, u.username as uploaded_by_username
            FROM files f
            JOIN users u ON f.uploaded_by = u.id
            WHERE f.area_id = ?
            ORDER BY f.created_at DESC
        `, [areaId], true);
    }

    async getSystemStats() {
        // Use Promise.all for parallel execution
        const [userCount, messageCount, fileCount, downloadCount] = await Promise.all([
            this.get('SELECT COUNT(*) as count FROM users', [], true),
            this.get('SELECT COUNT(*) as count FROM messages', [], true),
            this.get('SELECT COUNT(*) as count FROM files', [], true),
            this.get('SELECT SUM(download_count) as count FROM files', [], true)
        ]);

        return {
            total_users: userCount?.count || 0,
            total_messages: messageCount?.count || 0,
            total_files: fileCount?.count || 0,
            total_downloads: downloadCount?.count || 0
        };
    }

    async getAnalytics(days = 30) {
        return this.all(`
            SELECT action, COUNT(*) as count, menu
            FROM analytics
            WHERE created_at >= date('now', '-${days} days')
            GROUP BY action, menu
            ORDER BY count DESC
        `, [], true);
    }

    async recordAnalytics(userId, action, menu, sessionId, ipAddress, userAgent) {
        return this.run(`
            INSERT INTO analytics (user_id, action, menu, session_id, ip_address, user_agent, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [userId, action, menu, sessionId, ipAddress, userAgent]);
    }

    // Cleanup and shutdown
    async close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) console.error('Error closing database:', err);
                else console.log('Database connection closed');
                resolve();
            });
        });
    }

    // Cache statistics for monitoring
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
            hits: this.cacheHits,
            misses: this.cacheMisses
        };
    }
}

module.exports = OptimizedDatabaseService;