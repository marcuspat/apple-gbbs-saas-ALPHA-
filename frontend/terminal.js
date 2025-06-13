class Terminal {
    constructor() {
        this.output = document.getElementById('terminal-output');
        this.input = document.getElementById('terminal-input');
        this.currentUser = null;
        this.currentMenu = 'welcome';
        this.commandHistory = [];
        this.historyIndex = 0;
        
        this.init();
    }
    
    init() {
        this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.input.addEventListener('input', this.handleInput.bind(this));
        
        // Hide boot sequence after delay
        setTimeout(() => {
            this.clearScreen();
            this.showWelcome();
        }, 3000);
        
        // Terminal window controls
        document.querySelector('.close').addEventListener('click', () => {
            if (confirm('Exit RetroBBS?')) {
                window.close();
            }
        });
        
        document.querySelector('.minimize').addEventListener('click', () => {
            document.body.style.display = 'none';
            setTimeout(() => document.body.style.display = 'block', 1000);
        });
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.processCommand(this.input.value.trim());
            this.input.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory(1);
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
        
        switch (this.currentMenu) {
            case 'welcome':
                this.handleWelcomeCommand(command);
                break;
            case 'main':
                this.handleMainMenuCommand(command);
                break;
            case 'messages':
                this.handleMessageCommand(command);
                break;
            case 'files':
                this.handleFileCommand(command);
                break;
            case 'games':
                this.handleGameCommand(command);
                break;
            case 'chat':
                this.handleChatCommand(command);
                break;
            case 'registration':
                this.handleRegistrationCommand(command);
                break;
            case 'game':
                this.handleGameSessionCommand(command);
                break;
            default:
                this.writeLine('UNKNOWN MENU STATE');
                this.showMainMenu();
        }
    }
    
    handleWelcomeCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === 'new' || cmd === 'n') {
            this.showNewUserRegistration();
        } else if (cmd === 'guest' || cmd === 'g') {
            this.loginAsGuest();
        } else if (cmd === 'login' || cmd === 'l') {
            this.showLogin();
        } else {
            this.writeLine('INVALID COMMAND. TRY: NEW, GUEST, OR LOGIN');
            this.showWelcomePrompt();
        }
    }
    
    handleMainMenuCommand(command) {
        const cmd = command.toLowerCase();
        
        switch (cmd) {
            case 'm':
            case 'messages':
                this.showMessageBoards();
                break;
            case 'f':
            case 'files':
                this.showFileAreas();
                break;
            case 'g':
            case 'games':
                this.showGames();
                break;
            case 'u':
            case 'userlist':
                this.showUserList();
                break;
            case 'c':
            case 'chat':
                this.showChat();
                break;
            case 's':
            case 'stats':
                this.showStats();
                break;
            case 'q':
            case 'quit':
                this.logout();
                break;
            case 'h':
            case 'help':
                this.showHelp();
                break;
            default:
                this.writeLine('INVALID COMMAND. TYPE H FOR HELP.');
                this.showMainMenuPrompt();
        }
    }
    
    handleMessageCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === 'q' || cmd === 'quit') {
            this.showMainMenu();
        } else if (cmd === 'l' || cmd === 'list') {
            this.listMessages();
        } else if (cmd.startsWith('r ')) {
            const msgNum = parseInt(cmd.split(' ')[1]);
            this.readMessage(msgNum);
        } else if (cmd === 'p' || cmd === 'post') {
            this.postMessage();
        } else {
            this.writeLine('MESSAGE COMMANDS: L)IST, R)EAD #, P)OST, Q)UIT');
            this.showMessagePrompt();
        }
    }
    
    handleFileCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === 'q' || cmd === 'quit') {
            this.showMainMenu();
        } else if (cmd === 'l' || cmd === 'list') {
            this.listFiles();
        } else if (cmd.startsWith('d ')) {
            const fileName = cmd.split(' ')[1];
            this.downloadFile(fileName);
        } else if (cmd === 'u' || cmd === 'upload') {
            this.uploadFile();
        } else {
            this.writeLine('FILE COMMANDS: L)IST, D)OWNLOAD FILE, U)PLOAD, Q)UIT');
            this.showFilePrompt();
        }
    }
    
    handleGameCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === 'q' || cmd === 'quit') {
            this.showMainMenu();
        } else {
            const gameNum = parseInt(cmd);
            if (gameNum > 0 && this.availableGames && gameNum <= this.availableGames.length) {
                const game = this.availableGames[gameNum - 1];
                this.startGame(game);
            } else {
                this.writeLine('INVALID GAME NUMBER. SELECT GAME NUMBER OR Q)UIT');
                this.showGamePrompt();
            }
        }
    }
    
    async startGame(game) {
        this.writeLine('');
        this.writeLine(`STARTING ${game.name.toUpperCase()}...`);
        
        try {
            const session = await window.bbsApp.startGame(game.id);
            if (session.sessionId) {
                this.currentGameSession = session.sessionId;
                this.currentGameId = game.id;
                this.currentMenu = 'game';
                
                this.clearScreen();
                this.writeHTML(`
                    <div class="menu-header">
                        ╔══════════════════════════════════════════════════════════════════════════════╗
                        ║                            ${game.name.toUpperCase().padEnd(48)}           ║
                        ╚══════════════════════════════════════════════════════════════════════════════╝
                    </div>
                `);
                
                this.writeLine('');
                this.writeLine(session.message || 'Game started!');
                this.writeLine('');
                this.writeLine('Type your commands below. Type QUIT to exit game.');
                this.writeLine('');
                
                // Start the game by sending initial action
                this.sendGameAction('start', {});
            }
        } catch (error) {
            this.writeLine('FAILED TO START GAME. RETURNING TO GAMES MENU...');
            setTimeout(() => this.showGames(), 2000);
        }
    }
    
    handleGameSessionCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === 'quit' || cmd === 'q') {
            this.endGame();
            return;
        }
        
        // If game is completed, any key returns to games menu
        if (this.gameCompleted) {
            this.gameCompleted = false;
            this.endGame();
            return;
        }
        
        // Parse game-specific commands
        if (this.currentGameId) {
            const parts = cmd.split(' ');
            const action = parts[0];
            const data = {};
            
            // Handle different game types
            if (action === 'guess' && parts[1]) {
                data.number = parts[1];
            } else if (action === 'fire' || action === 'move' || action === 'scan') {
                // Trek commands
            } else if (parts[0] && parts[0].length === 1) {
                // Hangman letter guess
                data.letter = parts[0];
                this.sendGameAction('guess', data);
                return;
            } else if (!isNaN(parseInt(cmd))) {
                // Number guess
                data.number = cmd;
                this.sendGameAction('guess', data);
                return;
            }
            
            this.sendGameAction(action, data);
        }
    }
    
    async sendGameAction(action, data) {
        try {
            const response = await window.bbsApp.sendGameAction(this.currentGameSession, action, data);
            
            if (response.response) {
                this.writeLine('');
                this.writeLine(response.response.message);
                
                if (response.response.word) {
                    this.writeLine(`WORD: ${response.response.word}`);
                }
                
                if (response.response.status) {
                    this.writeLine(response.response.status);
                }
                
                if (response.response.prompt) {
                    this.writeLine('');
                    this.writeLine(response.response.prompt);
                }
                
                if (response.response.completed) {
                    this.writeLine('');
                    this.writeLine('GAME COMPLETED! PRESS ANY KEY TO RETURN TO GAMES...');
                    this.gameCompleted = true;
                }
            }
        } catch (error) {
            this.writeLine('GAME ERROR. RETURNING TO GAMES MENU...');
            setTimeout(() => this.showGames(), 2000);
        }
    }
    
    async endGame() {
        if (this.currentGameSession) {
            try {
                await window.bbsApp.endGame(this.currentGameSession);
            } catch (error) {
                console.error('Failed to end game session:', error);
            }
            this.currentGameSession = null;
            this.currentGameId = null;
        }
        this.showGames();
    }
    
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
    
    showWelcome() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                            WELCOME TO RETROBBS                              ║
                ║                        APPLE GBBS COMPATIBLE SYSTEM                         ║
                ║                                                                              ║
                ║                           "CONNECTING THE PAST"                             ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('THIS IS A WEB-BASED BULLETIN BOARD SYSTEM THAT RECREATES');
        this.writeLine('THE CLASSIC APPLE GBBS EXPERIENCE FROM THE 1980S.');
        this.writeLine('');
        this.writeLine('CURRENT SYSTEM STATUS:');
        this.writeLine('  USERS ONLINE: 12');
        this.writeLine('  MESSAGES TODAY: 47');
        this.writeLine('  SYSTEM UPTIME: 247 DAYS');
        this.writeLine('');
        this.writeLine('TO GET STARTED:');
        this.writeLine('  N)EW USER REGISTRATION');
        this.writeLine('  G)UEST ACCESS (LIMITED FEATURES)');
        this.writeLine('  L)OGIN WITH EXISTING ACCOUNT');
        this.writeLine('');
        
        this.showWelcomePrompt();
    }
    
    showWelcomePrompt() {
        this.writeLine('ENTER COMMAND:');
        this.currentMenu = 'welcome';
    }
    
    showMainMenu() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              MAIN MENU                                      ║
                ║                         USER: ${(this.currentUser || 'GUEST').padEnd(20)}                          ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('M)ESSAGE BOARDS      - READ AND POST MESSAGES');
        this.writeLine('F)ILE AREAS          - DOWNLOAD/UPLOAD FILES');
        this.writeLine('G)AMES               - PLAY DOOR GAMES');
        this.writeLine('U)SER LIST           - SEE WHO\'S ONLINE');
        this.writeLine('C)HAT                - REAL-TIME CHAT');
        this.writeLine('S)TATS               - SYSTEM STATISTICS');
        this.writeLine('H)ELP                - HELP AND DOCUMENTATION');
        this.writeLine('Q)UIT                - LOGOUT');
        this.writeLine('');
        
        this.showMainMenuPrompt();
    }
    
    showMainMenuPrompt() {
        this.writeLine('MAIN MENU COMMAND:');
        this.currentMenu = 'main';
    }
    
    loginAsGuest() {
        this.currentUser = 'GUEST';
        this.writeLine('');
        this.writeLine('LOGGED IN AS GUEST USER');
        this.writeLine('SOME FEATURES MAY BE RESTRICTED');
        this.writeLine('');
        setTimeout(() => this.showMainMenu(), 1000);
    }
    
    showLogin() {
        document.getElementById('login-modal').style.display = 'flex';
    }
    
    showNewUserRegistration() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                           NEW USER REGISTRATION                             ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('CREATE YOUR NEW BBS ACCOUNT');
        this.writeLine('');
        this.writeLine('PLEASE PROVIDE THE FOLLOWING INFORMATION:');
        this.writeLine('');
        
        this.currentMenu = 'registration';
        this.registrationStep = 'username';
        this.registrationData = {};
        
        this.writeLine('ENTER YOUR DESIRED USERNAME (3-15 CHARACTERS):');
    }
    
    showMessageBoards() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                            MESSAGE BOARDS                                   ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('BOARD #  NAME                    MESSAGES  LAST POST');
        this.writeLine('───────  ──────────────────────  ────────  ─────────');
        this.writeLine('   1     GENERAL DISCUSSION         47     TODAY');
        this.writeLine('   2     RETRO COMPUTING             23     TODAY');
        this.writeLine('   3     BBS NOSTALGIA               15     YESTERDAY');
        this.writeLine('   4     PROGRAMMING                 31     TODAY');
        this.writeLine('   5     APPLE II HELP                8     2 DAYS AGO');
        this.writeLine('');
        this.writeLine('COMMANDS: L)IST MESSAGES, R)EAD #, P)OST, Q)UIT TO MAIN');
        this.writeLine('');
        
        this.showMessagePrompt();
    }
    
    showMessagePrompt() {
        this.writeLine('MESSAGE BOARD COMMAND:');
        this.currentMenu = 'messages';
    }
    
    showFileAreas() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              FILE AREAS                                     ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('AREA #   NAME                    FILES    SIZE');
        this.writeLine('──────   ──────────────────────  ─────    ──────');
        this.writeLine('   1     APPLE II SOFTWARE         142    45.2MB');
        this.writeLine('   2     DOCUMENTATION              67    12.8MB');
        this.writeLine('   3     DISK IMAGES                89    234MB');
        this.writeLine('   4     UTILITIES                  56    8.9MB');
        this.writeLine('   5     GAMES                     203    67.4MB');
        this.writeLine('');
        this.writeLine('COMMANDS: L)IST FILES, D)OWNLOAD FILE, U)PLOAD, Q)UIT');
        this.writeLine('');
        
        this.showFilePrompt();
    }
    
    showFilePrompt() {
        this.writeLine('FILE AREA COMMAND:');
        this.currentMenu = 'files';
    }
    
    async showGames() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              DOOR GAMES                                     ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('LOADING AVAILABLE GAMES...');
        
        try {
            const games = await window.bbsApp.getGames();
            this.clearScreen();
            this.writeHTML(`
                <div class="menu-header">
                    ╔══════════════════════════════════════════════════════════════════════════════╗
                    ║                              DOOR GAMES                                     ║
                    ╚══════════════════════════════════════════════════════════════════════════════╝
                </div>
            `);
            
            this.writeLine('');
            this.writeLine('AVAILABLE GAMES:');
            this.writeLine('');
            
            games.forEach((game, index) => {
                const num = (index + 1).toString().padStart(2);
                this.writeLine(`${num}) ${game.name.padEnd(20)} - ${game.description}`);
            });
            
            this.writeLine('');
            this.writeLine('SELECT GAME NUMBER OR Q)UIT:');
            this.availableGames = games;
        } catch (error) {
            this.writeLine('FAILED TO LOAD GAMES. USING DEFAULTS...');
            this.writeLine('');
            this.writeLine('1) GUESS THE NUMBER  - CLASSIC GUESSING GAME');
            this.writeLine('2) STAR TREK         - SPACE EXPLORATION');
            this.writeLine('3) HANGMAN           - WORD GUESSING GAME');
            this.writeLine('');
            this.writeLine('SELECT GAME NUMBER OR Q)UIT:');
        }
        
        this.showGamePrompt();
    }
    
    showGamePrompt() {
        this.writeLine('GAME SELECTION:');
        this.currentMenu = 'games';
    }
    
    showUserList() {
        this.writeLine('');
        this.writeLine('USERS CURRENTLY ONLINE:');
        this.writeLine('─────────────────────────');
        this.writeLine('SYSOP        - NODE 1 - MAIN CONSOLE');
        this.writeLine('RETROGAMER   - NODE 2 - PLAYING TREK');
        this.writeLine('APPLEFAN     - NODE 3 - READING MSGS');
        this.writeLine('CODEMONKEY   - NODE 4 - FILE AREA');
        this.writeLine('GUEST        - NODE 5 - BROWSING');
        this.writeLine('');
        this.showMainMenuPrompt();
    }
    
    showChat() {
        this.clearScreen();
        this.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              CHAT ROOM                                      ║
                ║                         USERS IN ROOM: <span class="user-count">1</span>                               ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.writeLine('');
        this.writeLine('ENTERING GENERAL CHAT ROOM...');
        this.writeLine('TYPE YOUR MESSAGE AND PRESS ENTER TO SEND');
        this.writeLine('TYPE /QUIT TO RETURN TO MAIN MENU');
        this.writeLine('TYPE /HELP FOR CHAT COMMANDS');
        this.writeLine('');
        this.writeLine('───────────────────────────────────────────────────────────────');
        
        // Join chat room
        if (window.bbsApp && window.bbsApp.socket) {
            window.bbsApp.socket.send(JSON.stringify({
                type: 'join_chat',
                data: { room: 'general' }
            }));
        }
        
        this.currentMenu = 'chat';
        this.showChatPrompt();
    }
    
    showChatPrompt() {
        this.writeLine('');
        this.currentMenu = 'chat';
    }
    
    handleChatCommand(command) {
        const cmd = command.toLowerCase();
        
        if (cmd === '/quit' || cmd === '/q') {
            // Leave chat room
            if (window.bbsApp && window.bbsApp.socket) {
                window.bbsApp.socket.send(JSON.stringify({
                    type: 'leave_chat'
                }));
            }
            this.showMainMenu();
        } else if (cmd === '/help' || cmd === '/h') {
            this.showChatHelp();
        } else if (cmd.startsWith('/')) {
            this.writeLine('UNKNOWN COMMAND. TYPE /HELP FOR COMMANDS');
        } else {
            // Send chat message
            if (window.bbsApp) {
                window.bbsApp.sendChatMessage(command);
            }
        }
    }
    
    showChatHelp() {
        this.writeLine('');
        this.writeLine('CHAT COMMANDS:');
        this.writeLine('  /QUIT or /Q  - RETURN TO MAIN MENU');
        this.writeLine('  /HELP or /H  - SHOW THIS HELP');
        this.writeLine('  /USERS       - LIST USERS IN ROOM');
        this.writeLine('  /ME <action> - PERFORM AN ACTION');
        this.writeLine('');
    }
    
    handleRegistrationCommand(command) {
        const input = command.trim();
        
        switch (this.registrationStep) {
            case 'username':
                if (input.length < 3 || input.length > 15) {
                    this.writeLine('USERNAME MUST BE 3-15 CHARACTERS. TRY AGAIN:');
                    return;
                }
                this.registrationData.username = input;
                this.registrationStep = 'email';
                this.writeLine('');
                this.writeLine('ENTER YOUR EMAIL ADDRESS:');
                break;
                
            case 'email':
                if (!input.includes('@') || !input.includes('.')) {
                    this.writeLine('INVALID EMAIL FORMAT. TRY AGAIN:');
                    return;
                }
                this.registrationData.email = input;
                this.registrationStep = 'password';
                this.writeLine('');
                this.writeLine('ENTER YOUR PASSWORD (MINIMUM 6 CHARACTERS):');
                break;
                
            case 'password':
                if (input.length < 6) {
                    this.writeLine('PASSWORD TOO SHORT. MINIMUM 6 CHARACTERS:');
                    return;
                }
                this.registrationData.password = input;
                this.registrationStep = 'confirm';
                this.writeLine('');
                this.writeLine('CONFIRM YOUR PASSWORD:');
                break;
                
            case 'confirm':
                if (input !== this.registrationData.password) {
                    this.writeLine('PASSWORDS DO NOT MATCH. ENTER PASSWORD AGAIN:');
                    this.registrationStep = 'password';
                    return;
                }
                this.submitRegistration();
                break;
        }
    }
    
    async submitRegistration() {
        this.writeLine('');
        this.writeLine('CREATING YOUR ACCOUNT...');
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.registrationData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.writeLine('');
                this.writeLine('REGISTRATION SUCCESSFUL!');
                this.writeLine(`WELCOME, ${data.user.username}!`);
                this.writeLine('');
                
                // Store session token
                localStorage.setItem('bbsToken', data.token);
                this.currentUser = data.user.username;
                
                // Update WebSocket connection with user info
                if (window.bbsApp) {
                    window.bbsApp.user = data.user;
                }
                
                setTimeout(() => this.showMainMenu(), 2000);
            } else {
                this.writeLine('');
                this.writeLine(`REGISTRATION FAILED: ${data.message}`);
                this.writeLine('');
                setTimeout(() => this.showWelcome(), 2000);
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.writeLine('');
            this.writeLine('REGISTRATION FAILED: NETWORK ERROR');
            this.writeLine('');
            setTimeout(() => this.showWelcome(), 2000);
        }
    }
    
    showStats() {
        this.writeLine('');
        this.writeLine('RETROBBS SYSTEM STATISTICS:');
        this.writeLine('═══════════════════════════');
        this.writeLine('SYSTEM STARTED:     MARCH 15, 2024');
        this.writeLine('TOTAL USERS:        1,247');
        this.writeLine('ACTIVE USERS:       342');
        this.writeLine('TOTAL MESSAGES:     15,678');
        this.writeLine('TOTAL FILES:        2,143');
        this.writeLine('TOTAL DOWNLOADS:    8,901');
        this.writeLine('SYSTEM UPTIME:      247 DAYS, 14:32:18');
        this.writeLine('');
        this.showMainMenuPrompt();
    }
    
    showHelp() {
        this.writeLine('');
        this.writeLine('RETROBBS HELP SYSTEM:');
        this.writeLine('════════════════════');
        this.writeLine('');
        this.writeLine('NAVIGATION:');
        this.writeLine('  - TYPE THE LETTER IN PARENTHESES TO SELECT OPTIONS');
        this.writeLine('  - USE ARROW KEYS TO NAVIGATE COMMAND HISTORY');
        this.writeLine('  - COMMANDS ARE NOT CASE SENSITIVE');
        this.writeLine('');
        this.writeLine('COMMON COMMANDS:');
        this.writeLine('  Q OR QUIT - RETURN TO PREVIOUS MENU');
        this.writeLine('  H OR HELP - SHOW HELP');
        this.writeLine('  L OR LIST - LIST ITEMS');
        this.writeLine('');
        this.writeLine('FOR TECHNICAL SUPPORT, CONTACT THE SYSOP');
        this.writeLine('');
        this.showMainMenuPrompt();
    }
    
    logout() {
        this.writeLine('');
        this.writeLine('THANK YOU FOR USING RETROBBS!');
        this.writeLine('CONNECTION TERMINATED...');
        this.currentUser = null;
        setTimeout(() => this.showWelcome(), 2000);
    }
    
    listMessages() {
        this.writeLine('');
        this.writeLine('RECENT MESSAGES IN GENERAL DISCUSSION:');
        this.writeLine('══════════════════════════════════════');
        this.writeLine('#47  WELCOME TO THE NEW BBS!         - SYSOP      - TODAY 14:32');
        this.writeLine('#46  ANYONE REMEMBER TRADEWARS?      - RETROGAMER - TODAY 12:15');
        this.writeLine('#45  APPLE IIGS EMULATION TIPS       - APPLEFAN   - TODAY 09:22');
        this.writeLine('#44  BBS DOOR GAME RECOMMENDATIONS   - CODEMONKEY - YESTERDAY');
        this.writeLine('#43  LOOKING FOR ZMODEM TRANSFER     - NEWBIE     - YESTERDAY');
        this.writeLine('');
        this.showMessagePrompt();
    }
    
    readMessage(msgNum) {
        if (!msgNum || msgNum > 47) {
            this.writeLine('INVALID MESSAGE NUMBER');
            this.showMessagePrompt();
            return;
        }
        
        this.writeLine('');
        this.writeLine(`MESSAGE #${msgNum}:`);
        this.writeLine('═════════════');
        this.writeLine('FROM: SYSOP');
        this.writeLine('DATE: TODAY 14:32');
        this.writeLine('SUBJ: WELCOME TO THE NEW BBS!');
        this.writeLine('');
        this.writeLine('WELCOME EVERYONE TO THE NEW RETROBBS SYSTEM!');
        this.writeLine('');
        this.writeLine('THIS IS A MODERN WEB-BASED BBS THAT RECREATES');
        this.writeLine('THE CLASSIC APPLE GBBS EXPERIENCE. WE HAVE');
        this.writeLine('ALL THE FEATURES YOU REMEMBER:');
        this.writeLine('');
        this.writeLine('- MESSAGE BOARDS');
        this.writeLine('- FILE TRANSFERS');
        this.writeLine('- DOOR GAMES');
        this.writeLine('- REAL-TIME CHAT');
        this.writeLine('');
        this.writeLine('ENJOY YOUR STAY!');
        this.writeLine('');
        this.writeLine('73,');
        this.writeLine('THE SYSOP');
        this.writeLine('');
        this.showMessagePrompt();
    }
    
    postMessage() {
        this.writeLine('');
        this.writeLine('MESSAGE POSTING FEATURE COMING SOON!');
        this.writeLine('THIS WILL ALLOW FULL MESSAGE COMPOSITION');
        this.writeLine('');
        this.showMessagePrompt();
    }
    
    listFiles() {
        this.writeLine('');
        this.writeLine('FILES IN APPLE II SOFTWARE AREA:');
        this.writeLine('════════════════════════════════');
        this.writeLine('FILENAME.EXT     SIZE    DATE       DESCRIPTION');
        this.writeLine('──────────────   ─────   ────────   ─────────────────────');
        this.writeLine('APPLESOFT.DSK    140K    03/15/24   APPLESOFT BASIC DISK');
        this.writeLine('PRODOS.DSK       140K    03/15/24   PRODOS SYSTEM DISK');
        this.writeLine('GAMES.DSK        140K    03/14/24   CLASSIC APPLE GAMES');
        this.writeLine('UTILITIES.DSK    140K    03/14/24   DISK UTILITIES');
        this.writeLine('DEMOS.DSK        140K    03/13/24   DEMONSTRATION PROGS');
        this.writeLine('');
        this.showFilePrompt();
    }
    
    downloadFile(fileName) {
        this.writeLine('');
        this.writeLine(`DOWNLOADING ${fileName.toUpperCase()}...`);
        this.writeLine('FILE TRANSFER FEATURE COMING SOON!');
        this.writeLine('THIS WILL SUPPORT MODERN DOWNLOAD METHODS');
        this.writeLine('');
        this.showFilePrompt();
    }
    
    uploadFile() {
        this.writeLine('');
        this.writeLine('FILE UPLOAD FEATURE COMING SOON!');
        this.writeLine('THIS WILL SUPPORT DRAG-AND-DROP UPLOADS');
        this.writeLine('');
        this.showFilePrompt();
    }
    
    playGame(game) {
        this.writeLine('');
        this.writeLine(`STARTING ${game} GAME...`);
        this.writeLine('DOOR GAMES FEATURE COMING SOON!');
        this.writeLine('THESE WILL BE FULLY INTERACTIVE GAMES');
        this.writeLine('');
        this.showGamePrompt();
    }
}

// Initialize terminal when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.terminal = new Terminal();
});