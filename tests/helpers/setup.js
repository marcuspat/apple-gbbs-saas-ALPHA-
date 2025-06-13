// Global test setup
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_webhook_secret';
process.env.OPENAI_API_KEY = 'sk-test-fake-openai-key-for-testing';

// Global test database setup
let testDb;

beforeAll(async () => {
  // Create test database in memory
  testDb = new sqlite3.Database(':memory:');
  
  // Create test database tables
  await setupTestDatabase(testDb);
});

afterAll(async () => {
  // Close test database
  if (testDb) {
    testDb.close();
  }
});

beforeEach(() => {
  // Clear any existing mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore any mocked functions
  jest.restoreAllMocks();
});

// Helper function to setup test database schema
function setupTestDatabase(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
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
      db.run(`CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )`);
      
      // Messages table
      db.run(`CREATE TABLE IF NOT EXISTS messages (
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
      db.run(`CREATE TABLE IF NOT EXISTS files (
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
      db.run(`CREATE TABLE IF NOT EXISTS analytics (
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
      db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
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
      
      resolve();
    });
  });
}

// Export test database for use in tests
global.testDb = testDb;

// Common test utilities
global.testUtils = {
  // Create test user
  createTestUser: (db = testDb, userData = {}) => {
    return new Promise((resolve, reject) => {
      const user = {
        username: 'TESTUSER',
        email: 'test@example.com',
        password_hash: '$2b$10$test.hash.for.testing',
        subscription_tier: 'free',
        ...userData
      };
      
      db.run(
        `INSERT INTO users (username, email, password_hash, subscription_tier) VALUES (?, ?, ?, ?)`,
        [user.username, user.email, user.password_hash, user.subscription_tier],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...user });
        }
      );
    });
  },
  
  // Create test board
  createTestBoard: (db = testDb, boardData = {}) => {
    return new Promise((resolve, reject) => {
      const board = {
        name: 'Test Board',
        description: 'Test board description',
        ...boardData
      };
      
      db.run(
        `INSERT INTO boards (name, description) VALUES (?, ?)`,
        [board.name, board.description],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...board });
        }
      );
    });
  },
  
  // Create test message
  createTestMessage: (db = testDb, messageData = {}) => {
    return new Promise((resolve, reject) => {
      const message = {
        board_id: 1,
        user_id: 1,
        subject: 'Test Message',
        content: 'Test message content',
        ...messageData
      };
      
      db.run(
        `INSERT INTO messages (board_id, user_id, subject, content) VALUES (?, ?, ?, ?)`,
        [message.board_id, message.user_id, message.subject, message.content],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...message });
        }
      );
    });
  },
  
  // Clean test database
  cleanDatabase: (db = testDb) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM messages');
        db.run('DELETE FROM files');
        db.run('DELETE FROM boards');
        db.run('DELETE FROM users');
        db.run('DELETE FROM analytics');
        db.run('DELETE FROM subscriptions', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
};