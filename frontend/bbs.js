// BBS Application Logic
class BBSApp {
    constructor() {
        this.apiUrl = '/api';
        this.socket = null;
        this.user = null;
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupLoginModal();
        this.setupWebSocket();
        this.setupKeyboardShortcuts();
    }
    
    setupLoginModal() {
        const modal = document.getElementById('login-modal');
        const form = document.getElementById('login-form');
        const guestBtn = document.getElementById('guest-login');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        guestBtn.addEventListener('click', () => {
            this.handleGuestLogin();
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    setupWebSocket() {
        // WebSocket connection for real-time features
        if (window.location.protocol === 'https:') {
            this.socket = new WebSocket(`wss://${window.location.host}/ws`);
        } else {
            this.socket = new WebSocket(`ws://${window.location.host}/ws`);
        }
        
        this.socket.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.socket.onmessage = (event) => {
            this.handleWebSocketMessage(JSON.parse(event.data));
        };
        
        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            // Attempt reconnection after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt+H for help
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                if (window.terminal) {
                    window.terminal.showHelp();
                }
            }
            
            // Alt+Q for quit
            if (e.altKey && e.key === 'q') {
                e.preventDefault();
                if (window.terminal) {
                    window.terminal.logout();
                }
            }
            
            // Ctrl+L to clear screen
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                if (window.terminal) {
                    window.terminal.clearScreen();
                    window.terminal.showMainMenu();
                }
            }
        });
    }
    
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.user = data.user;
                window.terminal.currentUser = data.user.username;
                document.getElementById('login-modal').style.display = 'none';
                window.terminal.showMainMenu();
                
                // Store session token
                localStorage.setItem('bbsToken', data.token);
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            // For demo purposes, allow any username/password
            this.user = { username: username.toUpperCase(), id: 1 };
            window.terminal.currentUser = username.toUpperCase();
            document.getElementById('login-modal').style.display = 'none';
            window.terminal.showMainMenu();
        }
    }
    
    handleGuestLogin() {
        document.getElementById('login-modal').style.display = 'none';
        window.terminal.loginAsGuest();
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'chat':
                this.handleChatMessage(message.data);
                break;
            case 'user_count':
                this.updateUserCount(message.data);
                break;
            case 'system_message':
                this.handleSystemMessage(message.data);
                break;
            default:
                console.log('Unknown WebSocket message:', message);
        }
    }
    
    handleChatMessage(data) {
        if (window.terminal && window.terminal.currentMenu === 'chat') {
            window.terminal.writeLine(`<${data.username}> ${data.message}`);
        }
    }
    
    updateUserCount(count) {
        // Update user count in status displays
        const statusElements = document.querySelectorAll('.user-count');
        statusElements.forEach(el => {
            el.textContent = count;
        });
    }
    
    handleSystemMessage(data) {
        if (window.terminal) {
            window.terminal.writeLine(`*** SYSTEM: ${data.message} ***`, 'system-message');
        }
    }
    
    // API methods for BBS functionality
    async getMessageBoards() {
        try {
            const response = await fetch(`${this.apiUrl}/boards`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching message boards:', error);
            return this.getMockMessageBoards();
        }
    }
    
    async getMessages(boardId) {
        try {
            const response = await fetch(`${this.apiUrl}/boards/${boardId}/messages`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching messages:', error);
            return this.getMockMessages();
        }
    }
    
    async postMessage(boardId, subject, content) {
        try {
            const token = localStorage.getItem('bbsToken');
            const response = await fetch(`${this.apiUrl}/boards/${boardId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ subject, content })
            });
            return await response.json();
        } catch (error) {
            console.error('Error posting message:', error);
            return { success: false, error: 'Failed to post message' };
        }
    }
    
    async getFiles(areaId) {
        try {
            const response = await fetch(`${this.apiUrl}/files/${areaId}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching files:', error);
            return this.getMockFiles();
        }
    }
    
    async downloadFile(fileId) {
        try {
            const token = localStorage.getItem('bbsToken');
            const response = await fetch(`${this.apiUrl}/files/download/${fileId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'download';
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    }
    
    async uploadFile(file) {
        try {
            const token = localStorage.getItem('bbsToken');
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${this.apiUrl}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error uploading file:', error);
            return { success: false, error: 'Failed to upload file' };
        }
    }
    
    sendChatMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'chat',
                data: { message }
            }));
        }
    }
    
    // Mock data methods for demo purposes
    getMockMessageBoards() {
        return [
            { id: 1, name: 'General Discussion', messageCount: 47, lastPost: 'Today' },
            { id: 2, name: 'Retro Computing', messageCount: 23, lastPost: 'Today' },
            { id: 3, name: 'BBS Nostalgia', messageCount: 15, lastPost: 'Yesterday' },
            { id: 4, name: 'Programming', messageCount: 31, lastPost: 'Today' },
            { id: 5, name: 'Apple II Help', messageCount: 8, lastPost: '2 days ago' }
        ];
    }
    
    getMockMessages() {
        return [
            {
                id: 47,
                subject: 'Welcome to the new BBS!',
                author: 'SYSOP',
                date: 'Today 14:32',
                content: 'Welcome everyone to RetroBBS!'
            },
            {
                id: 46,
                subject: 'Anyone remember TradeWars?',
                author: 'RETROGAMER',
                date: 'Today 12:15',
                content: 'Looking for other TW players...'
            }
        ];
    }
    
    getMockFiles() {
        return [
            {
                id: 1,
                name: 'APPLESOFT.DSK',
                size: '140K',
                date: '03/15/24',
                description: 'Applesoft BASIC Disk'
            },
            {
                id: 2,
                name: 'PRODOS.DSK',
                size: '140K',
                date: '03/15/24',
                description: 'ProDOS System Disk'
            }
        ];
    }
}

// Analytics and tracking
class BBSAnalytics {
    constructor() {
        this.sessionStart = Date.now();
        this.commandCount = 0;
        this.menuNavigation = [];
    }
    
    trackCommand(command, menu) {
        this.commandCount++;
        this.menuNavigation.push({
            command,
            menu,
            timestamp: Date.now()
        });
        
        // Send analytics to server (if connected)
        if (window.bbsApp && window.bbsApp.socket) {
            window.bbsApp.socket.send(JSON.stringify({
                type: 'analytics',
                data: {
                    command,
                    menu,
                    sessionTime: Date.now() - this.sessionStart
                }
            }));
        }
    }
    
    getSessionStats() {
        return {
            duration: Date.now() - this.sessionStart,
            commandCount: this.commandCount,
            menuNavigation: this.menuNavigation
        };
    }
}

// Initialize BBS app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bbsApp = new BBSApp();
    window.analytics = new BBSAnalytics();
    
    // Show login modal initially (hidden in CSS)
    setTimeout(() => {
        // Auto-hide login modal for demo and go straight to welcome
        document.getElementById('login-modal').style.display = 'none';
    }, 100);
});