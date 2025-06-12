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
        } else if (cmd === '1') {
            this.playGame('GUESS');
        } else if (cmd === '2') {
            this.playGame('TREK');
        } else if (cmd === '3') {
            this.playGame('HANGMAN');
        } else {
            this.writeLine('SELECT GAME NUMBER OR Q)UIT');
            this.showGamePrompt();
        }
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
        this.writeLine('');
        this.writeLine('NEW USER REGISTRATION COMING SOON!');
        this.writeLine('FOR NOW, USE GUEST ACCESS OR CONTACT SYSOP');
        this.writeLine('');
        this.showWelcomePrompt();
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
    
    showGames() {
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
        this.writeLine('1) GUESS THE NUMBER  - CLASSIC GUESSING GAME');
        this.writeLine('2) STAR TREK         - SPACE EXPLORATION');
        this.writeLine('3) HANGMAN           - WORD GUESSING GAME');
        this.writeLine('');
        this.writeLine('MORE GAMES COMING SOON!');
        this.writeLine('');
        this.writeLine('SELECT GAME NUMBER OR Q)UIT:');
        
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
        this.writeLine('');
        this.writeLine('REAL-TIME CHAT FEATURE COMING SOON!');
        this.writeLine('THIS WILL SUPPORT MULTI-USER CHAT ROOMS');
        this.writeLine('');
        this.showMainMenuPrompt();
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