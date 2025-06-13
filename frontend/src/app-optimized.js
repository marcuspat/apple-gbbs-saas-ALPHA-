// Optimized BBS Application - Modular Frontend
class OptimizedBBSApp {
    constructor() {
        this.apiUrl = '/api';
        this.socket = null;
        this.user = null;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        
        this.initializeApp();
    }
    
    async initializeApp() {
        try {
            await this.loadModules();
            this.setupComponents();
            this.setupWebSocket();
            this.setupKeyboardShortcuts();
            this.setupLoginModal();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load application components');
        }
    }
    
    async loadModules() {
        // Load core components
        if (typeof TerminalCore === 'undefined') {
            await this.loadScript('/src/terminal/terminal-core.js');
        }
        
        if (typeof CommandHandler === 'undefined') {
            await this.loadScript('/src/handlers/command-handler.js');
        }
        
        if (typeof MenuManager === 'undefined') {
            await this.loadScript('/src/menus/menu-manager.js');
        }
        
        // Load menu handlers
        await Promise.all([
            this.loadScript('/src/menus/welcome-menu.js'),
            this.loadScript('/src/menus/main-menu.js'),
            this.loadScript('/src/menus/message-menu.js'),
            this.loadScript('/src/menus/file-menu.js'),
            this.loadScript('/src/menus/game-menu.js'),
            this.loadScript('/src/menus/chat-menu.js')
        ]);
        
        // Load utilities
        await this.loadScript('/src/utils/analytics.js');
    }
    
    setupComponents() {
        // Initialize core terminal
        window.terminal = new TerminalCore();
        
        // Initialize menu manager
        window.menuManager = new MenuManager(window.terminal);
        
        // Initialize command handler
        window.commandHandler = new CommandHandler(window.terminal);
        
        // Initialize analytics
        window.analytics = new BBSAnalytics();
        
        // Initialize menu handlers (if they exist)
        this.initializeMenuHandlers();
    }
    
