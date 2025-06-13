// Menu Manager - Centralized menu display and navigation
class MenuManager {
    constructor(terminal) {
        this.terminal = terminal;
        this.menuStack = [];
        this.currentMenuData = null;
    }
    
    showWelcome() {
        this.terminal.clearScreen();
        this.terminal.setMenu('welcome');
        
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                            WELCOME TO RETROBBS                              ║
                ║                        APPLE GBBS COMPATIBLE SYSTEM                         ║
                ║                                                                              ║
                ║                           "CONNECTING THE PAST"                             ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('THIS IS A WEB-BASED BULLETIN BOARD SYSTEM THAT RECREATES');
        this.terminal.writeLine('THE CLASSIC APPLE GBBS EXPERIENCE FROM THE 1980S.');
        this.terminal.writeLine('');
        this.terminal.writeLine('CURRENT SYSTEM STATUS:');
        this.terminal.writeLine('  USERS ONLINE: 12');
        this.terminal.writeLine('  MESSAGES TODAY: 47');
        this.terminal.writeLine('  SYSTEM UPTIME: 247 DAYS');
        this.terminal.writeLine('');
        this.terminal.writeLine('TO GET STARTED:');
        this.terminal.writeLine('  N)EW USER REGISTRATION');
        this.terminal.writeLine('  G)UEST ACCESS (LIMITED FEATURES)');
        this.terminal.writeLine('  L)OGIN WITH EXISTING ACCOUNT');
        this.terminal.writeLine('');
        this.terminal.writeLine('ENTER COMMAND:');
    }
    
    showMainMenu() {
        this.terminal.clearScreen();
        this.terminal.setMenu('main');
        
        const username = this.terminal.currentUser || 'GUEST';
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              MAIN MENU                                      ║
                ║                         USER: ${username.padEnd(20)}                          ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('M)ESSAGE BOARDS      - READ AND POST MESSAGES');
        this.terminal.writeLine('F)ILE AREAS          - DOWNLOAD/UPLOAD FILES');
        this.terminal.writeLine('G)AMES               - PLAY DOOR GAMES');
        this.terminal.writeLine('U)SER LIST           - SEE WHO\'S ONLINE');
        this.terminal.writeLine('C)HAT                - REAL-TIME CHAT');
        this.terminal.writeLine('S)TATS               - SYSTEM STATISTICS');
        this.terminal.writeLine('H)ELP                - HELP AND DOCUMENTATION');
        this.terminal.writeLine('Q)UIT                - LOGOUT');
        this.terminal.writeLine('');
        this.terminal.writeLine('MAIN MENU COMMAND:');
    }
    
    showMessageBoards() {
        this.terminal.clearScreen();
        this.terminal.setMenu('messages');
        
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                            MESSAGE BOARDS                                   ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('BOARD #  NAME                    MESSAGES  LAST POST');
        this.terminal.writeLine('───────  ──────────────────────  ────────  ─────────');
        this.terminal.writeLine('   1     GENERAL DISCUSSION         47     TODAY');
        this.terminal.writeLine('   2     RETRO COMPUTING             23     TODAY');
        this.terminal.writeLine('   3     BBS NOSTALGIA               15     YESTERDAY');
        this.terminal.writeLine('   4     PROGRAMMING                 31     TODAY');
        this.terminal.writeLine('   5     APPLE II HELP                8     2 DAYS AGO');
        this.terminal.writeLine('');
        this.terminal.writeLine('COMMANDS: L)IST MESSAGES, R)EAD #, P)OST, Q)UIT TO MAIN');
        this.terminal.writeLine('');
        this.terminal.writeLine('MESSAGE BOARD COMMAND:');
    }
    
