const crypto = require('crypto');

/**
 * Enhanced AI Service with caching, rate limiting, and better error handling
 */
class EnhancedAIService {
    constructor(databaseService) {
        this.db = databaseService;
        this.baseURL = 'https://openrouter.ai/api/v1/chat/completions';
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.models = {
            hobbyist: 'qwen/qwen-2.5-7b-instruct',
            community: 'qwen/qwen-2.5-32b-instruct', 
            enterprise: 'qwen/qwen-2.5-72b-instruct'
        };
        this.requestCount = 0;
        this.tokenCount = 0;
        this.rateLimits = new Map();
        this.maxRequestsPerMinute = 30;
        this.defaultCacheTTL = 3600; // 1 hour
        
        if (!this.apiKey) {
            console.warn('OPENROUTER_API_KEY not configured - AI features disabled');
        }
    }
    
    /**
     * Generate cache key for requests
     */
    generateCacheKey(prompt, model, options = {}) {
        const key = JSON.stringify({ prompt, model, options });
        return crypto.createHash('sha256').update(key).digest('hex');
    }
    
    /**
     * Check rate limits for user/IP
     */
    checkRateLimit(identifier) {
        const now = Date.now();
        const userLimits = this.rateLimits.get(identifier) || { count: 0, resetTime: now + 60000 };
        
        if (now > userLimits.resetTime) {
            userLimits.count = 0;
            userLimits.resetTime = now + 60000;
        }
        
        if (userLimits.count >= this.maxRequestsPerMinute) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        userLimits.count++;
        this.rateLimits.set(identifier, userLimits);
        return true;
    }
    
    /**
     * Get model based on subscription tier
     */
    getModelForTier(subscriptionTier = 'hobbyist') {
        return this.models[subscriptionTier] || this.models.hobbyist;
    }
    
    /**
     * Enhanced API request with retry and error handling
     */
    async makeAPIRequest(messages, model, options = {}) {
        if (!this.apiKey) {
            throw new Error('AI service not configured');
        }
        
        const maxRetries = 3;
        const baseDelay = 1000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(this.baseURL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://retrobbs.com',
                        'X-Title': 'RetroBBS AI Assistant'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        max_tokens: options.maxTokens || 1000,
                        temperature: options.temperature || 0.7,
                        top_p: options.topP || 0.9,
                        frequency_penalty: options.frequencyPenalty || 0.1,
                        presence_penalty: options.presencePenalty || 0.1
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`API request failed: ${response.status} - ${errorData}`);
                }
                
                const data = await response.json();
                
                if (!data.choices || !data.choices[0]) {
                    throw new Error('Invalid API response format');
                }
                
                // Track usage
                this.requestCount++;
                if (data.usage && data.usage.total_tokens) {
                    this.tokenCount += data.usage.total_tokens;
                }
                
