const OpenAI = require('openai');
const axios = require('axios');

class AIService {
    constructor() {
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'RetroBBS SaaS'
            }
        });
        
        this.models = {
            fast: 'qwen/qwen-2.5-72b-instruct',
            balanced: 'qwen/qwen-2.5-72b-instruct', 
            premium: 'qwen/qwen-2.5-72b-instruct'
        };
    }
    
    async generateWelcomeMessage(bbsName, theme = 'retro') {
        const prompt = `Generate a classic BBS-style welcome message for "${bbsName}". 
        Make it feel authentic to the 1980s-1990s BBS era with ASCII art borders and retro styling.
        Theme: ${theme}
        Keep it under 20 lines and use only ASCII characters.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.fast,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert in 1980s-1990s BBS culture and ASCII art. Generate authentic retro content.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.8
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI welcome message generation failed:', error);
            return this.getFallbackWelcome(bbsName);
        }
    }
    
    async generateMessageResponse(messageContent, context = '') {
        const prompt = `As a helpful BBS user in the 1980s-1990s era, respond to this message:
        "${messageContent}"
        
        Context: ${context}
        
        Keep your response authentic to BBS culture, friendly, and under 200 words.
        Use appropriate BBS terminology and etiquette.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.balanced,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a knowledgeable and friendly BBS user from the 1980s-1990s. You understand retro computing, BBS culture, and vintage technology.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.7
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI message response generation failed:', error);
            return "Thanks for your message! I'll get back to you soon. 73s!";
        }
    }
    
    async generateDoorGame(gameType = 'adventure') {
        const prompt = `Create a simple text-based ${gameType} game that would fit on a 1980s BBS.
        Include:
        - Game title and brief description
        - Simple rules (2-3 lines)
        - A starting scenario
        - 3-4 possible player actions
        
        Keep it retro and engaging but simple enough for a BBS door game.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.balanced,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a BBS door game developer from the 1980s. Create engaging but simple text-based games.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 600,
                temperature: 0.9
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI door game generation failed:', error);
            return this.getFallbackGame();
        }
    }
    
    async generateFileDescription(filename, fileContent = '') {
        const prompt = `Generate a brief, authentic 1980s-1990s BBS-style description for this file:
        Filename: ${filename}
        Content preview: ${fileContent.substring(0, 200)}
        
        Make it sound like a classic BBS file description (1-2 lines, informative but concise).`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.fast,
                messages: [
                    {
                        role: 'system',
                        content: 'You write concise, informative file descriptions for BBS file areas in the style of the 1980s-1990s.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.6
            });
            
            return response.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI file description generation failed:', error);
            return `${filename} - User uploaded file`;
        }
    }
    
    async generateASCIIArt(text, style = 'simple') {
        const prompt = `Create ASCII art for the text "${text}" in ${style} style.
        Make it suitable for display on a classic BBS terminal (80 columns max).
        Use only standard ASCII characters.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.fast,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an ASCII artist who creates text art for BBS systems. Focus on clarity and terminal compatibility.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 400,
                temperature: 0.7
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI ASCII art generation failed:', error);
            return text.toUpperCase();
        }
    }
    
    async helpUser(question, userLevel = 'beginner') {
        const prompt = `A ${userLevel} BBS user asks: "${question}"
        
        Provide a helpful answer in the style of a knowledgeable BBS sysop from the 1980s-1990s.
        Include relevant BBS terminology and be patient and encouraging.
        Keep response under 300 words.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.balanced,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful and patient BBS sysop with decades of experience. You enjoy helping users learn about BBS systems and retro computing.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 400,
                temperature: 0.6
            });
            
            return response.choices[0].message.content;
        } catch (error) {
            console.error('AI help response generation failed:', error);
            return "Thanks for your question! Please check the help files or contact the sysop for assistance.";
        }
    }
    
    async moderateContent(content) {
        const prompt = `Rate this content for a family-friendly BBS on a scale of 1-10 where:
        1-3: Inappropriate (profanity, harassment, spam)
        4-6: Questionable (might need review)
        7-10: Appropriate for all users
        
        Content: "${content}"
        
        Respond with just the number and a brief reason.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.models.fast,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a content moderator for a family-friendly BBS community. Be fair but protective of the community standards.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.3
            });
            
            const result = response.choices[0].message.content;
            const score = parseInt(result.match(/\d+/)?.[0] || '7');
            
            return {
                score,
                reason: result,
                approved: score >= 7
            };
        } catch (error) {
            console.error('AI content moderation failed:', error);
            return { score: 7, reason: 'Unable to moderate', approved: true };
        }
    }
    
    // Fallback methods for when AI fails
    getFallbackWelcome(bbsName) {
        return `╔══════════════════════════════════════════════════════════════════════════════╗
║                            WELCOME TO ${bbsName.toUpperCase().padEnd(20)}                        ║
║                                                                              ║
║                        "WHERE THE PAST MEETS THE FUTURE"                    ║
║                                                                              ║
║  • MESSAGE BOARDS     • FILE LIBRARIES     • DOOR GAMES                     ║
║  • REAL-TIME CHAT     • USER DIRECTORY     • AND MORE!                      ║
║                                                                              ║
║                     ENJOY YOUR STAY ON THE SYSTEM!                          ║
╚══════════════════════════════════════════════════════════════════════════════╝`;
    }
    
    getFallbackGame() {
        return `
RETRO QUEST
===========

RULES: Navigate the digital realm and collect data crystals.
       Type your choice number to make a decision.

SCENARIO: You find yourself in an abandoned computer lab.
          Dust covers old terminals, but one screen flickers to life.

CHOICES:
1) Approach the terminal
2) Search the room for clues  
3) Check the door for exits
4) Wait and observe
`;
    }
    
    async getUsageStats() {
        // Return usage statistics for billing purposes
        return {
            requests_today: await this.getRequestCount('today'),
            requests_month: await this.getRequestCount('month'),
            tokens_used: await this.getTokenCount('month')
        };
    }
    
    async getRequestCount(period) {
        // This would integrate with your analytics database
        // Placeholder implementation
        return Math.floor(Math.random() * 1000);
    }
    
    async getTokenCount(period) {
        // This would track actual token usage
        // Placeholder implementation  
        return Math.floor(Math.random() * 50000);
    }
}

module.exports = AIService;