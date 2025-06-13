// WebSocket Connection Manager
const WebSocket = require('ws');

class ConnectionManager {
    constructor() {
        this.connectedUsers = new Map();
        this.chatRooms = new Map();
        this.messageHistory = new Map();
        this.maxHistoryPerRoom = 50;
    }

    handleConnection(ws, req) {
        const sessionId = this.generateSessionId();
        const connection = {
            ws,
            user: null,
            sessionId,
            joinedAt: Date.now(),
            lastActivity: Date.now(),
            currentRoom: null
        };

        this.connectedUsers.set(sessionId, connection);
        console.log(`New WebSocket connection: ${sessionId}`);
        
        // Send initial data
        this.sendToUser(sessionId, {
            type: 'connection_established',
            data: { sessionId, userCount: this.connectedUsers.size }
        });

        // Set up event handlers
        ws.on('message', (message) => {
            this.handleMessage(sessionId, message);
        });
        
        ws.on('close', () => {
            this.handleDisconnection(sessionId);
        });
        
        ws.on('error', (error) => {
            console.error(`WebSocket error for ${sessionId}:`, error);
            this.handleDisconnection(sessionId);
        });

        // Clean up inactive connections
        this.scheduleCleanup(sessionId);
        
        this.broadcastUserCount();
    }

    handleMessage(sessionId, message) {
        const connection = this.connectedUsers.get(sessionId);
        if (!connection) return;

        connection.lastActivity = Date.now();

        try {
            const data = JSON.parse(message);
            this.routeMessage(sessionId, data);
        } catch (error) {
            console.error('WebSocket message parsing error:', error);
            this.sendError(sessionId, 'Invalid message format');
        }
    }

    routeMessage(sessionId, data) {
        switch (data.type) {
            case 'chat':
                this.handleChatMessage(sessionId, data.data);
                break;
            case 'join_chat':
                this.handleJoinChat(sessionId, data.data);
                break;
            case 'leave_chat':
                this.handleLeaveChat(sessionId);
                break;
            case 'ping':
                this.handlePing(sessionId);
                break;
            case 'analytics':
                this.handleAnalytics(sessionId, data.data);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    handleChatMessage(sessionId, data) {
        const connection = this.connectedUsers.get(sessionId);
        if (!connection || !data.message) return;

        const message = data.message.trim();
        if (!message || message.length > 500) return; // Message length limit

        const username = connection.user?.username || 'GUEST';
        const room = connection.currentRoom || 'general';
        
        const chatMessage = {
            id: Date.now(),
            username,
            message,
            timestamp: new Date().toISOString(),
            room
        };

        // Store message in history
        this.addToHistory(room, chatMessage);

        // Broadcast to room
        this.broadcastToRoom(room, {
            type: 'chat',
            data: chatMessage
        });
    }

    handleJoinChat(sessionId, data) {
        const connection = this.connectedUsers.get(sessionId);
        if (!connection) return;

        const roomName = data.room || 'general';
        
        // Leave current room first
        if (connection.currentRoom) {
            this.leaveRoom(sessionId, connection.currentRoom);
        }

        // Join new room
        connection.currentRoom = roomName;
        this.addToRoom(roomName, sessionId);

        const roomUsers = this.getRoomUsers(roomName);
        const history = this.getHistory(roomName);

        this.sendToUser(sessionId, {
            type: 'chat_joined',
            data: {
                room: roomName,
                userCount: roomUsers.length,
                history: history.slice(-20) // Last 20 messages
            }
        });

        // Notify room of new user
        this.broadcastToRoom(roomName, {
            type: 'user_joined',
            data: {
                username: connection.user?.username || 'GUEST',
                room: roomName,
                userCount: roomUsers.length
            }
        }, sessionId); // Exclude the joining user
    }

    handleLeaveChat(sessionId) {
        const connection = this.connectedUsers.get(sessionId);
        if (!connection || !connection.currentRoom) return;

        this.leaveRoom(sessionId, connection.currentRoom);
        connection.currentRoom = null;

        this.sendToUser(sessionId, {
            type: 'chat_left',
            data: { success: true }
        });
    }

    handlePing(sessionId) {
        this.sendToUser(sessionId, {
            type: 'pong',
            data: { timestamp: Date.now() }
        });
    }

    handleAnalytics(sessionId, data) {
        // Forward to analytics system if needed
        console.log(`Analytics from ${sessionId}:`, data);
    }

    handleDisconnection(sessionId) {
        const connection = this.connectedUsers.get(sessionId);
        if (!connection) return;

        // Leave any chat rooms
        if (connection.currentRoom) {
            this.leaveRoom(sessionId, connection.currentRoom);
        }

        this.connectedUsers.delete(sessionId);
        console.log(`WebSocket disconnected: ${sessionId}`);
        this.broadcastUserCount();
    }

    // Room management
    addToRoom(roomName, sessionId) {
        if (!this.chatRooms.has(roomName)) {
            this.chatRooms.set(roomName, new Set());
        }
        this.chatRooms.get(roomName).add(sessionId);
    }

    leaveRoom(sessionId, roomName) {
        const room = this.chatRooms.get(roomName);
        if (room) {
            room.delete(sessionId);
            if (room.size === 0) {
                this.chatRooms.delete(roomName);
            }
        }
    }

    getRoomUsers(roomName) {
        const room = this.chatRooms.get(roomName);
        return room ? Array.from(room) : [];
    }

    broadcastToRoom(roomName, message, excludeSessionId = null) {
        const roomUsers = this.getRoomUsers(roomName);
        roomUsers.forEach(sessionId => {
            if (sessionId !== excludeSessionId) {
                this.sendToUser(sessionId, message);
            }
        });
    }

    // Message history
    addToHistory(room, message) {
        if (!this.messageHistory.has(room)) {
            this.messageHistory.set(room, []);
        }
        
        const history = this.messageHistory.get(room);
        history.push(message);
        
        if (history.length > this.maxHistoryPerRoom) {
            history.shift();
        }
    }

    getHistory(room) {
        return this.messageHistory.get(room) || [];
    }

    // Utility methods
    sendToUser(sessionId, message) {
        const connection = this.connectedUsers.get(sessionId);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify(message));
        }
    }

    sendError(sessionId, error) {
        this.sendToUser(sessionId, {
            type: 'error',
            data: { message: error }
        });
    }

    broadcastUserCount() {
        const message = {
            type: 'user_count',
            data: this.connectedUsers.size
        };

        this.connectedUsers.forEach((connection) => {
            if (connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.send(JSON.stringify(message));
            }
        });
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    scheduleCleanup(sessionId) {
        // Clean up inactive connections after 5 minutes
        setTimeout(() => {
            const connection = this.connectedUsers.get(sessionId);
            if (connection && Date.now() - connection.lastActivity > 300000) {
                this.handleDisconnection(sessionId);
            }
        }, 300000);
    }

    // Admin methods
    getConnectionStats() {
        return {
            totalConnections: this.connectedUsers.size,
            activeRooms: this.chatRooms.size,
            roomDetails: Array.from(this.chatRooms.entries()).map(([room, users]) => ({
                room,
                userCount: users.size
            }))
        };
    }

    kickUser(sessionId) {
        const connection = this.connectedUsers.get(sessionId);
        if (connection) {
            connection.ws.close(4000, 'Kicked by admin');
        }
    }
}

module.exports = ConnectionManager;