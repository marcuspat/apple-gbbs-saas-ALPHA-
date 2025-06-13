// Database Schema Configuration
const bcrypt = require('bcrypt');

class DatabaseSchema {
    constructor(db, saltRounds = 10) {
        this.db = db;
        this.saltRounds = saltRounds;
    }

    async initializeTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Users table
                this.db.run(`CREATE TABLE IF NOT EXISTS users (
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
                this.db.run(`CREATE TABLE IF NOT EXISTS boards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    tenant_id TEXT DEFAULT 'default',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )`);
                
                // Messages table
                this.db.run(`CREATE TABLE IF NOT EXISTS messages (
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
                this.db.run(`CREATE TABLE IF NOT EXISTS files (
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
                this.db.run(`CREATE TABLE IF NOT EXISTS analytics (
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
                this.db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
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
                
                // Payments table
                this.db.run(`CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    subscription_id TEXT,
                    amount INTEGER,
                    currency TEXT,
                    status TEXT,
                    stripe_invoice_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`);
                
                // Password reset tokens table
                this.db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    token TEXT UNIQUE,
                    expires_at DATETIME,
                    used BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`);
                
                // Door games table
                this.db.run(`CREATE TABLE IF NOT EXISTS door_games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    command TEXT,
                    active BOOLEAN DEFAULT 1,
                    category TEXT DEFAULT 'general',
                    max_players INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                
                // Game sessions table
                this.db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    game_id INTEGER,
                    session_data TEXT,
                    status TEXT DEFAULT 'active',
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (game_id) REFERENCES door_games (id)
                )`);

                this.createIndexes();
                this.insertDefaultData();
                resolve();
            });
        });
    }

    createIndexes() {
        // Performance indexes for frequently queried columns
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_board_id ON messages (board_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_files_area_id ON files (area_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics (created_at)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_game_sessions_user_game ON game_sessions (user_id, game_id)`);
    }

    insertDefaultData() {
        // Insert default boards
        this.db.run(`INSERT OR IGNORE INTO boards (name, description) VALUES 
            ('General Discussion', 'General chat and discussions'),
            ('Retro Computing', 'Talk about vintage computers and systems'),
            ('BBS Nostalgia', 'Share memories of the BBS era'),
            ('Programming', 'Programming discussions and help'),
            ('Apple II Help', 'Help and support for Apple II systems')`);
        
        // Insert default door games
        this.db.run(`INSERT OR IGNORE INTO door_games (name, description, command, category) VALUES 
            ('Guess the Number', 'Classic number guessing game', 'GUESS', 'classic'),
            ('Star Trek', 'Navigate space and battle Klingons', 'TREK', 'adventure'),
            ('Hangman', 'Word guessing game', 'HANGMAN', 'word'),
            ('Adventure Quest', 'Text-based adventure game', 'ADVENTURE', 'adventure'),
            ('Trivia Challenge', 'Test your knowledge', 'TRIVIA', 'quiz')`);
        
        // Create default admin user
        bcrypt.hash('admin123', this.saltRounds, (err, hash) => {
            if (err) throw err;
            this.db.run(`INSERT OR IGNORE INTO users (username, email, password_hash, subscription_tier) 
                    VALUES ('SYSOP', 'admin@retrobbs.com', ?, 'enterprise')`, [hash]);
        });
    }
}

module.exports = DatabaseSchema;