// API Integration Tests
const request = require('supertest');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// This will test the actual server integration
describe('BBS API Integration Tests', () => {
  let server;
  let app;
  let db;
  let wsPort;
  
  beforeAll(async () => {
    // Create test database
    db = new sqlite3.Database(':memory:');
    
    // Initialize test database schema
    await setupTestDatabase();
    
    // Start test server
    const port = 0; // Use random port
    server = http.createServer();
    server.listen(port);
    wsPort = server.address().port;
    
    // Mock the actual app startup
    // This test should FAIL initially until we integrate with real server
  });
  
  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (db) {
      db.close();
    }
  });
  
  beforeEach(async () => {
    // Clean database between tests
    await cleanTestDatabase();
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full registration and login flow', async () => {
      // This test should FAIL initially
      
      // Step 1: Register new user
      const registrationData = {
        username: 'INTEGRATIONTEST',
        email: 'integration@test.com',
        password: 'testpassword123'
      };
      
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData);
      
      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body).toHaveProperty('token');
      const token = registerResponse.body.token;
      
      // Step 2: Use token to access protected route
      const protectedResponse = await request(app)
        .get('/api/boards')
        .set('Authorization', `Bearer ${token}`);
      
      expect(protectedResponse.status).toBe(200);
      
      // Step 3: Login with same credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: registrationData.username,
          password: registrationData.password
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');
    });

    test('should handle password reset flow', async () => {
      // This test should FAIL initially
      
      // Step 1: Create user
      await createTestUser('RESETTEST', 'reset@test.com', 'oldpassword');
      
      // Step 2: Request password reset
      const resetRequestResponse = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'reset@test.com' });
      
      expect(resetRequestResponse.status).toBe(200);
      
      // Step 3: Get reset token (in real app, this would be from email)
      const tokenRecord = await getResetTokenFromDb('reset@test.com');
      
      // Step 4: Reset password
      const resetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: tokenRecord.token,
          newPassword: 'newpassword123'
        });
      
      expect(resetResponse.status).toBe(200);
      
      // Step 5: Login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'RESETTEST',
          password: 'newpassword123'
        });
      
      expect(loginResponse.status).toBe(200);
    });
  });

  describe('Message Board Integration', () => {
    let authToken;
    let userId;
    
    beforeEach(async () => {
      // Create and authenticate test user
      const user = await createTestUser('BOARDTEST', 'board@test.com', 'password123');
      userId = user.id;
      authToken = generateTestToken(user);
    });

    test('should complete full message posting flow', async () => {
      // This test should FAIL initially
      
      // Step 1: Get boards list
      const boardsResponse = await request(app)
        .get('/api/boards');
      
      expect(boardsResponse.status).toBe(200);
      expect(boardsResponse.body.length).toBeGreaterThan(0);
      
      const boardId = boardsResponse.body[0].id;
      
      // Step 2: Post message to board
      const messageData = {
        subject: 'Integration Test Message',
        content: 'This is a test message from integration tests'
      };
      
      const postResponse = await request(app)
        .post(`/api/boards/${boardId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData);
      
      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toHaveProperty('id');
      
      // Step 3: Verify message appears in board
      const messagesResponse = await request(app)
        .get(`/api/boards/${boardId}/messages`);
      
      expect(messagesResponse.status).toBe(200);
      const messages = messagesResponse.body;
      
      const newMessage = messages.find(m => m.subject === messageData.subject);
      expect(newMessage).toBeDefined();
      expect(newMessage.content).toBe(messageData.content);
      expect(newMessage.username).toBe('BOARDTEST');
    });

    test('should handle message pagination correctly', async () => {
      // This test should FAIL initially
      
      const boardId = 1;
      
      // Create multiple messages
      for (let i = 0; i < 25; i++) {
        await request(app)
          .post(`/api/boards/${boardId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            subject: `Test Message ${i}`,
            content: `Content for message ${i}`
          });
      }
      
      // Test pagination
      const page1Response = await request(app)
        .get(`/api/boards/${boardId}/messages?limit=10&offset=0`);
      
      const page2Response = await request(app)
        .get(`/api/boards/${boardId}/messages?limit=10&offset=10`);
      
      expect(page1Response.body).toHaveLength(10);
      expect(page2Response.body).toHaveLength(10);
      
      // Verify different messages on different pages
      expect(page1Response.body[0].id).not.toBe(page2Response.body[0].id);
    });
  });

  describe('File Upload Integration', () => {
    let authToken;
    
    beforeEach(async () => {
      const user = await createTestUser('FILETEST', 'file@test.com', 'password123');
      authToken = generateTestToken(user);
    });

    test('should complete full file upload and download flow', async () => {
      // This test should FAIL initially
      
      // Step 1: Upload file
      const testFileContent = 'This is test file content for integration testing';
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(testFileContent), 'test-integration.txt')
        .field('description', 'Integration test file')
        .field('area_id', '1');
      
      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body).toHaveProperty('id');
      
      const fileId = uploadResponse.body.id;
      
      // Step 2: Verify file appears in file list
      const filesResponse = await request(app)
        .get('/api/files/1');
      
      expect(filesResponse.status).toBe(200);
      const files = filesResponse.body;
      
      const uploadedFile = files.find(f => f.id === fileId);
      expect(uploadedFile).toBeDefined();
      expect(uploadedFile.original_name).toBe('test-integration.txt');
      expect(uploadedFile.description).toBe('Integration test file');
      
      // Step 3: Download file
      const downloadResponse = await request(app)
        .get(`/api/files/download/${fileId}`);
      
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.text).toBe(testFileContent);
      
      // Step 4: Verify download count incremented
      const filesResponseAfter = await request(app)
        .get('/api/files/1');
      
      const fileAfterDownload = filesResponseAfter.body.find(f => f.id === fileId);
      expect(fileAfterDownload.download_count).toBe(1);
    });
  });

  describe('WebSocket Integration', () => {
    let ws;
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle WebSocket connection and messaging', async () => {
      // This test should FAIL initially
      
      return new Promise((resolve, reject) => {
        ws = new WebSocket(`ws://localhost:${wsPort}`);
        
        ws.on('open', () => {
          // Send test message
          ws.send(JSON.stringify({
            type: 'chat',
            data: { message: 'Integration test message' }
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          
          if (message.type === 'user_count') {
            expect(message.data).toBeGreaterThanOrEqual(1);
          } else if (message.type === 'chat') {
            expect(message.data.message).toBe('Integration test message');
            expect(message.data.username).toBe('GUEST');
            resolve();
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('WebSocket test timeout')), 5000);
      });
    });

    test('should handle multiple concurrent WebSocket connections', async () => {
      // This test should FAIL initially
      
      const connections = [];
      const messagePromises = [];
      
      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}`);
        connections.push(ws);
        
        const messagePromise = new Promise((resolve) => {
          ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'user_count') {
              resolve(message.data);
            }
          });
        });
        
        messagePromises.push(messagePromise);
      }
      
      const userCounts = await Promise.all(messagePromises);
      
      // All connections should see the same user count
      userCounts.forEach(count => {
        expect(count).toBe(5);
      });
      
      // Clean up
      connections.forEach(ws => ws.close());
    });
  });

  describe('Analytics Integration', () => {
    let authToken;
    let userId;
    
    beforeEach(async () => {
      const user = await createTestUser('ANALYTICSTEST', 'analytics@test.com', 'password123');
      userId = user.id;
      authToken = generateTestToken(user);
    });

    test('should record and retrieve analytics data', async () => {
      // This test should FAIL initially
      
      // Step 1: Generate some analytics via WebSocket
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'analytics',
            data: {
              command: 'M',
              menu: 'main'
            }
          }));
          resolve();
        });
      });
      
      ws.close();
      
      // Step 2: Retrieve analytics (admin only)
      const adminUser = await createTestUser('SYSOP', 'admin@test.com', 'adminpass');
      const adminToken = generateTestToken(adminUser);
      
      const analyticsResponse = await request(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.length).toBeGreaterThan(0);
      
      const analyticsEntry = analyticsResponse.body.find(a => a.action === 'M');
      expect(analyticsEntry).toBeDefined();
      expect(analyticsEntry.menu).toBe('main');
    });
  });

  describe('System Stats Integration', () => {
    test('should return accurate system statistics', async () => {
      // This test should FAIL initially
      
      // Step 1: Create test data
      await createTestUser('STATSTEST1', 'stats1@test.com', 'password');
      await createTestUser('STATSTEST2', 'stats2@test.com', 'password');
      
      const user = await createTestUser('STATSTEST3', 'stats3@test.com', 'password');
      const token = generateTestToken(user);
      
      // Create test messages
      await request(app)
        .post('/api/boards/1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Stats Test', content: 'Test message' });
      
      // Step 2: Get system stats
      const statsResponse = await request(app)
        .get('/api/stats');
      
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body).toHaveProperty('total_users');
      expect(statsResponse.body).toHaveProperty('total_messages');
      expect(statsResponse.body).toHaveProperty('online_users');
      expect(statsResponse.body).toHaveProperty('system_uptime');
      
      expect(statsResponse.body.total_users).toBeGreaterThanOrEqual(3);
      expect(statsResponse.body.total_messages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database connection errors gracefully', async () => {
      // This test should FAIL initially
      
      // Simulate database error by closing connection
      db.close();
      
      const response = await request(app)
        .get('/api/boards');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
    });

    test('should handle malformed requests', async () => {
      // This test should FAIL initially
      
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid-json');
      
      expect(response.status).toBe(400);
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create all necessary tables
        db.run(`CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          subscription_tier TEXT DEFAULT 'free',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1,
          total_logins INTEGER DEFAULT 0
        )`);
        
        db.run(`CREATE TABLE boards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1
        )`);
        
        db.run(`CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          board_id INTEGER,
          user_id INTEGER,
          subject TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (board_id) REFERENCES boards (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        db.run(`CREATE TABLE files (
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
        
        db.run(`CREATE TABLE analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT,
          menu TEXT,
          session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        db.run(`CREATE TABLE password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          token TEXT UNIQUE,
          expires_at DATETIME,
          used BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, resolve);
      });
    });
  }
  
  async function cleanTestDatabase() {
    return new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM messages');
        db.run('DELETE FROM files');
        db.run('DELETE FROM analytics');
        db.run('DELETE FROM password_reset_tokens');
        db.run('DELETE FROM users');
        db.run('DELETE FROM boards', resolve);
      });
    });
  }
  
  async function createTestUser(username, email, password) {
    const hash = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
             [username, email, hash], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, username, email });
      });
    });
  }
  
  function generateTestToken(user) {
    // Mock JWT generation for testing
    return `test-token-${user.id}-${user.username}`;
  }
  
  async function getResetTokenFromDb(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT token FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE email = ?)',
             [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
});