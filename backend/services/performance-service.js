/**
 * Performance Optimization Service
 * Handles caching, monitoring, and performance optimizations
 */
class PerformanceService {
    constructor(databaseService) {
        this.db = databaseService;
        this.cache = new Map();
        this.metrics = {
            requests: 0,
            responses: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0,
            peakMemory: 0,
            startTime: Date.now()
        };
        this.responseTimeSamples = [];
        this.maxSamples = 1000;
        this.defaultCacheTTL = 300000; // 5 minutes
        this.maxCacheSize = 1000;
        this.compressionThreshold = 1024; // 1KB
        
        this.setupMonitoring();
        this.startCleanupTimer();
    }
    
    /**
     * Setup performance monitoring
     */
    setupMonitoring() {
        // Monitor memory usage
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.peakMemory = Math.max(this.metrics.peakMemory, memUsage.heapUsed);
            
            // Log memory warnings
            const memoryMB = memUsage.heapUsed / 1024 / 1024;
            if (memoryMB > 500) { // 500MB warning threshold
                console.warn(`High memory usage: ${memoryMB.toFixed(2)}MB`);
            }
        }, 30000); // Every 30 seconds
        
        // Cleanup expired cache entries
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 60000); // Every minute
        
        console.log('Performance monitoring started');
    }
    
    /**
     * Middleware for request/response timing
     */
    timingMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            this.metrics.requests++;
            
            // Override res.json to capture response
            const originalJson = res.json;
            res.json = function(data) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                // Update metrics
                this.metrics.responses++;
                this.responseTimeSamples.push(responseTime);
                
                // Keep only recent samples
                if (this.responseTimeSamples.length > this.maxSamples) {
                    this.responseTimeSamples.shift();
                }
                
                // Calculate average response time
                this.metrics.avgResponseTime = this.responseTimeSamples.reduce((a, b) => a + b, 0) / this.responseTimeSamples.length;
                
                // Log slow requests
                if (responseTime > 5000) { // 5 second threshold
                    console.warn(`Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
                }
                
                return originalJson.call(this, data);
            }.bind(this);
            
            // Handle errors
            res.on('error', () => {
                this.metrics.errors++;
            });
            
            next();
        };
    }
    
    /**
     * Cache management
     */
    setCache(key, value, ttl = this.defaultCacheTTL) {
        // Check cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldestEntries(Math.floor(this.maxCacheSize * 0.1)); // Remove 10%
        }
        
        // Compress large objects
        let storedValue = value;
        let compressed = false;
        
        if (typeof value === 'object') {
            const jsonString = JSON.stringify(value);
            if (jsonString.length > this.compressionThreshold) {
                // In a real implementation, you might use zlib compression
                compressed = true;
                console.log(`Large object cached: ${key} (${jsonString.length} chars)`);
            }
            storedValue = jsonString;
        }
        
        this.cache.set(key, {
            value: storedValue,
            expires: Date.now() + ttl,
            compressed,
            created: Date.now(),
            hits: 0
        });
    }
    
    getCache(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.metrics.cacheMisses++;
            return null;
        }
        
        // Check expiration
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            this.metrics.cacheMisses++;
            return null;
        }
        
        // Update hit count
        entry.hits++;
        this.metrics.cacheHits++;
        
        // Parse JSON if needed
        if (entry.compressed || typeof entry.value === 'string') {
            try {
                return JSON.parse(entry.value);
            } catch (error) {
                return entry.value;
            }
        }
        
        return entry.value;
    }
    
    deleteCache(key) {
        return this.cache.delete(key);
    }
    
    clearCache() {
        this.cache.clear();
        console.log('Cache cleared');
    }
    
    /**
     * Evict oldest cache entries
     */
    evictOldestEntries(count) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].created - b[1].created)
            .slice(0, count);
        
        entries.forEach(([key]) => {
            this.cache.delete(key);
        });
        
        console.log(`Evicted ${count} cache entries`);
    }
    
    /**
     * Clean up expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired cache entries`);
        }
    }
    
    /**
     * Query optimization helpers
     */
    async optimizeQuery(sql, params = [], cacheKey = null, cacheTTL = this.defaultCacheTTL) {
        // Check cache first
        if (cacheKey) {
            const cached = this.getCache(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }
        
        const startTime = Date.now();
        
        try {
            const result = await this.db.query(sql, params);
            const queryTime = Date.now() - startTime;
            
            // Log slow queries
            if (queryTime > 1000) { // 1 second threshold
                console.warn(`Slow query (${queryTime}ms): ${sql.substring(0, 100)}...`);
            }
            
            // Cache result if key provided
            if (cacheKey && result) {
                this.setCache(cacheKey, result, cacheTTL);
            }
            
            return result;
        } catch (error) {
            console.error(`Query failed (${Date.now() - startTime}ms): ${sql.substring(0, 100)}...`);
            throw error;
        }
    }
    
    /**
     * Batch operations for better performance
     */
    async batchInsert(tableName, records, batchSize = 100) {
        if (!records || records.length === 0) return [];
        
        const results = [];
        const batches = this.chunkArray(records, batchSize);
        
        for (const batch of batches) {
            try {
                const queries = batch.map(record => {
                    const columns = Object.keys(record);
                    const values = Object.values(record);
                    const placeholders = columns.map(() => '?').join(', ');
                    
                    return {
                        sql: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                        params: values
                    };
                });
                
                const batchResult = await this.db.transaction(queries);
                results.push(...batchResult);
                
            } catch (error) {
                console.error(`Batch insert failed for ${tableName}:`, error);
                throw error;
            }
        }
        
        return results;
    }
    
    /**
     * Connection pooling simulation
     */
    async withConnection(operation) {
        // In a real implementation, this would manage a pool of connections
        const connectionStart = Date.now();
        
        try {
            const result = await operation();
            const connectionTime = Date.now() - connectionStart;
            
            if (connectionTime > 10000) { // 10 second threshold
                console.warn(`Long-running operation: ${connectionTime}ms`);
            }
            
            return result;
        } catch (error) {
            console.error(`Connection operation failed after ${Date.now() - connectionStart}ms`);
            throw error;
        }
    }
    
    /**
     * Data compression helpers
     */
    compressData(data) {
        if (typeof data === 'object') {
            // Simple JSON compression by removing whitespace
            return JSON.stringify(data);
        }
        return data;
    }
    
    decompressData(compressedData) {
        try {
            return JSON.parse(compressedData);
        } catch (error) {
            return compressedData;
        }
    }
    
    /**
     * Rate limiting for expensive operations
     */
    async rateLimitOperation(key, operation, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
        
        let count = this.getCache(windowKey) || 0;
        
        if (count >= limit) {
            throw new Error('Rate limit exceeded for operation');
        }
        
        // Execute operation
        const result = await operation();
        
        // Update counter
        this.setCache(windowKey, count + 1, windowMs);
        
        return result;
    }
    
    /**
     * Utility functions
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    /**
     * Performance metrics
     */
    getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
        const errorRate = this.metrics.errors / this.metrics.requests * 100;
        
        return {
            ...this.metrics,
            uptime,
            cacheHitRate: isNaN(cacheHitRate) ? 0 : cacheHitRate.toFixed(2),
            errorRate: isNaN(errorRate) ? 0 : errorRate.toFixed(2),
            cacheSize: this.cache.size,
            memoryUsage: process.memoryUsage()
        };
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        const metrics = this.getMetrics();
        
        try {
            // Test database connection
            await this.db.get('SELECT 1 as test');
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                responseTime,
                metrics,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                metrics,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Performance optimization recommendations
     */
    getOptimizationRecommendations() {
        const recommendations = [];
        const metrics = this.getMetrics();
        
        // Cache hit rate
        if (metrics.cacheHitRate < 80) {
            recommendations.push({
                type: 'cache',
                priority: 'medium',
                message: `Cache hit rate is ${metrics.cacheHitRate}%. Consider increasing cache TTL or caching more data.`
            });
        }
        
        // Response time
        if (metrics.avgResponseTime > 1000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: `Average response time is ${metrics.avgResponseTime.toFixed(2)}ms. Consider query optimization.`
            });
        }
        
        // Error rate
        if (metrics.errorRate > 5) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: `Error rate is ${metrics.errorRate}%. Investigate error sources.`
            });
        }
        
        // Memory usage
        const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryMB > 400) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                message: `Memory usage is ${memoryMB.toFixed(2)}MB. Consider cache size reduction or memory cleanup.`
            });
        }
        
        return recommendations;
    }
    
    /**
     * Database optimization analysis
     */
    async analyzeDatabase() {
        try {
            const analyses = [];
            
            // Table sizes
            const tables = ['users', 'messages', 'files', 'analytics', 'chat_messages'];
            for (const table of tables) {
                try {
                    const count = await this.db.get(`SELECT COUNT(*) as count FROM ${table}`);
                    analyses.push({
                        table,
                        recordCount: count.count,
                        recommendation: count.count > 100000 ? 'Consider archiving old records' : 'Table size OK'
                    });
                } catch (error) {
                    console.error(`Failed to analyze table ${table}:`, error);
                }
            }
            
            return analyses;
        } catch (error) {
            console.error('Database analysis failed:', error);
            return [];
        }
    }
    
    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        // Daily cleanup
        setInterval(() => {
            this.performDailyCleanup();
        }, 24 * 60 * 60 * 1000); // 24 hours
        
        console.log('Cleanup timer started');
    }
    
    /**
     * Daily cleanup operations
     */
    async performDailyCleanup() {
        console.log('Starting daily cleanup...');
        
        try {
            // Clear old cache entries
            this.cleanupExpiredCache();
            
            // Database cleanup
            await this.db.cleanup();
            
            // Reset daily metrics
            this.metrics.requests = 0;
            this.metrics.responses = 0;
            this.metrics.errors = 0;
            this.responseTimeSamples = [];
            
            console.log('Daily cleanup completed');
        } catch (error) {
            console.error('Daily cleanup failed:', error);
        }
    }
}

module.exports = PerformanceService;