    initializeMenuHandlers() {
        // These will be loaded from separate files
        if (typeof WelcomeMenu !== 'undefined') {
            window.welcomeMenu = new WelcomeMenu(window.terminal, this);
        }
        
        if (typeof MainMenu !== 'undefined') {
            window.mainMenu = new MainMenu(window.terminal, this);
        }
        
        if (typeof MessageMenu !== 'undefined') {
            window.messageMenu = new MessageMenu(window.terminal, this);
        }
        
        if (typeof FileMenu !== 'undefined') {
            window.fileMenu = new FileMenu(window.terminal, this);
        }
        
        if (typeof GameMenu !== 'undefined') {
            window.gameMenu = new GameMenu(window.terminal, this);
        }
        
        if (typeof ChatMenu !== 'undefined') {
            window.chatMenu = new ChatMenu(window.terminal, this);
        }
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.scheduleReconnect();
        }
    }
    
    setupWebSocketHandlers() {
        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.connectionRetries = 0;
        };
        
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
        
        this.socket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            if (event.code !== 1000) { // Not a normal closure
                this.scheduleReconnect();
            }
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    scheduleReconnect() {
        if (this.connectionRetries < this.maxRetries) {
            this.connectionRetries++;
            const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000);
            
            console.log(`Attempting reconnection in ${delay}ms (attempt ${this.connectionRetries})`);
            setTimeout(() => this.setupWebSocket(), delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showError('Connection lost. Please refresh the page.');
        }
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
            case 'connection_established':
                this.handleConnectionEstablished(message.data);
                break;
            case 'error':
                this.handleError(message.data);
                break;
            default:
                console.log('Unknown WebSocket message:', message);
        }
    }
    
    handleChatMessage(data) {
        if (window.terminal && window.terminal.getMenu() === 'chat') {
            window.terminal.writeLine(`<${data.username}> ${data.message}`);
        }
    }
    
    updateUserCount(count) {
        const elements = document.querySelectorAll('.user-count');
        elements.forEach(el => {
            el.textContent = count;
        });
    }
    
    handleSystemMessage(data) {
        if (window.terminal) {
            window.terminal.writeLine(`*** SYSTEM: ${data.message} ***`, 'system-message');
        }
    }
    
    handleConnectionEstablished(data) {
        console.log('Connection established:', data);
        this.updateUserCount(data.userCount);
    }
    
    handleError(data) {
        console.error('Server error:', data.message);
        if (window.terminal) {
            window.terminal.writeLine(`*** ERROR: ${data.message} ***`, 'error-message');
        }
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
                    if (window.menuManager) {
                        window.menuManager.showCurrentMenu();
                    }
                }
            }
        });
    }
    
    setupLoginModal() {
        const modal = document.getElementById('login-modal');
        const form = document.getElementById('login-form');
        const guestBtn = document.getElementById('guest-login');
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.handleGuestLogin();
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Auto-hide login modal for demo
        setTimeout(() => {
            if (modal) {
                modal.style.display = 'none';
            }
        }, 100);
    }
    
    async handleLogin() {
        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }
        
        try {
            const response = await this.fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.user = data.user;
                window.terminal.setUser(data.user.username);
                document.getElementById('login-modal').style.display = 'none';
                window.menuManager.showMainMenu();
                
                localStorage.setItem('bbsToken', data.token);
            } else {
                this.showError(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            // Fallback for demo
            this.handleFallbackLogin(username);
        }
    }
    
    handleFallbackLogin(username) {
        this.user = { username: username.toUpperCase(), id: 1 };
        window.terminal.setUser(username.toUpperCase());
        document.getElementById('login-modal').style.display = 'none';
        window.menuManager.showMainMenu();
    }
    
    handleGuestLogin() {
        document.getElementById('login-modal').style.display = 'none';
        window.terminal.loginAsGuest();
    }
    
    // API Methods with caching and error handling
    async fetch(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const token = localStorage.getItem('bbsToken');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        if (options.headers) {
            mergedOptions.headers = { ...defaultOptions.headers, ...options.headers };
        }
        
        return fetch(url, mergedOptions);
    }
    
    async getMessageBoards() {
        try {
            const response = await this.fetch('/boards');
            return await response.json();
        } catch (error) {
            console.error('Error fetching message boards:', error);
            return this.getMockMessageBoards();
        }
    }
    
    async getMessages(boardId, limit = 50, offset = 0) {
        try {
            const response = await this.fetch(`/boards/${boardId}/messages?limit=${limit}&offset=${offset}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching messages:', error);
            return this.getMockMessages();
        }
    }
    
    async postMessage(boardId, subject, content) {
        try {
            const response = await this.fetch(`/boards/${boardId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ subject, content })
            });
            return await response.json();
        } catch (error) {
            console.error('Error posting message:', error);
            return { success: false, error: 'Failed to post message' };
        }
    }
    
    sendChatMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'chat',
                data: { message }
            }));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }
    
    // Utility methods
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    showError(message) {
        console.error(message);
        if (window.terminal) {
            window.terminal.writeLine(`*** ERROR: ${message} ***`, 'error-message');
        } else {
            alert(message);
        }
    }
    
    // Mock data fallbacks
    getMockMessageBoards() {
        return [
            { id: 1, name: 'General Discussion', message_count: 47, last_post: 'Today' },
            { id: 2, name: 'Retro Computing', message_count: 23, last_post: 'Today' },
            { id: 3, name: 'BBS Nostalgia', message_count: 15, last_post: 'Yesterday' },
            { id: 4, name: 'Programming', message_count: 31, last_post: 'Today' },
            { id: 5, name: 'Apple II Help', message_count: 8, last_post: '2 days ago' }
        ];
    }
    
    getMockMessages() {
        return [
            {
                id: 47,
                subject: 'Welcome to the new BBS!',
                username: 'SYSOP',
                created_at: 'Today 14:32',
                content: 'Welcome everyone to RetroBBS!'
            },
            {
                id: 46,
                subject: 'Anyone remember TradeWars?',
                username: 'RETROGAMER',
                created_at: 'Today 12:15',
                content: 'Looking for other TW players...'
            }
        ];
    }
}

// Initialize the optimized BBS app
document.addEventListener('DOMContentLoaded', () => {
    window.bbsApp = new OptimizedBBSApp();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedBBSApp;
}