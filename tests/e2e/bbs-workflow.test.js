// End-to-End BBS Workflow Tests
const request = require('supertest');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

describe('BBS End-to-End Workflow Tests', () => {
  let serverProcess;
  let serverUrl;
  let wsUrl;
  
  beforeAll(async () => {
    // Start the actual BBS server for E2E testing
    await startTestServer();
  }, 30000);
  
  afterAll(async () => {
    // Clean up test server
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Complete User Registration and Login Workflow', () => {
    test('should complete full user lifecycle', async () => {
      // This test should FAIL initially
      
      const userData = {
        username: 'E2EUSER',
        email: 'e2e@test.com',
        password: 'testpassword123'
      };
      
      // Step 1: Register new user
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body).toHaveProperty('token');
      expect(registerResponse.body.user.username).toBe('E2EUSER');
      
      const token = registerResponse.body.token;
      
      // Step 2: Login with new credentials
      const loginResponse = await request(serverUrl)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');
      
      // Step 3: Access protected resources
      const boardsResponse = await request(serverUrl)
        .get('/api/boards')
        .set('Authorization', `Bearer ${token}`);
      
      expect(boardsResponse.status).toBe(200);
      expect(Array.isArray(boardsResponse.body)).toBe(true);
      
      // Step 4: Post message to board
      const messageData = {
        subject: 'E2E Test Message',
        content: 'This is an end-to-end test message'
      };
      
      const postResponse = await request(serverUrl)
        .post('/api/boards/1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(messageData);
      
      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toHaveProperty('id');
      
      // Step 5: Verify message appears in board
      const messagesResponse = await request(serverUrl)
        .get('/api/boards/1/messages');
      
      expect(messagesResponse.status).toBe(200);
      const messages = messagesResponse.body;
      
      const newMessage = messages.find(m => m.subject === messageData.subject);
      expect(newMessage).toBeDefined();
      expect(newMessage.content).toBe(messageData.content);
    });

    test('should handle password reset workflow', async () => {
      // This test should FAIL initially
      
      // Step 1: Create user for password reset
      const userData = {
        username: 'RESETUSER',
        email: 'reset-e2e@test.com',
        password: 'oldpassword123'
      };
      
      await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      // Step 2: Request password reset
      const resetRequestResponse = await request(serverUrl)
        .post('/api/auth/reset-password-request')
        .send({ email: userData.email });
      
      expect(resetRequestResponse.status).toBe(200);
      
      // Step 3: Get reset token (simulate email retrieval)
      // In real E2E test, this might involve email checking
      const resetToken = await getResetTokenFromDatabase(userData.email);
      
      // Step 4: Reset password
      const newPassword = 'newpassword123';
      const resetResponse = await request(serverUrl)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword
        });
      
      expect(resetResponse.status).toBe(200);
      
      // Step 5: Login with new password
      const loginResponse = await request(serverUrl)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: newPassword
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');
      
      // Step 6: Verify old password no longer works
      const oldPasswordResponse = await request(serverUrl)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });
      
      expect(oldPasswordResponse.status).toBe(401);
    });
  });

  describe('Real-time Chat Workflow', () => {
    test('should handle multi-user chat session', async () => {
      // This test should FAIL initially
      
      return new Promise(async (resolve, reject) => {
        try {
          // Create two WebSocket connections
          const ws1 = new WebSocket(wsUrl);
          const ws2 = new WebSocket(wsUrl);
          
          let user1Messages = [];
          let user2Messages = [];
          let connectionsReady = 0;
          
          const checkReady = () => {
            connectionsReady++;
            if (connectionsReady === 2) {
              startChatTest();
            }
          };
          
          ws1.on('open', checkReady);
          ws2.on('open', checkReady);
          
          ws1.on('message', (data) => {
            user1Messages.push(JSON.parse(data));
          });
          
          ws2.on('message', (data) => {
            user2Messages.push(JSON.parse(data));
          });
          
          const startChatTest = () => {
            // User 1 sends a message
            ws1.send(JSON.stringify({
              type: 'chat',
              data: { message: 'Hello from user 1!' }
            }));
            
            // User 2 sends a message
            setTimeout(() => {
              ws2.send(JSON.stringify({
                type: 'chat',
                data: { message: 'Hello from user 2!' }
              }));
            }, 100);
            
            // Verify messages received
            setTimeout(() => {
              // Both users should receive both messages
              const user1ChatMessages = user1Messages.filter(m => m.type === 'chat');
              const user2ChatMessages = user2Messages.filter(m => m.type === 'chat');
              
              expect(user1ChatMessages.length).toBeGreaterThanOrEqual(1);
              expect(user2ChatMessages.length).toBeGreaterThanOrEqual(1);
              
              // Verify user count updates
              const user1CountMessages = user1Messages.filter(m => m.type === 'user_count');
              const user2CountMessages = user2Messages.filter(m => m.type === 'user_count');
              
              expect(user1CountMessages.length).toBeGreaterThan(0);
              expect(user2CountMessages.length).toBeGreaterThan(0);
              
              ws1.close();
              ws2.close();
              resolve();
            }, 500);
          };
          
          setTimeout(() => reject(new Error('Chat test timeout')), 5000);
          
        } catch (error) {
          reject(error);
        }
      });
    });

    test('should handle WebSocket reconnection', async () => {
      // This test should FAIL initially
      
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let reconnected = false;
        
        ws.on('open', () => {
          // Close connection to simulate network issue
          ws.close();
        });
        
        ws.on('close', () => {
          if (!reconnected) {
            reconnected = true;
            
            // Attempt reconnection
            const wsReconnect = new WebSocket(wsUrl);
            
            wsReconnect.on('open', () => {
              expect(wsReconnect.readyState).toBe(WebSocket.OPEN);
              wsReconnect.close();
              resolve();
            });
            
            wsReconnect.on('error', reject);
          }
        });
        
        setTimeout(() => reject(new Error('Reconnection test timeout')), 5000);
      });
    });
  });

  describe('File Upload and Download Workflow', () => {
    test('should complete file upload and download cycle', async () => {
      // This test should FAIL initially
      
      // Step 1: Register and login user
      const userData = {
        username: 'FILEUSER',
        email: 'file-e2e@test.com',
        password: 'filetest123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      const token = registerResponse.body.token;
      
      // Step 2: Create test file
      const testFileContent = 'This is a test file for E2E testing\nWith multiple lines\nAnd special characters: !@#$%^&*()';
      const testFileName = 'e2e-test-file.txt';
      
      // Step 3: Upload file
      const uploadResponse = await request(serverUrl)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(testFileContent), testFileName)
        .field('description', 'E2E test file upload');
      
      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body).toHaveProperty('id');
      
      const fileId = uploadResponse.body.id;
      
      // Step 4: Verify file appears in file list
      const filesResponse = await request(serverUrl)
        .get('/api/files/1');
      
      expect(filesResponse.status).toBe(200);
      const files = filesResponse.body;
      
      const uploadedFile = files.find(f => f.id === fileId);
      expect(uploadedFile).toBeDefined();
      expect(uploadedFile.original_name).toBe(testFileName);
      expect(uploadedFile.description).toBe('E2E test file upload');
      
      // Step 5: Download file
      const downloadResponse = await request(serverUrl)
        .get(`/api/files/download/${fileId}`);
      
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.text).toBe(testFileContent);
      
      // Step 6: Verify download count incremented
      const filesAfterDownload = await request(serverUrl)
        .get('/api/files/1');
      
      const fileAfterDownload = filesAfterDownload.body.find(f => f.id === fileId);
      expect(fileAfterDownload.download_count).toBe(1);
      
      // Step 7: Download again and verify count
      await request(serverUrl)
        .get(`/api/files/download/${fileId}`);
      
      const filesAfterSecondDownload = await request(serverUrl)
        .get('/api/files/1');
      
      const fileAfterSecondDownload = filesAfterSecondDownload.body.find(f => f.id === fileId);
      expect(fileAfterSecondDownload.download_count).toBe(2);
    });

    test('should handle large file uploads', async () => {
      // This test should FAIL initially
      
      const userData = {
        username: 'LARGEFILEUSER',
        email: 'largefile@test.com',
        password: 'largefile123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      const token = registerResponse.body.token;
      
      // Create 5MB test file
      const largeFileContent = Buffer.alloc(5 * 1024 * 1024, 'A');
      
      const uploadResponse = await request(serverUrl)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeFileContent, 'large-test-file.bin')
        .field('description', 'Large file E2E test');
      
      // Should either succeed or fail with appropriate error
      expect([200, 413]).toContain(uploadResponse.status);
      
      if (uploadResponse.status === 200) {
        expect(uploadResponse.body).toHaveProperty('id');
      } else {
        expect(uploadResponse.body.message).toContain('too large');
      }
    });
  });

  describe('Door Games Workflow', () => {
    test('should play complete door game session', async () => {
      // This test should FAIL initially
      
      const userData = {
        username: 'GAMER',
        email: 'gamer@test.com',
        password: 'gamer123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      const token = registerResponse.body.token;
      
      // Step 1: Get available games
      const gamesResponse = await request(serverUrl)
        .get('/api/games');
      
      expect(gamesResponse.status).toBe(200);
      expect(Array.isArray(gamesResponse.body)).toBe(true);
      expect(gamesResponse.body.length).toBeGreaterThan(0);
      
      const gameId = gamesResponse.body[0].id;
      
      // Step 2: Start game session
      const startResponse = await request(serverUrl)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(startResponse.status).toBe(200);
      expect(startResponse.body).toHaveProperty('sessionId');
      
      const sessionId = startResponse.body.sessionId;
      
      // Step 3: Make game moves
      const moveResponse = await request(serverUrl)
        .post(`/api/games/sessions/${sessionId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'guess',
          data: { number: 50 }
        });
      
      expect(moveResponse.status).toBe(200);
      expect(moveResponse.body).toHaveProperty('gameData');
      expect(moveResponse.body).toHaveProperty('response');
      
      // Step 4: Continue until game completion or max moves
      let gameCompleted = moveResponse.body.status === 'completed';
      let moveCount = 1;
      
      while (!gameCompleted && moveCount < 10) {
        const nextMoveResponse = await request(serverUrl)
          .post(`/api/games/sessions/${sessionId}/move`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            action: 'guess',
            data: { number: Math.floor(Math.random() * 100) + 1 }
          });
        
        gameCompleted = nextMoveResponse.body.status === 'completed';
        moveCount++;
      }
      
      // Step 5: End game session
      const endResponse = await request(serverUrl)
        .post(`/api/games/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(endResponse.status).toBe(200);
      expect(endResponse.body.message).toBe('Game session ended');
    });
  });

  describe('System Analytics and Stats', () => {
    test('should track and report user analytics', async () => {
      // This test should FAIL initially
      
      const userData = {
        username: 'ANALYTICSUSER',
        email: 'analytics@test.com',
        password: 'analytics123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      const token = registerResponse.body.token;
      
      // Generate analytics via WebSocket
      const ws = new WebSocket(wsUrl);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Send analytics events
          ws.send(JSON.stringify({
            type: 'analytics',
            data: { command: 'M', menu: 'main' }
          }));
          
          ws.send(JSON.stringify({
            type: 'analytics',
            data: { command: 'B', menu: 'boards' }
          }));
          
          setTimeout(() => {
            ws.close();
            resolve();
          }, 100);
        });
      });
      
      // Create admin user to access analytics
      const adminData = {
        username: 'SYSOP',
        email: 'admin-e2e@test.com',
        password: 'admin123'
      };
      
      const adminRegisterResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(adminData);
      
      const adminToken = adminRegisterResponse.body.token;
      
      // Get analytics
      const analyticsResponse = await request(serverUrl)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(analyticsResponse.status).toBe(200);
      expect(Array.isArray(analyticsResponse.body)).toBe(true);
    });

    test('should provide accurate system statistics', async () => {
      // This test should FAIL initially
      
      // Get initial stats
      const initialStatsResponse = await request(serverUrl)
        .get('/api/stats');
      
      expect(initialStatsResponse.status).toBe(200);
      const initialStats = initialStatsResponse.body;
      
      expect(initialStats).toHaveProperty('total_users');
      expect(initialStats).toHaveProperty('total_messages');
      expect(initialStats).toHaveProperty('online_users');
      expect(initialStats).toHaveProperty('system_uptime');
      
      // Create user and generate activity
      const userData = {
        username: 'STATSUSER',
        email: 'stats@test.com',
        password: 'stats123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      const token = registerResponse.body.token;
      
      // Post a message
      await request(serverUrl)
        .post('/api/boards/1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Stats test message',
          content: 'Testing statistics tracking'
        });
      
      // Get updated stats
      const updatedStatsResponse = await request(serverUrl)
        .get('/api/stats');
      
      const updatedStats = updatedStatsResponse.body;
      
      // Verify stats increased
      expect(updatedStats.total_users).toBeGreaterThan(initialStats.total_users);
      expect(updatedStats.total_messages).toBeGreaterThan(initialStats.total_messages);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle concurrent user sessions', async () => {
      // This test should FAIL initially
      
      const userPromises = [];
      
      // Create 10 concurrent users
      for (let i = 0; i < 10; i++) {
        const userData = {
          username: `CONCURRENT${i}`,
          email: `concurrent${i}@test.com`,
          password: 'concurrent123'
        };
        
        userPromises.push(
          request(serverUrl)
            .post('/api/auth/register')
            .send(userData)
        );
      }
      
      const responses = await Promise.all(userPromises);
      
      // All registrations should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      });
      
      // Create concurrent WebSocket connections
      const wsPromises = responses.map(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket(wsUrl);
          ws.on('open', () => {
            ws.close();
            resolve();
          });
        });
      });
      
      await Promise.all(wsPromises);
    });

    test('should handle server restart and recovery', async () => {
      // This test should FAIL initially
      
      // Create user before restart
      const userData = {
        username: 'PERSISTENTUSER',
        email: 'persistent@test.com',
        password: 'persistent123'
      };
      
      const registerResponse = await request(serverUrl)
        .post('/api/auth/register')
        .send(userData);
      
      expect(registerResponse.status).toBe(200);
      
      // Note: In a real E2E test, we might restart the server here
      // For this test, we'll simulate by checking data persistence
      
      // Verify user can still login after "restart"
      const loginResponse = await request(serverUrl)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        });
      
      expect(loginResponse.status).toBe(200);
    });
  });

  // Helper functions
  async function startTestServer() {
    return new Promise((resolve, reject) => {
      // Start the actual BBS server for testing
      const serverPath = path.join(__dirname, '../../backend/server.js');
      
      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: '0', // Use random port
          JWT_SECRET: 'test-jwt-secret'
        }
      });
      
      let serverStarted = false;
      
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('running on port') && !serverStarted) {
          serverStarted = true;
          const portMatch = output.match(/port (\d+)/);
          
          if (portMatch) {
            const port = portMatch[1];
            serverUrl = `http://localhost:${port}`;
            wsUrl = `ws://localhost:${port}`;
            resolve();
          } else {
            reject(new Error('Could not determine server port'));
          }
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
      
      serverProcess.on('error', reject);
      
      setTimeout(() => {
        if (!serverStarted) {
          reject(new Error('Server startup timeout'));
        }
      }, 10000);
    });
  }
  
  async function getResetTokenFromDatabase(email) {
    // In a real E2E test, this would query the actual database
    // For now, we'll simulate it
    return 'mock-reset-token-' + Date.now();
  }
});