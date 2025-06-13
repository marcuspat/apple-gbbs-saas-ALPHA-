class ChatManager {
    constructor() {
        this.chatRooms = new Map();
        this.userRooms = new Map();
        this.chatHistory = new Map();
        this.maxHistorySize = 100;
    }
    
    joinRoom(userId, roomName = 'general', connection) {
        if (!this.chatRooms.has(roomName)) {
            this.chatRooms.set(roomName, new Set());
            this.chatHistory.set(roomName, []);
        }
        
        this.chatRooms.get(roomName).add(userId);
        this.userRooms.set(userId, { roomName, connection });
        
        return {
            success: true,
            roomName,
            history: this.getRecentHistory(roomName),
            userCount: this.chatRooms.get(roomName).size
        };
    }
    
    leaveRoom(userId) {
        const userRoom = this.userRooms.get(userId);
        if (!userRoom) return;
        
        const { roomName } = userRoom;
        const room = this.chatRooms.get(roomName);
        
        if (room) {
            room.delete(userId);
            if (room.size === 0) {
                this.chatRooms.delete(roomName);
                this.chatHistory.delete(roomName);
            }
        }
        
        this.userRooms.delete(userId);
    }
    
    sendMessage(userId, message, username) {
        const userRoom = this.userRooms.get(userId);
        if (!userRoom) return { success: false, error: 'User not in a room' };
        
        const { roomName } = userRoom;
        const timestamp = new Date().toISOString();
        
        const chatMessage = {
            userId,
            username,
            message: this.sanitizeMessage(message),
            timestamp,
            roomName
        };
        
        // Add to history
        const history = this.chatHistory.get(roomName) || [];
        history.push(chatMessage);
        
        // Trim history if needed
        if (history.length > this.maxHistorySize) {
            history.shift();
        }
        
        this.chatHistory.set(roomName, history);
        
        // Get all users in room
        const usersInRoom = this.chatRooms.get(roomName) || new Set();
        const recipients = [];
        
        usersInRoom.forEach(uid => {
            const user = this.userRooms.get(uid);
            if (user && user.connection) {
                recipients.push(user.connection);
            }
        });
        
        return {
            success: true,
            message: chatMessage,
            recipients
        };
    }
    
    getRecentHistory(roomName, limit = 50) {
        const history = this.chatHistory.get(roomName) || [];
        return history.slice(-limit);
    }
    
    getRoomList() {
        const rooms = [];
        this.chatRooms.forEach((users, roomName) => {
            rooms.push({
                name: roomName,
                userCount: users.size,
                hasHistory: this.chatHistory.has(roomName)
            });
        });
        return rooms;
    }
    
    getUsersInRoom(roomName) {
        const room = this.chatRooms.get(roomName);
        if (!room) return [];
        
        const users = [];
        room.forEach(userId => {
            const userRoom = this.userRooms.get(userId);
            if (userRoom) {
                users.push(userId);
            }
        });
        
        return users;
    }
    
    sanitizeMessage(message) {
        // Basic sanitization - in production, use a proper library
        return message
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .substring(0, 500); // Limit message length
    }
    
    createPrivateRoom(user1Id, user2Id) {
        const roomName = `private_${Math.min(user1Id, user2Id)}_${Math.max(user1Id, user2Id)}`;
        return roomName;
    }
}

module.exports = ChatManager;