                return {
                    content: data.choices[0].message.content,
                    usage: data.usage || { total_tokens: 0 }
                };
                
            } catch (error) {
                console.error(`AI API attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    /**
     * Generate welcome message with caching
     */
    async generateWelcomeMessage(bbsName, theme, subscriptionTier = 'hobbyist', userId = null) {
        try {
            // Rate limiting check
            if (userId) {
                this.checkRateLimit(`user:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`welcome:${bbsName}:${theme}`, subscriptionTier);
            
            // Check cache first
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return cached.response;
            }
            
            const model = this.getModelForTier(subscriptionTier);
            const messages = [
                {
                    role: 'system',
                    content: `You are an AI assistant for a retro bulletin board system (BBS) called "${bbsName}". Create ASCII art welcome messages that capture the nostalgia of 1980s computing. Use only standard ASCII characters and keep line width under 80 characters. Theme: ${theme}`
                },
                {
                    role: 'user',
                    content: `Create a retro ASCII welcome message for "${bbsName}" BBS with theme "${theme}". Include ASCII art, welcome text, and system info. Make it feel authentic to the 1980s BBS era.`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 800,
                temperature: 0.8
            });
            
            // Cache the result
            await this.db.setCachedAIResponse(cacheKey, result.content, model, result.usage.total_tokens, this.defaultCacheTTL);
            
            return result.content;
            
        } catch (error) {
            console.error('Welcome message generation failed:', error);
            return this.getFallbackWelcome(bbsName);
        }
    }
    
    /**
     * Generate intelligent message responses
     */
    async generateMessageResponse(message, context, subscriptionTier = 'hobbyist', userId = null) {
        try {
            if (userId) {
                this.checkRateLimit(`user:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`response:${message}`, subscriptionTier);
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return cached.response;
            }
            
            const model = this.getModelForTier(subscriptionTier);
            const messages = [
                {
                    role: 'system',
                    content: 'You are a helpful BBS assistant from the 1980s. Respond in the style of that era - be knowledgeable about retro computing but maintain the authentic vocabulary and references of the time. Keep responses concise and helpful.'
                },
                {
                    role: 'user',
                    content: `Context: ${context}\n\nUser message: ${message}\n\nProvide a helpful response in authentic 1980s BBS style.`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 600,
                temperature: 0.7
            });
            
            await this.db.setCachedAIResponse(cacheKey, result.content, model, result.usage.total_tokens, 1800); // 30 min cache
            
            return result.content;
            
        } catch (error) {
            console.error('Message response generation failed:', error);
            return 'Sorry, I\'m having trouble connecting to the mainframe right now. Please try again later.';
        }
    }
    
    /**
     * Generate door game content
     */
    async generateDoorGame(gameType, subscriptionTier = 'hobbyist', userId = null) {
        try {
            if (userId) {
                this.checkRateLimit(`user:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`game:${gameType}`, subscriptionTier);
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return cached.response;
            }
            
            const model = this.getModelForTier(subscriptionTier);
            const messages = [
                {
                    role: 'system',
                    content: 'You are a creative game designer for 1980s BBS door games. Create engaging, text-based game content that captures the spirit of classic BBS gaming. Focus on simple but entertaining gameplay mechanics.'
                },
                {
                    role: 'user',
                    content: `Create a ${gameType} door game for a BBS. Include game rules, initial setup, and sample gameplay. Make it authentic to 1980s BBS gaming style.`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 1200,
                temperature: 0.8
            });
            
            await this.db.setCachedAIResponse(cacheKey, result.content, model, result.usage.total_tokens, 7200); // 2 hour cache
            
            return result.content;
            
        } catch (error) {
            console.error('Door game generation failed:', error);
            return this.getFallbackGame(gameType);
        }
    }
    
    /**
     * Generate ASCII art
     */
    async generateASCIIArt(text, style = 'block', subscriptionTier = 'hobbyist', userId = null) {
        try {
            if (userId) {
                this.checkRateLimit(`user:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`ascii:${text}:${style}`, subscriptionTier);
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return cached.response;
            }
            
            const model = this.getModelForTier(subscriptionTier);
            const messages = [
                {
                    role: 'system',
                    content: 'You are an ASCII art generator for 1980s BBS systems. Create ASCII art using only standard keyboard characters. Keep designs under 80 characters wide and authentic to the retro computing era.'
                },
                {
                    role: 'user',
                    content: `Create ASCII art for the text "${text}" in ${style} style. Make it suitable for a retro BBS display.`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 800,
                temperature: 0.6
            });
            
            await this.db.setCachedAIResponse(cacheKey, result.content, model, result.usage.total_tokens, 86400); // 24 hour cache
            
            return result.content;
            
        } catch (error) {
            console.error('ASCII art generation failed:', error);
            return this.getFallbackASCII(text);
        }
    }
    
    /**
     * Intelligent help system
     */
    async helpUser(question, userLevel = 'beginner', subscriptionTier = 'hobbyist', userId = null) {
        try {
            if (userId) {
                this.checkRateLimit(`user:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`help:${question}:${userLevel}`, subscriptionTier);
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return cached.response;
            }
            
            const model = this.getModelForTier(subscriptionTier);
            const messages = [
                {
                    role: 'system',
                    content: `You are a knowledgeable BBS sysop from the 1980s helping users. Tailor your response to a ${userLevel} user level. Be helpful, patient, and authentic to the era. Include specific commands and steps when applicable.`
                },
                {
                    role: 'user',
                    content: `Help request: ${question}\n\nUser level: ${userLevel}\n\nProvide clear, helpful guidance in authentic BBS style.`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 800,
                temperature: 0.5
            });
            
            await this.db.setCachedAIResponse(cacheKey, result.content, model, result.usage.total_tokens, 3600); // 1 hour cache
            
            return result.content;
            
        } catch (error) {
            console.error('Help generation failed:', error);
            return 'For help with BBS commands, type HELP at any menu. Contact the SYSOP if you need additional assistance.';
        }
    }
    
    /**
     * Content moderation
     */
    async moderateContent(content, userId = null) {
        try {
            if (userId) {
                this.checkRateLimit(`moderation:${userId}`);
            }
            
            const cacheKey = this.generateCacheKey(`moderate:${content}`, 'hobbyist');
            const cached = await this.db.getCachedAIResponse(cacheKey);
            if (cached) {
                return JSON.parse(cached.response);
            }
            
            const model = this.models.hobbyist; // Use fastest model for moderation
            const messages = [
                {
                    role: 'system',
                    content: 'You are a content moderator for a family-friendly BBS. Analyze content for inappropriate material including spam, harassment, profanity, illegal content, or other violations. Respond with JSON: {"safe": boolean, "reason": "explanation", "confidence": 0-1}'
                },
                {
                    role: 'user',
                    content: `Analyze this content: "${content}"`
                }
            ];
            
            const result = await this.makeAPIRequest(messages, model, {
                maxTokens: 200,
                temperature: 0.1
            });
            
            let moderation;
            try {
                moderation = JSON.parse(result.content);
            } catch {
                moderation = { safe: true, reason: 'Unable to parse moderation result', confidence: 0.5 };
            }
            
            await this.db.setCachedAIResponse(cacheKey, JSON.stringify(moderation), model, result.usage.total_tokens, 86400);
            
            return moderation;
            
        } catch (error) {
            console.error('Content moderation failed:', error);
            // Fail safe - allow content if moderation fails
            return { safe: true, reason: 'Moderation service unavailable', confidence: 0 };
        }
    }
    
    /**
     * Get usage statistics
     */
    getUsageStats() {
        return {
            requests: this.requestCount,
            tokens: this.tokenCount,
            rateLimitedUsers: this.rateLimits.size
        };
    }
    
    /**
     * Clear expired rate limits
     */
    cleanupRateLimits() {
        const now = Date.now();
        for (const [identifier, limits] of this.rateLimits.entries()) {
            if (now > limits.resetTime) {
                this.rateLimits.delete(identifier);
            }
        }
    }
    
    /**
     * Fallback responses when AI service fails
     */
    getFallbackWelcome(bbsName) {
        return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                            WELCOME TO ${bbsName.toUpperCase().padEnd(20)}                              ║
║                         RETRO BBS EXPERIENCE                                ║
║                                                                              ║
║              "CONNECTING MINDS ACROSS THE DIGITAL FRONTIER"                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

GREETINGS, TRAVELER OF THE ELECTRONIC HIGHWAYS!

YOU HAVE CONNECTED TO A GATEWAY TO THE PAST, WHERE THE SPIRIT
OF THE ORIGINAL BULLETIN BOARD SYSTEMS LIVES ON. HERE YOU WILL
FIND COMMUNITY, KNOWLEDGE, AND THE TIMELESS JOY OF DISCOVERY.

SYSTEM STATUS: ONLINE AND READY
LAST MAINTENANCE: ${new Date().toDateString().toUpperCase()}
SYSOP: AVAILABLE FOR ASSISTANCE

ENJOY YOUR STAY AND REMEMBER - THE FUTURE IS WHAT WE MAKE IT!
        `;
    }
    
    getFallbackGame(gameType) {
        return `
═══════════════════════════════════════════════════════════════════════════════
                              ${gameType.toUpperCase()} GAME
═══════════════════════════════════════════════════════════════════════════════

Welcome to the classic ${gameType} door game!

This game is currently being prepared by our AI assistant.
Please check back shortly for a fully interactive experience.

In the meantime, try our other available games or explore
the message boards and file areas.

Thank you for your patience!

Press any key to return to the game menu...
        `;
    }
    
    getFallbackASCII(text) {
        return `
 ╔══════════════════════════════════════════════════════════════════════════╗
 ║                                                                          ║
 ║                           ${text.toUpperCase().padEnd(20)}                           ║
 ║                                                                          ║
 ╚══════════════════════════════════════════════════════════════════════════╝
        `;
    }
}

module.exports = EnhancedAIService;