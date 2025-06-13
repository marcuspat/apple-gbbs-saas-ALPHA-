/**
 * Enhanced Chat Service with persistence, moderation, and scalability
 */
class EnhancedChatService {
    constructor(databaseService, aiService = null) {
        this.db = databaseService;
        this.ai = aiService;
        this.rooms = new Map();
        this.userSessions = new Map();
        this.rateLimits = new Map();
        this.messageBuffer = [];
        this.bufferSize = 100;
        this.flushInterval = 5000; // 5 seconds
        this.maxMessageLength = 500;
        this.maxMessagesPerMinute = 20;
        
        this.init();
    }
    
    async init() {
        // Create default room if not exists
        await this.createRoom('general', 'General Chat', false, 1);
        
        // Start periodic cleanup
        setInterval(() => this.cleanupExpiredData(), 60000); // Every minute
        setInterval(() => this.flushMessageBuffer(), this.flushInterval);
        
        console.log('Enhanced Chat Service initialized');
    }
    
    /**
     * Create a new chat room
     */
    async createRoom(name, description, isPrivate = false, createdBy = null) {
        try {
            const sql = `
                INSERT OR IGNORE INTO chat_rooms (name, description, is_private, created_by)
                VALUES (?, ?, ?, ?)
            `;
            const result = await this.db.run(sql, [name, description, isPrivate ? 1 : 0, createdBy]);
            
            if (result.changes > 0) {
                this.rooms.set(name, {
                    id: result.lastID,
                    name,
                    description,
                    isPrivate,
                    users: new Set(),
                    createdBy,
                    createdAt: new Date()
                });
                
                console.log(`Chat room '${name}' created`);
                return { success: true, roomId: result.lastID };
            }
            
            return { success: false, message: 'Room already exists' };
        } catch (error) {
            console.error('Failed to create room:', error);
            return { success: false, message: 'Database error' };
        }
    }
    
    /**
     * Join a user to a room
     */
    async joinRoom(sessionId, roomName, user) {
        try {
            // Validate room exists
            const room = await this.getRoom(roomName);
            if (!room) {
                return { success: false, message: 'Room not found' };
            }
            
            // Check room capacity
            const currentUsers = this.rooms.get(roomName)?.users.size || 0;
            if (currentUsers >= room.max_users) {
                return { success: false, message: 'Room is full' };
            }
            
            // Update user session
            this.userSessions.set(sessionId, {
                user,
                roomName,
                joinedAt: new Date(),
                lastActivity: new Date()
            });
            
            // Add to room
            if (!this.rooms.has(roomName)) {
                this.rooms.set(roomName, { ...room, users: new Set() });
            }
            this.rooms.get(roomName).users.add(sessionId);
            
            // Send join notification
            this.broadcastToRoom(roomName, {
                type: 'system',
                message: `${user.username} has joined the room`,
                timestamp: new Date().toISOString()
            }, sessionId);
            
            // Send recent messages to new user
            const recentMessages = await this.getRecentMessages(room.id, 20);
            
            return {
                success: true,
                room: room,
                userCount: this.rooms.get(roomName).users.size,
                recentMessages: recentMessages
            };
            
        } catch (error) {
            console.error('Failed to join room:', error);
            return { success: false, message: 'Failed to join room' };
        }
    }
    
    /**
     * Remove user from room
     */
    leaveRoom(sessionId) {
        const session = this.userSessions.get(sessionId);
        if (!session) return;
        
        const { user, roomName } = session;
        
        // Remove from room
        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName).users.delete(sessionId);
            
