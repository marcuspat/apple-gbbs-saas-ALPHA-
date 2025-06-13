-- Optimized Database Schema for Apple GBBS SaaS
-- Fixes identified structural problems and improves performance

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

CREATE INDEX IF NOT EXISTS idx_messages_board_id ON messages(board_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_board_created ON messages(board_id, created_at);

CREATE INDEX IF NOT EXISTS idx_files_area_id ON files(area_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_action ON analytics(action);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_door_games_active ON door_games(active);
CREATE INDEX IF NOT EXISTS idx_door_games_category ON door_games(category);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_last_activity ON game_sessions(last_activity);

-- New optimized tables for better performance and structure

-- Cache table for AI responses
CREATE TABLE IF NOT EXISTS ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    response TEXT NOT NULL,
    model TEXT NOT NULL,
    token_count INTEGER,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache(expires_at);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- Email queue for better reliability
CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    priority INTEGER DEFAULT 3,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending',
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);

-- Chat rooms table for better organization
CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    max_users INTEGER DEFAULT 50,
    is_private BOOLEAN DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Persistent chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    edited BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at);

-- Session management for better tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Insert default chat room
INSERT OR IGNORE INTO chat_rooms (id, name, description, created_by) 
VALUES (1, 'General Chat', 'Main chat room for all users', 1);

-- Insert default system configuration
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('max_upload_size', '10485760', 'integer', 'Maximum file upload size in bytes'),
('session_timeout', '86400', 'integer', 'Session timeout in seconds'),
('rate_limit_window', '900', 'integer', 'Rate limit window in seconds'),
('rate_limit_max_requests', '100', 'integer', 'Maximum requests per window'),
('ai_cache_ttl', '3600', 'integer', 'AI response cache TTL in seconds'),
('chat_message_retention', '2592000', 'integer', 'Chat message retention in seconds (30 days)'),
('email_batch_size', '50', 'integer', 'Email processing batch size'),
('websocket_heartbeat', '30', 'integer', 'WebSocket heartbeat interval in seconds');

-- Views for better query performance
CREATE VIEW IF NOT EXISTS active_users AS
SELECT u.*, s.status as subscription_status, s.current_period_end
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.is_active = 1;

CREATE VIEW IF NOT EXISTS board_stats AS
SELECT 
    b.id,
    b.name,
    b.description,
    COUNT(m.id) as total_messages,
    MAX(m.created_at) as last_post_date,
    COUNT(DISTINCT m.user_id) as unique_posters
FROM boards b
LEFT JOIN messages m ON b.id = m.board_id
WHERE b.is_active = 1
GROUP BY b.id, b.name, b.description;

CREATE VIEW IF NOT EXISTS user_activity_summary AS
SELECT 
    u.id,
    u.username,
    u.subscription_tier,
    u.total_logins,
    u.last_login,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT f.id) as total_uploads,
    MAX(a.created_at) as last_activity
FROM users u
LEFT JOIN messages m ON u.id = m.user_id
LEFT JOIN files f ON u.id = f.uploaded_by
LEFT JOIN analytics a ON u.id = a.user_id
WHERE u.is_active = 1
GROUP BY u.id, u.username, u.subscription_tier, u.total_logins, u.last_login;