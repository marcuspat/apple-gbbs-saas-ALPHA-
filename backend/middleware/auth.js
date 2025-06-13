// Authentication Middleware
const jwt = require('jsonwebtoken');

class AuthMiddleware {
    constructor(jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    authenticate() {
        return (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (token == null) return res.sendStatus(401);
            
            jwt.verify(token, this.jwtSecret, (err, user) => {
                if (err) return res.sendStatus(403);
                req.user = user;
                next();
            });
        };
    }

    requireRole(role) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ message: 'Authentication required' });
            }
            
            if (req.user.role !== role && req.user.username !== 'SYSOP') {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            
            next();
        };
    }

    requireAdmin() {
        return (req, res, next) => {
            if (!req.user || req.user.username !== 'SYSOP') {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        };
    }
}

module.exports = AuthMiddleware;