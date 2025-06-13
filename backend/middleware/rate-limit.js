// Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

class RateLimitMiddleware {
    static createApiLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: { message: 'Too many requests, please try again later' },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    static createAuthLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // limit each IP to 5 login attempts per windowMs
            message: { message: 'Too many login attempts, please try again later' },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true
        });
    }

    static createUploadLimiter() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10, // limit each IP to 10 uploads per hour
            message: { message: 'Upload limit exceeded, please try again later' },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    static createChatLimiter() {
        return rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 30, // limit each IP to 30 messages per minute
            message: { message: 'Chat rate limit exceeded' },
            standardHeaders: true,
            legacyHeaders: false
        });
    }
}

module.exports = RateLimitMiddleware;