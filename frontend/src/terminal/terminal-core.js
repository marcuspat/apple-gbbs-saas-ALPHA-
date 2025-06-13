// Core Terminal Functionality
class TerminalCore {
    constructor() {
        this.output = document.getElementById('terminal-output');
        this.input = document.getElementById('terminal-input');
        this.currentUser = null;
        this.currentMenu = 'welcome';
        this.commandHistory = [];
        this.historyIndex = 0;
        this.currentGameSession = null;
        this.currentGameId = null;
        this.gameCompleted = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupWindowControls();
        this.startBootSequence();
    }
    
    setupEventListeners() {
        this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.input.addEventListener('input', this.handleInput.bind(this));
    }
    
    setupWindowControls() {
        const closeBtn = document.querySelector('.close');
        const minimizeBtn = document.querySelector('.minimize');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (confirm('Exit RetroBBS?')) {
                    window.close();
                }
            });
        }
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                document.body.style.display = 'none';
                setTimeout(() => document.body.style.display = 'block', 1000);
            });
        }
    }
    
    startBootSequence() {
        setTimeout(() => {
            this.clearScreen();
            if (window.menuManager) {
                window.menuManager.showWelcome();
            }
        }, 3000);
    }
    
    handleKeyDown(e) {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.processCommand(this.input.value.trim());
                this.input.value = '';
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;
        }
    }
    
    handleInput(e) {
        // Convert to uppercase for authentic Apple II feel
        if (e.target.value !== e.target.value.toUpperCase()) {
            const cursorPos = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(cursorPos, cursorPos);
        }
    }
    
    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;
        
        this.historyIndex += direction;
        if (this.historyIndex < 0) this.historyIndex = 0;
        if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            this.input.value = '';
            return;
        }
        
        this.input.value = this.commandHistory[this.historyIndex];
    }
    
    processCommand(command) {
        if (command === '') return;
        
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        
        this.writeLine(`]${command}`);
        
        // Route command to appropriate handler
        if (window.commandHandler) {
            window.commandHandler.handle(command, this.currentMenu);
        }
        
        // Track analytics
        if (window.analytics) {
            window.analytics.trackCommand(command, this.currentMenu);
        }
    }
    
    // Display methods
    clearScreen() {
        this.output.innerHTML = '';
    }
    
    writeLine(text, className = '') {
        const line = document.createElement('div');
        line.className = `line ${className}`;
        line.textContent = text;
        this.output.appendChild(line);
        this.scrollToBottom();
    }
    
    writeHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        this.output.appendChild(div);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.output.parentElement.scrollTop = this.output.parentElement.scrollHeight;
    }
    
    // User management
    setUser(user) {
        this.currentUser = user;
    }
    
    loginAsGuest() {
        this.currentUser = 'GUEST';
        this.writeLine('');
        this.writeLine('LOGGED IN AS GUEST USER');
        this.writeLine('SOME FEATURES MAY BE RESTRICTED');
        this.writeLine('');
        setTimeout(() => {
            if (window.menuManager) {
                window.menuManager.showMainMenu();
            }
        }, 1000);
    }
    
    logout() {
        this.writeLine('');
        this.writeLine('THANK YOU FOR USING RETROBBS!');
        this.writeLine('CONNECTION TERMINATED...');
        this.currentUser = null;
        setTimeout(() => {
            if (window.menuManager) {
                window.menuManager.showWelcome();
            }
        }, 2000);
    }
    
    // Game session management
    setGameSession(sessionId, gameId) {
        this.currentGameSession = sessionId;
        this.currentGameId = gameId;
        this.gameCompleted = false;
    }
    
    clearGameSession() {
        this.currentGameSession = null;
        this.currentGameId = null;
        this.gameCompleted = false;
    }
    
    // Menu state management
    setMenu(menu) {
        this.currentMenu = menu;
    }
    
    getMenu() {
        return this.currentMenu;
    }
    
    // Utility methods
    showHelp() {
        if (window.menuManager) {
            window.menuManager.showHelp();
        }
    }
    
    isLoggedIn() {
        return this.currentUser && this.currentUser !== 'GUEST';
    }
    
    requireLogin(action = 'perform this action') {
        if (!this.isLoggedIn()) {
            this.writeLine('');
            this.writeLine(`YOU MUST BE LOGGED IN TO ${action.toUpperCase()}`);
            this.writeLine('TYPE LOGIN TO SIGN IN OR NEW TO REGISTER');
            this.writeLine('');
            return false;
        }
        return true;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerminalCore;
}