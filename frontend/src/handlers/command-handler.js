// Command Handler - Routes commands to appropriate menu handlers
class CommandHandler {
    constructor(terminal) {
        this.terminal = terminal;
        this.menuHandlers = new Map();
        this.setupMenuHandlers();
    }
    
    setupMenuHandlers() {
        // Register menu handlers
        if (window.welcomeMenu) {
            this.menuHandlers.set('welcome', window.welcomeMenu);
        }
        if (window.mainMenu) {
            this.menuHandlers.set('main', window.mainMenu);
        }
        if (window.messageMenu) {
            this.menuHandlers.set('messages', window.messageMenu);
        }
        if (window.fileMenu) {
            this.menuHandlers.set('files', window.fileMenu);
        }
        if (window.gameMenu) {
            this.menuHandlers.set('games', window.gameMenu);
        }
        if (window.chatMenu) {
            this.menuHandlers.set('chat', window.chatMenu);
        }
        if (window.gameSession) {
            this.menuHandlers.set('game', window.gameSession);
        }
        if (window.registrationHandler) {
            this.menuHandlers.set('registration', window.registrationHandler);
        }
    }
    
    handle(command, menu) {
        const cmd = command.toLowerCase().trim();
        
        // Global commands that work in any menu
        if (this.handleGlobalCommands(cmd)) {
            return;
        }
        
        // Route to specific menu handler
        const handler = this.menuHandlers.get(menu);
        if (handler && typeof handler.handleCommand === 'function') {
            handler.handleCommand(cmd, command);
        } else {
            this.handleUnknownMenu(menu, command);
        }
    }
    
    handleGlobalCommands(cmd) {
        switch (cmd) {
            case 'clear':
            case 'cls':
                this.terminal.clearScreen();
                if (window.menuManager) {
                    window.menuManager.showCurrentMenu();
                }
                return true;
                
            case 'time':
                this.terminal.writeLine('');
                this.terminal.writeLine(`CURRENT TIME: ${new Date().toLocaleString()}`);
                this.terminal.writeLine('');
                return true;
                
            case 'uptime':
                this.terminal.writeLine('');
                this.terminal.writeLine(`SYSTEM UPTIME: ${Math.floor(performance.now() / 1000)} SECONDS`);
                this.terminal.writeLine('');
                return true;
                
            case 'version':
                this.terminal.writeLine('');
                this.terminal.writeLine('RETROBBS v1.0 - APPLE GBBS COMPATIBLE');
                this.terminal.writeLine('WEB-BASED BULLETIN BOARD SYSTEM');
                this.terminal.writeLine('');
                return true;
                
            case 'who':
            case 'users':
                this.showOnlineUsers();
                return true;
                
            default:
                return false;
        }
    }
    
    showOnlineUsers() {
        this.terminal.writeLine('');
        this.terminal.writeLine('USERS CURRENTLY ONLINE:');
        this.terminal.writeLine('─────────────────────────');
        
        // Get from WebSocket if available
        if (window.bbsApp && window.bbsApp.socket) {
            window.bbsApp.socket.send(JSON.stringify({
                type: 'get_user_list'
            }));
        } else {
            // Fallback
            this.terminal.writeLine('SYSOP        - NODE 1 - MAIN CONSOLE');
            this.terminal.writeLine('RETROGAMER   - NODE 2 - PLAYING GAMES');
            this.terminal.writeLine('APPLEFAN     - NODE 3 - READING MSGS');
            this.terminal.writeLine('GUEST        - NODE 5 - BROWSING');
        }
        this.terminal.writeLine('');
    }
    
    handleUnknownMenu(menu, command) {
        this.terminal.writeLine(`UNKNOWN MENU STATE: ${menu}`);
        this.terminal.writeLine('RETURNING TO MAIN MENU...');
        
        setTimeout(() => {
            if (window.menuManager) {
                window.menuManager.showMainMenu();
            }
        }, 1000);
    }
    
    // Register a new menu handler
    registerHandler(menuName, handler) {
        this.menuHandlers.set(menuName, handler);
    }
    
    // Unregister a menu handler
    unregisterHandler(menuName) {
        this.menuHandlers.delete(menuName);
    }
    
    // Get available handlers
    getAvailableHandlers() {
        return Array.from(this.menuHandlers.keys());
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommandHandler;
}