            // Send leave notification
            this.broadcastToRoom(roomName, {
                type: 'system',
                message: `${user.username} has left the room`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Remove session
        this.userSessions.delete(sessionId);
    }
    
    /**
     * Send a chat message
     */
    async sendMessage(sessionId, messageText, messageType = 'text') {
        const session = this.userSessions.get(sessionId);
        if (!session) {
            return { success: false, message: 'Not in a room' };
        }
        
        const { user, roomName } = session;
        
        // Rate limiting
        const rateLimitResult = this.checkRateLimit(sessionId);
        if (!rateLimitResult.allowed) {
            return { success: false, message: 'Rate limit exceeded' };
        }
        
        // Validate message
        if (!messageText || messageText.trim().length === 0) {
            return { success: false, message: 'Empty message' };
        }
        
        if (messageText.length > this.maxMessageLength) {
            return { success: false, message: 'Message too long' };
        }
        
        // Sanitize message
        const sanitizedMessage = this.sanitizeMessage(messageText);
        
        // Content moderation (if AI service available)
        if (this.ai) {
            try {
                const moderation = await this.ai.moderateContent(sanitizedMessage, user.id);
                if (!moderation.safe) {
                    console.log(`Message blocked from user ${user.id}: ${moderation.reason}`);
                    return { success: false, message: 'Message blocked by content filter' };
                }
            } catch (error) {
                console.error('Content moderation failed:', error);
                // Continue without moderation if service fails
            }
        }
        
        // Create message object
        const message = {
            type: 'chat',
            username: user.username,
            userId: user.id,
            message: sanitizedMessage,
            messageType: messageType,
            timestamp: new Date().toISOString(),
            roomName: roomName
        };
        
        // Add to buffer for persistence
        this.messageBuffer.push({
            roomId: this.rooms.get(roomName)?.id,
            userId: user.id,
            username: user.username,
            message: sanitizedMessage,
            messageType: messageType
        });
        
        // Broadcast to room
        this.broadcastToRoom(roomName, message);
        
        // Update user activity
        session.lastActivity = new Date();
        
        return { success: true, message: 'Message sent' };
    }
    
    /**
     * Broadcast message to all users in a room
     */
    broadcastToRoom(roomName, message, excludeSessionId = null) {
        const room = this.rooms.get(roomName);
        if (!room) return;
        
        const broadcastData = JSON.stringify(message);
        
        room.users.forEach(sessionId => {
            if (sessionId === excludeSessionId) return;
            
            // In a real implementation, you'd use WebSocket connections
            // This is a placeholder for the broadcast mechanism
            this.sendToSession(sessionId, broadcastData);
        });
    }
    
    /**
     * Send message to specific session (placeholder)
     */
    sendToSession(sessionId, data) {
        // This would interface with your WebSocket server
        // For now, it's a placeholder
        console.log(`Send to session ${sessionId}:`, data);
    }
    
    /**
     * Get room information
     */
    async getRoom(roomName) {
        try {
            const sql = 'SELECT * FROM chat_rooms WHERE name = ?';
            return await this.db.get(sql, [roomName]);
        } catch (error) {
            console.error('Failed to get room:', error);
            return null;
        }
    }
    
    /**
     * Get recent messages for a room
     */
    async getRecentMessages(roomId, limit = 50) {
        try {
            const sql = `
                SELECT cm.*, u.username
                FROM chat_messages cm
                LEFT JOIN users u ON cm.user_id = u.id
                WHERE cm.room_id = ?
                ORDER BY cm.created_at DESC
                LIMIT ?
            `;
            const messages = await this.db.query(sql, [roomId, limit]);
            return messages.reverse(); // Return in chronological order
        } catch (error) {
            console.error('Failed to get recent messages:', error);
            return [];
        }
    }
    
    /**
     * Get list of active rooms
     */
    async getRoomList() {
        try {
            const sql = `
                SELECT cr.*, COUNT(DISTINCT cm.id) as message_count
                FROM chat_rooms cr
                LEFT JOIN chat_messages cm ON cr.id = cm.room_id
                WHERE cr.is_private = 0
                GROUP BY cr.id
                ORDER BY cr.name
            `;
            const rooms = await this.db.query(sql);
            
            // Add current user counts
            return rooms.map(room => ({
                ...room,
                current_users: this.rooms.get(room.name)?.users.size || 0
            }));
        } catch (error) {
            console.error('Failed to get room list:', error);
            return [];
        }
    }
    
    /**
     * Rate limiting check
     */
    checkRateLimit(sessionId) {
        const now = Date.now();
        const userLimits = this.rateLimits.get(sessionId) || { 
            count: 0, 
            resetTime: now + 60000 
        };
        
        if (now > userLimits.resetTime) {
            userLimits.count = 0;
            userLimits.resetTime = now + 60000;
        }
        
        if (userLimits.count >= this.maxMessagesPerMinute) {
            return { allowed: false, resetTime: userLimits.resetTime };
        }
        
        userLimits.count++;
        this.rateLimits.set(sessionId, userLimits);
        
        return { allowed: true, remaining: this.maxMessagesPerMinute - userLimits.count };
    }
    
    /**
     * Sanitize message content
     */
    sanitizeMessage(message) {
        return message
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }
    
    /**
     * Flush message buffer to database
     */
    async flushMessageBuffer() {
        if (this.messageBuffer.length === 0) return;
        
        const messages = this.messageBuffer.splice(0);
        
        try {
            const queries = messages.map(msg => ({
                sql: `
                    INSERT INTO chat_messages (room_id, user_id, username, message, message_type)
                    VALUES (?, ?, ?, ?, ?)
                `,
                params: [msg.roomId, msg.userId, msg.username, msg.message, msg.messageType]
            }));
            
            await this.db.transaction(queries);
            console.log(`Flushed ${messages.length} chat messages to database`);
        } catch (error) {
            console.error('Failed to flush messages:', error);
            // Re-add messages to buffer for retry
            this.messageBuffer.unshift(...messages);
        }
    }
    
    /**
     * Clean up expired data
     */
    cleanupExpiredData() {
        const now = Date.now();
        
        // Clean up rate limits
        for (const [sessionId, limits] of this.rateLimits.entries()) {
            if (now > limits.resetTime) {
                this.rateLimits.delete(sessionId);
            }
        }
        
        // Clean up inactive sessions (inactive for 30 minutes)
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
        for (const [sessionId, session] of this.userSessions.entries()) {
            if (session.lastActivity < thirtyMinutesAgo) {
                this.leaveRoom(sessionId);
            }
        }
    }
    
    /**
     * Clean up old messages (called by external scheduler)
     */
    async cleanupOldMessages() {
        try {
            const retentionDays = await this.db.getConfig('chat_message_retention') || 30;
            const sql = `
                DELETE FROM chat_messages 
                WHERE created_at < datetime('now', '-${retentionDays} days')
            `;
            const result = await this.db.run(sql);
            
            if (result.changes > 0) {
                console.log(`Cleaned up ${result.changes} old chat messages`);
            }
        } catch (error) {
            console.error('Failed to cleanup old messages:', error);
        }
    }
    
    /**
     * Get chat statistics
     */
    async getStatistics() {
        try {
            const stats = await Promise.all([
                this.db.get('SELECT COUNT(*) as count FROM chat_rooms'),
                this.db.get('SELECT COUNT(*) as count FROM chat_messages WHERE created_at >= date("now", "-1 day")'),
                this.db.get('SELECT COUNT(*) as count FROM chat_messages'),
            ]);
            
            return {
                totalRooms: stats[0]?.count || 0,
                messagesLast24h: stats[1]?.count || 0,
                totalMessages: stats[2]?.count || 0,
                activeUsers: this.userSessions.size,
                activeRooms: this.rooms.size
            };
        } catch (error) {
            console.error('Failed to get chat statistics:', error);
            return {};
        }
    }
    
    /**
     * Get user list for a room
     */
    getUsersInRoom(roomName) {
        const room = this.rooms.get(roomName);
        if (!room) return [];
        
        const users = [];
        room.users.forEach(sessionId => {
            const session = this.userSessions.get(sessionId);
            if (session) {
                users.push({
                    username: session.user.username,
                    joinedAt: session.joinedAt,
                    lastActivity: session.lastActivity
                });
            }
        });
        
        return users.sort((a, b) => a.username.localeCompare(b.username));
    }
    
    /**
     * Update user activity
     */
    updateUserActivity(sessionId) {
        const session = this.userSessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }
    
    /**
     * Check if user is in room
     */
    isUserInRoom(sessionId, roomName) {
        const session = this.userSessions.get(sessionId);
        return session && session.roomName === roomName;
    }
}

module.exports = EnhancedChatService;