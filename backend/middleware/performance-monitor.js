// Performance Monitoring Middleware
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: 0,
            totalResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            errorCount: 0,
            slowQueries: [],
            activeConnections: 0,
            memoryUsage: []
        };
        
        this.slowQueryThreshold = 1000; // 1 second
        this.memoryCheckInterval = 30000; // 30 seconds
        
        this.startMemoryMonitoring();
    }

    middleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            const startCpuUsage = process.cpuUsage();
            
            this.metrics.requests++;
            this.metrics.activeConnections++;

            // Override res.end to capture response metrics
            const originalEnd = res.end;
            res.end = (...args) => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                const cpuUsage = process.cpuUsage(startCpuUsage);

                // Update metrics
                this.updateResponseMetrics(responseTime, req, res);
                this.checkSlowQuery(responseTime, req);
                this.logRequest(req, res, responseTime, cpuUsage);

                this.metrics.activeConnections--;
                
                // Call original end method
                originalEnd.apply(res, args);
            };

            next();
        };
    }

    updateResponseMetrics(responseTime, req, res) {
        this.metrics.totalResponseTime += responseTime;
        this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
        this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);

        if (res.statusCode >= 400) {
            this.metrics.errorCount++;
        }

        // Set response time header for client debugging
        res.set('X-Response-Time', `${responseTime}ms`);
    }

    checkSlowQuery(responseTime, req) {
        if (responseTime > this.slowQueryThreshold) {
            this.metrics.slowQueries.push({
                url: req.originalUrl,
                method: req.method,
                responseTime,
                timestamp: new Date().toISOString(),
                userAgent: req.get('user-agent')
            });

            // Keep only last 100 slow queries
            if (this.metrics.slowQueries.length > 100) {
                this.metrics.slowQueries.shift();
            }

            console.warn(`Slow query detected: ${req.method} ${req.originalUrl} (${responseTime}ms)`);
        }
    }

    logRequest(req, res, responseTime, cpuUsage) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime,
            cpuUser: cpuUsage.user / 1000, // Convert to milliseconds
            cpuSystem: cpuUsage.system / 1000,
            userAgent: req.get('user-agent'),
            ip: req.ip
        };

        // Log slow requests or errors
        if (responseTime > this.slowQueryThreshold || res.statusCode >= 400) {
            console.log('Performance log:', JSON.stringify(logEntry));
        }
    }

    startMemoryMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: new Date().toISOString(),
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            });

            // Keep only last 100 memory snapshots
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage.shift();
            }

            // Alert if memory usage is high
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            if (heapUsedMB > 500) { // Alert if heap usage > 500MB
                console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB heap used`);
            }
        }, this.memoryCheckInterval);
    }

    getMetrics() {
        const avgResponseTime = this.metrics.requests > 0 
            ? this.metrics.totalResponseTime / this.metrics.requests 
            : 0;

        const latestMemory = this.metrics.memoryUsage.length > 0
            ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
            : null;

        return {
            requests: this.metrics.requests,
            averageResponseTime: Math.round(avgResponseTime),
            maxResponseTime: this.metrics.maxResponseTime,
            minResponseTime: this.metrics.minResponseTime === Infinity ? 0 : this.metrics.minResponseTime,
            errorCount: this.metrics.errorCount,
            errorRate: this.metrics.requests > 0 ? (this.metrics.errorCount / this.metrics.requests * 100).toFixed(2) : 0,
            activeConnections: this.metrics.activeConnections,
            slowQueryCount: this.metrics.slowQueries.length,
            recentSlowQueries: this.metrics.slowQueries.slice(-10),
            memoryUsage: latestMemory,
            uptime: process.uptime()
        };
    }

    getDetailedMetrics() {
        return {
            ...this.getMetrics(),
            allSlowQueries: this.metrics.slowQueries,
            memoryHistory: this.metrics.memoryUsage
        };
    }

    reset() {
        this.metrics = {
            requests: 0,
            totalResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            errorCount: 0,
            slowQueries: [],
            activeConnections: 0,
            memoryUsage: []
        };
    }

    // Create middleware for specific route monitoring
    createRouteMonitor(routeName) {
        const routeMetrics = new Map();

        return (req, res, next) => {
            const startTime = Date.now();

            const originalEnd = res.end;
            res.end = (...args) => {
                const responseTime = Date.now() - startTime;
                
                if (!routeMetrics.has(routeName)) {
                    routeMetrics.set(routeName, {
                        count: 0,
                        totalTime: 0,
                        maxTime: 0,
                        errors: 0
                    });
                }

                const metrics = routeMetrics.get(routeName);
                metrics.count++;
                metrics.totalTime += responseTime;
                metrics.maxTime = Math.max(metrics.maxTime, responseTime);
                
                if (res.statusCode >= 400) {
                    metrics.errors++;
                }

                originalEnd.apply(res, args);
            };

            next();
        };
    }

    // Health check endpoint data
    getHealthCheck() {
        const metrics = this.getMetrics();
        const isHealthy = metrics.errorRate < 10 && 
                         metrics.averageResponseTime < 2000 && 
                         metrics.activeConnections < 1000;

        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.version,
            metrics: {
                requests: metrics.requests,
                averageResponseTime: metrics.averageResponseTime,
                errorRate: metrics.errorRate,
                activeConnections: metrics.activeConnections,
                memoryUsageMB: metrics.memoryUsage ? 
                    (metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2) : 0
            }
        };
    }
}

module.exports = PerformanceMonitor;