    showFileAreas() {
        this.terminal.clearScreen();
        this.terminal.setMenu('files');
        
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              FILE AREAS                                     ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('AREA #   NAME                    FILES    SIZE');
        this.terminal.writeLine('──────   ──────────────────────  ─────    ──────');
        this.terminal.writeLine('   1     APPLE II SOFTWARE         142    45.2MB');
        this.terminal.writeLine('   2     DOCUMENTATION              67    12.8MB');
        this.terminal.writeLine('   3     DISK IMAGES                89    234MB');
        this.terminal.writeLine('   4     UTILITIES                  56    8.9MB');
        this.terminal.writeLine('   5     GAMES                     203    67.4MB');
        this.terminal.writeLine('');
        this.terminal.writeLine('COMMANDS: L)IST FILES, D)OWNLOAD FILE, U)PLOAD, Q)UIT');
        this.terminal.writeLine('');
        this.terminal.writeLine('FILE AREA COMMAND:');
    }
    
    async showGames() {
        this.terminal.clearScreen();
        this.terminal.setMenu('games');
        
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              DOOR GAMES                                     ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('LOADING AVAILABLE GAMES...');
        
        try {
            if (window.bbsApp) {
                const games = await window.bbsApp.getGames();
                this.displayGameList(games);
            } else {
                this.displayDefaultGames();
            }
        } catch (error) {
            console.error('Failed to load games:', error);
            this.displayDefaultGames();
        }
    }
    
    displayGameList(games) {
        this.terminal.clearScreen();
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              DOOR GAMES                                     ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('AVAILABLE GAMES:');
        this.terminal.writeLine('');
        
        games.forEach((game, index) => {
            const num = (index + 1).toString().padStart(2);
            this.terminal.writeLine(`${num}) ${game.name.padEnd(20)} - ${game.description}`);
        });
        
        this.terminal.writeLine('');
        this.terminal.writeLine('SELECT GAME NUMBER OR Q)UIT:');
        this.terminal.writeLine('GAME SELECTION:');
    }
    
    displayDefaultGames() {
        this.terminal.writeLine('');
        this.terminal.writeLine('1) GUESS THE NUMBER  - CLASSIC GUESSING GAME');
        this.terminal.writeLine('2) STAR TREK         - SPACE EXPLORATION');
        this.terminal.writeLine('3) HANGMAN           - WORD GUESSING GAME');
        this.terminal.writeLine('');
        this.terminal.writeLine('SELECT GAME NUMBER OR Q)UIT:');
        this.terminal.writeLine('GAME SELECTION:');
    }
    
    showChat() {
        this.terminal.clearScreen();
        this.terminal.setMenu('chat');
        
        this.terminal.writeHTML(`
            <div class="menu-header">
                ╔══════════════════════════════════════════════════════════════════════════════╗
                ║                              CHAT ROOM                                      ║
                ║                         USERS IN ROOM: <span class="user-count">1</span>                               ║
                ╚══════════════════════════════════════════════════════════════════════════════╝
            </div>
        `);
        
        this.terminal.writeLine('');
        this.terminal.writeLine('ENTERING GENERAL CHAT ROOM...');
        this.terminal.writeLine('TYPE YOUR MESSAGE AND PRESS ENTER TO SEND');
        this.terminal.writeLine('TYPE /QUIT TO RETURN TO MAIN MENU');
        this.terminal.writeLine('TYPE /HELP FOR CHAT COMMANDS');
        this.terminal.writeLine('');
        this.terminal.writeLine('───────────────────────────────────────────────────────────────');
        
        // Join chat room via WebSocket
        if (window.bbsApp && window.bbsApp.socket) {
            window.bbsApp.socket.send(JSON.stringify({
                type: 'join_chat',
                data: { room: 'general' }
            }));
        }
        
        this.terminal.writeLine('');
    }
    
