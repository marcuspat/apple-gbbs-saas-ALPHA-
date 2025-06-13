// Authentication Routes
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthRoutes {
    constructor(db, jwtSecret, saltRounds, emailService) {
        this.db = db;
        this.jwtSecret = jwtSecret;
        this.saltRounds = saltRounds;
        this.emailService = emailService;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.post('/register', this.register.bind(this));
        this.router.post('/login', this.login.bind(this));
        this.router.post('/reset-password-request', this.requestPasswordReset.bind(this));
        this.router.post('/reset-password', this.resetPassword.bind(this));
    }

    async register(req, res) {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        try {
            const passwordHash = await bcrypt.hash(password, this.saltRounds);
            
            this.db.run(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
                   [username.toUpperCase(), email, passwordHash], async function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ message: 'Username or email already exists' });
                    }
                    return res.status(500).json({ message: 'Registration failed' });
                }
                
                const token = jwt.sign({ id: this.lastID, username: username.toUpperCase() }, req.app.locals.jwtSecret);
                
                // Send welcome email
                try {
                    await req.app.locals.emailService.sendWelcomeEmail(email, username.toUpperCase());
                } catch (emailError) {
                    console.error('Failed to send welcome email:', emailError);
                }
                
                res.json({
                    message: 'Registration successful',
                    token,
                    user: { id: this.lastID, username: username.toUpperCase(), email }
                });
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    }

    async login(req, res) {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Missing credentials' });
        }
        
        this.db.get(`SELECT * FROM users WHERE username = ? AND is_active = 1`,
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
                this.db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP, total_logins = total_logins + 1 
                        WHERE id = ?`, [user.id]);
                
                const token = jwt.sign({ id: user.id, username: user.username }, this.jwtSecret);
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
    }

    async requestPasswordReset(req, res) {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        
        this.db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!user) {
                return res.json({ message: 'If email exists, reset link has been sent' });
            }
            
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour
            
            this.db.run(`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
                   [user.id, resetToken, expiresAt], async (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Server error' });
                }
                
                try {
                    await this.emailService.sendPasswordResetEmail(email, resetToken);
                    res.json({ message: 'If email exists, reset link has been sent' });
                } catch (emailError) {
                    console.error('Failed to send reset email:', emailError);
                    res.status(500).json({ message: 'Failed to send reset email' });
                }
            });
        });
    }

    async resetPassword(req, res) {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        this.db.get(`SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0`,
               [token], async (err, tokenRecord) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!tokenRecord) {
                return res.status(400).json({ message: 'Invalid or expired token' });
            }
            
            try {
                const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
                
                this.db.run(`UPDATE users SET password_hash = ? WHERE id = ?`,
                       [passwordHash, tokenRecord.user_id], (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to update password' });
                    }
                    
                    this.db.run(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`, [tokenRecord.id]);
                    res.json({ message: 'Password updated successfully' });
                });
            } catch (error) {
                res.status(500).json({ message: 'Server error' });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AuthRoutes;