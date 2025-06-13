const nodemailer = require('nodemailer');

/**
 * Enhanced Email Service with queueing, templates, and retry logic
 */
class EnhancedEmailService {
    constructor(databaseService) {
        this.db = databaseService;
        this.transporter = null;
        this.isProcessing = false;
        this.processInterval = 30000; // 30 seconds
        this.maxRetries = 3;
        this.retryDelay = 60000; // 1 minute
        this.batchSize = 10;
        
        this.templates = new Map();
        this.initializeTemplates();
        this.setupTransporter();
        this.startQueueProcessor();
    }
    
    /**
     * Setup email transporter based on environment
     */
    setupTransporter() {
        const emailConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        };
        
        // Use different transporter for development
        if (process.env.NODE_ENV === 'development') {
            // Use Ethereal Email for testing
            this.createTestAccount();
        } else if (emailConfig.auth.user && emailConfig.auth.pass) {
            this.transporter = nodemailer.createTransporter(emailConfig);
            this.verifyConnection();
        } else {
            console.warn('Email service not configured - emails will be queued but not sent');
        }
    }
    
    /**
     * Create test account for development
     */
    async createTestAccount() {
        try {
            const testAccount = await nodemailer.createTestAccount();
            
            this.transporter = nodemailer.createTransporter({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            
            console.log('Email test account created:', testAccount.user);
        } catch (error) {
            console.error('Failed to create test email account:', error);
        }
    }
    
    /**
     * Verify email connection
     */
    async verifyConnection() {
        if (!this.transporter) return false;
        
        try {
            await this.transporter.verify();
            console.log('Email service connected and ready');
            return true;
        } catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }
    
    /**
     * Initialize email templates
     */
    initializeTemplates() {
        this.templates.set('welcome', {
            subject: 'Welcome to RetroBBS!',
            html: `
                <div style="font-family: 'Courier New', monospace; background: #000; color: #00ff00; padding: 20px;">
                    <h1 style="color: #00ff00; text-align: center;">
                        ╔══════════════════════════════════════════════════════════════════════════════╗
                        ║                            WELCOME TO RETROBBS                              ║
                        ╚══════════════════════════════════════════════════════════════════════════════╝
                    </h1>
                    
                    <p>Hello {{username}},</p>
                    
                    <p>Welcome to RetroBBS - where the past meets the future!</p>
                    
                    <p>Your account has been successfully created. You can now:</p>
                    <ul>
                        <li>→ Post messages on bulletin boards</li>
                        <li>→ Download retro software and files</li>
                        <li>→ Play classic door games</li>
                        <li>→ Chat with other vintage computing enthusiasts</li>
                        <li>→ Experience authentic 1980s BBS culture</li>
                    </ul>
                    
                    <p>To get started, log in to your account and explore the main menu.</p>
                    
                    <p>If you have any questions, feel free to contact the SYSOP.</p>
                    
                    <p>Welcome aboard!</p>
                    <p>The RetroBBS Team</p>
                    
                    <hr style="border-color: #00ff00;">
                    <p style="font-size: 12px; color: #888;">
                        This is an automated message from RetroBBS. Please do not reply to this email.
                    </p>
                </div>
            `,
            text: `
Welcome to RetroBBS!

Hello {{username}},

Welcome to RetroBBS - where the past meets the future!

Your account has been successfully created. You can now:
- Post messages on bulletin boards
- Download retro software and files  
- Play classic door games
- Chat with other vintage computing enthusiasts
- Experience authentic 1980s BBS culture

To get started, log in to your account and explore the main menu.

If you have any questions, feel free to contact the SYSOP.

Welcome aboard!
The RetroBBS Team
            `
        });
        
        this.templates.set('password_reset', {
            subject: 'Password Reset Request - RetroBBS',
            html: `
                <div style="font-family: 'Courier New', monospace; background: #000; color: #00ff00; padding: 20px;">
                    <h1 style="color: #00ff00; text-align: center;">
                        ╔══════════════════════════════════════════════════════════════════════════════╗
                        ║                         PASSWORD RESET REQUEST                              ║
                        ╚══════════════════════════════════════════════════════════════════════════════╝
                    </h1>
                    
                    <p>Hello,</p>
                    
                    <p>A password reset was requested for your RetroBBS account.</p>
                    
                    <p>To reset your password, click the link below:</p>
                    <p><a href="{{resetUrl}}" style="color: #00ff00;">{{resetUrl}}</a></p>
                    
                    <p>This link will expire in 1 hour for security reasons.</p>
                    
                    <p>If you did not request this password reset, please ignore this email.</p>
                    
                    <p>73,<br>The RetroBBS SYSOP</p>
                    
                    <hr style="border-color: #00ff00;">
                    <p style="font-size: 12px; color: #888;">
                        This is an automated message from RetroBBS. Please do not reply to this email.
                    </p>
                </div>
            `,
            text: `
Password Reset Request - RetroBBS

Hello,

A password reset was requested for your RetroBBS account.

To reset your password, visit this link:
{{resetUrl}}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email.

73,
The RetroBBS SYSOP
            `
        });
        
        this.templates.set('subscription_welcome', {
            subject: 'Welcome to {{planName}} - RetroBBS',
            html: `
                <div style="font-family: 'Courier New', monospace; background: #000; color: #00ff00; padding: 20px;">
                    <h1 style="color: #00ff00; text-align: center;">
                        ╔══════════════════════════════════════════════════════════════════════════════╗
                        ║                         SUBSCRIPTION ACTIVATED                              ║
                        ╚══════════════════════════════════════════════════════════════════════════════╝
                    </h1>
                    
                    <p>Hello {{username}},</p>
                    
                    <p>Congratulations! Your {{planName}} subscription has been activated.</p>
                    
                    <p>You now have access to:</p>
                    {{#if features}}
                    <ul>
                        {{#each features}}
                        <li>→ {{this}}</li>
                        {{/each}}
                    </ul>
                    {{/if}}
                    
                    <p>Your subscription details:</p>
                    <ul>
                        <li>Plan: {{planName}}</li>
                        <li>Price: ${{amount}}/month</li>
                        <li>Next billing: {{nextBilling}}</li>
                    </ul>
                    
                    <p>Thank you for supporting RetroBBS!</p>
                    
                    <p>73,<br>The RetroBBS Team</p>
                    
                    <hr style="border-color: #00ff00;">
                    <p style="font-size: 12px; color: #888;">
                        Manage your subscription at any time through your account settings.
                    </p>
                </div>
            `,
            text: `
Subscription Activated - RetroBBS

Hello {{username}},

Congratulations! Your {{planName}} subscription has been activated.

Your subscription details:
- Plan: {{planName}}
- Price: ${{amount}}/month  
- Next billing: {{nextBilling}}

Thank you for supporting RetroBBS!

73,
The RetroBBS Team
            `
        });
    }
    
    /**
     * Queue an email for sending
     */
    async queueEmail(to, templateName, variables = {}, priority = 3) {
        try {
            const template = this.templates.get(templateName);
            if (!template) {
                throw new Error(`Template '${templateName}' not found`);
            }
            
            // Process template variables
            const subject = this.processTemplate(template.subject, variables);
            const htmlBody = this.processTemplate(template.html, variables);
            const textBody = this.processTemplate(template.text, variables);
            
            // Validate email address
            if (!this.isValidEmail(to)) {
                throw new Error('Invalid email address');
            }
            
            // Insert into queue
            const sql = `
                INSERT INTO email_queue (to_email, subject, html_body, text_body, priority, scheduled_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            const result = await this.db.run(sql, [to, subject, htmlBody, textBody, priority]);
            
            console.log(`Email queued for ${to}: ${subject}`);
            return { success: true, emailId: result.lastID };
            
        } catch (error) {
            console.error('Failed to queue email:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Send welcome email
     */
    async sendWelcomeEmail(email, username) {
        return this.queueEmail(email, 'welcome', { username }, 1); // High priority
    }
    
    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, resetToken) {
        const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        return this.queueEmail(email, 'password_reset', { resetUrl }, 1); // High priority
    }
    
    /**
     * Send subscription confirmation email
     */
    async sendSubscriptionEmail(email, username, planData) {
        return this.queueEmail(email, 'subscription_welcome', {
            username,
            planName: planData.name,
            amount: planData.amount,
            nextBilling: planData.nextBilling,
            features: planData.features
        }, 2); // Medium priority
    }
    
    /**
     * Process queued emails
     */
    async processEmailQueue() {
        if (this.isProcessing || !this.transporter) return;
        
        this.isProcessing = true;
        
        try {
            // Get pending emails
            const sql = `
                SELECT * FROM email_queue 
                WHERE status = 'pending' 
                AND scheduled_at <= datetime('now')
                AND attempts < max_attempts
                ORDER BY priority ASC, scheduled_at ASC
                LIMIT ?
            `;
            
            const emails = await this.db.query(sql, [this.batchSize]);
            
            if (emails.length === 0) {
                this.isProcessing = false;
                return;
            }
            
            console.log(`Processing ${emails.length} queued emails`);
            
            // Process each email
            for (const email of emails) {
                await this.processEmail(email);
                
                // Small delay between emails to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error('Email queue processing failed:', error);
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Process individual email
     */
    async processEmail(emailRecord) {
        try {
            // Update attempt count
            await this.db.run(
                'UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?',
                [emailRecord.id]
            );
            
            // Prepare email options
            const mailOptions = {
                from: process.env.FROM_EMAIL || 'noreply@retrobbs.com',
                to: emailRecord.to_email,
                subject: emailRecord.subject,
                text: emailRecord.text_body,
                html: emailRecord.html_body
            };
            
            // Send email
            const info = await this.transporter.sendMail(mailOptions);
            
            // Mark as sent
            await this.db.run(
                'UPDATE email_queue SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['sent', emailRecord.id]
            );
            
            console.log(`Email sent to ${emailRecord.to_email}: ${emailRecord.subject}`);
            
            // Log test account preview URL
            if (process.env.NODE_ENV === 'development' && info.messageId) {
                console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
            }
            
        } catch (error) {
            console.error(`Failed to send email ${emailRecord.id}:`, error);
            
            // Update error status
            await this.db.run(
                'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?',
                ['failed', error.message, emailRecord.id]
            );
            
            // Schedule retry if attempts remaining
            if (emailRecord.attempts < emailRecord.max_attempts - 1) {
                const retryTime = new Date(Date.now() + this.retryDelay).toISOString();
                await this.db.run(
                    'UPDATE email_queue SET status = ?, scheduled_at = ? WHERE id = ?',
                    ['pending', retryTime, emailRecord.id]
                );
            }
        }
    }
    
    /**
     * Start the queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            this.processEmailQueue();
        }, this.processInterval);
        
        console.log('Email queue processor started');
    }
    
    /**
     * Process template variables
     */
    processTemplate(template, variables) {
        let processed = template;
        
        // Simple variable replacement {{variable}}
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processed = processed.replace(regex, value || '');
        }
        
        // Handle conditional blocks {{#if condition}}...{{/if}}
        processed = processed.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
            return variables[condition] ? content : '';
        });
        
        // Handle loops {{#each array}}...{{/each}}
        processed = processed.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, itemTemplate) => {
            const array = variables[arrayName];
            if (!Array.isArray(array)) return '';
            
            return array.map(item => {
                return itemTemplate.replace(/\{\{this\}\}/g, item);
            }).join('');
        });
        
        return processed;
    }
    
    /**
     * Validate email address
     */
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    /**
     * Get email queue statistics
     */
    async getQueueStats() {
        try {
            const stats = await Promise.all([
                this.db.get('SELECT COUNT(*) as count FROM email_queue WHERE status = "pending"'),
                this.db.get('SELECT COUNT(*) as count FROM email_queue WHERE status = "sent" AND sent_at >= date("now", "-1 day")'),
                this.db.get('SELECT COUNT(*) as count FROM email_queue WHERE status = "failed"'),
                this.db.get('SELECT COUNT(*) as count FROM email_queue')
            ]);
            
            return {
                pending: stats[0]?.count || 0,
                sentLast24h: stats[1]?.count || 0,
                failed: stats[2]?.count || 0,
                total: stats[3]?.count || 0
            };
        } catch (error) {
            console.error('Failed to get email queue stats:', error);
            return {};
        }
    }
    
    /**
     * Clean up old email records
     */
    async cleanupOldEmails() {
        try {
            const retentionDays = await this.db.getConfig('email_retention_days') || 30;
            
            const sql = `
                DELETE FROM email_queue 
                WHERE (status = 'sent' OR status = 'failed') 
                AND created_at < datetime('now', '-${retentionDays} days')
            `;
            
            const result = await this.db.run(sql);
            
            if (result.changes > 0) {
                console.log(`Cleaned up ${result.changes} old email records`);
            }
        } catch (error) {
            console.error('Failed to cleanup old emails:', error);
        }
    }
    
    /**
     * Retry failed emails
     */
    async retryFailedEmails() {
        try {
            const sql = `
                UPDATE email_queue 
                SET status = 'pending', attempts = 0, scheduled_at = CURRENT_TIMESTAMP
                WHERE status = 'failed' AND attempts < max_attempts
            `;
            
            const result = await this.db.run(sql);
            
            if (result.changes > 0) {
                console.log(`Queued ${result.changes} failed emails for retry`);
            }
        } catch (error) {
            console.error('Failed to retry failed emails:', error);
        }
    }
    
    /**
     * Add custom email template
     */
    addTemplate(name, template) {
        if (!template.subject || !template.html || !template.text) {
            throw new Error('Template must include subject, html, and text properties');
        }
        
        this.templates.set(name, template);
        console.log(`Email template '${name}' added`);
    }
    
    /**
     * Send immediate email (bypass queue)
     */
    async sendImmediate(to, subject, html, text) {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }
        
        const mailOptions = {
            from: process.env.FROM_EMAIL || 'noreply@retrobbs.com',
            to,
            subject,
            html,
            text
        };
        
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`Immediate email sent to ${to}: ${subject}`);
        
        return info;
    }
}

module.exports = EnhancedEmailService;