    showStats() {
        this.terminal.writeLine('');
        this.terminal.writeLine('RETROBBS SYSTEM STATISTICS:');
        this.terminal.writeLine('═══════════════════════════');
        this.terminal.writeLine('SYSTEM STARTED:     MARCH 15, 2024');
        this.terminal.writeLine('TOTAL USERS:        1,247');
        this.terminal.writeLine('ACTIVE USERS:       342');
        this.terminal.writeLine('TOTAL MESSAGES:     15,678');
        this.terminal.writeLine('TOTAL FILES:        2,143');
        this.terminal.writeLine('TOTAL DOWNLOADS:    8,901');
        this.terminal.writeLine('SYSTEM UPTIME:      247 DAYS, 14:32:18');
        this.terminal.writeLine('');
        this.terminal.writeLine('MAIN MENU COMMAND:');
    }
    
    showHelp() {
        this.terminal.writeLine('');
        this.terminal.writeLine('RETROBBS HELP SYSTEM:');
        this.terminal.writeLine('════════════════════');
        this.terminal.writeLine('');
        this.terminal.writeLine('NAVIGATION:');
        this.terminal.writeLine('  - TYPE THE LETTER IN PARENTHESES TO SELECT OPTIONS');
        this.terminal.writeLine('  - USE ARROW KEYS TO NAVIGATE COMMAND HISTORY');
        this.terminal.writeLine('  - COMMANDS ARE NOT CASE SENSITIVE');
        this.terminal.writeLine('');
        this.terminal.writeLine('GLOBAL COMMANDS:');
        this.terminal.writeLine('  CLEAR/CLS    - CLEAR SCREEN');
        this.terminal.writeLine('  TIME         - SHOW CURRENT TIME');
        this.terminal.writeLine('  WHO/USERS    - SHOW ONLINE USERS');
        this.terminal.writeLine('  VERSION      - SHOW SYSTEM VERSION');
        this.terminal.writeLine('');
        this.terminal.writeLine('COMMON COMMANDS:');
        this.terminal.writeLine('  Q OR QUIT    - RETURN TO PREVIOUS MENU');
        this.terminal.writeLine('  H OR HELP    - SHOW HELP');
        this.terminal.writeLine('  L OR LIST    - LIST ITEMS');
        this.terminal.writeLine('');
        this.terminal.writeLine('FOR TECHNICAL SUPPORT, CONTACT THE SYSOP');
        this.terminal.writeLine('');
        this.terminal.writeLine('MAIN MENU COMMAND:');
    }
    
    showUserList() {
        this.terminal.writeLine('');
        this.terminal.writeLine('USERS CURRENTLY ONLINE:');
        this.terminal.writeLine('─────────────────────────');
        this.terminal.writeLine('SYSOP        - NODE 1 - MAIN CONSOLE');
        this.terminal.writeLine('RETROGAMER   - NODE 2 - PLAYING TREK');
        this.terminal.writeLine('APPLEFAN     - NODE 3 - READING MSGS');
        this.terminal.writeLine('CODEMONKEY   - NODE 4 - FILE AREA');
        this.terminal.writeLine('GUEST        - NODE 5 - BROWSING');
        this.terminal.writeLine('');
        this.terminal.writeLine('MAIN MENU COMMAND:');
    }
    
    // Navigation utilities
    pushMenu(menuName) {
        this.menuStack.push(this.terminal.currentMenu);
        this.terminal.setMenu(menuName);
    }
    
    popMenu() {
        if (this.menuStack.length > 0) {
            const previousMenu = this.menuStack.pop();
            this.terminal.setMenu(previousMenu);
            this.showCurrentMenu();
        } else {
            this.showMainMenu();
        }
    }
    
    showCurrentMenu() {
        const menu = this.terminal.getMenu();
        switch (menu) {
            case 'welcome':
                this.showWelcome();
                break;
            case 'main':
                this.showMainMenu();
                break;
            case 'messages':
                this.showMessageBoards();
                break;
            case 'files':
                this.showFileAreas();
                break;
            case 'games':
                this.showGames();
                break;
            case 'chat':
                this.showChat();
                break;
            default:
                this.showMainMenu();
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuManager;
}