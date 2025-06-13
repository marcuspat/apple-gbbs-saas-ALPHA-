const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        this.fromEmail = process.env.FROM_EMAIL || 'noreply@retrobbs.com';
        this.bbsName = process.env.BBS_NAME || 'RetroBBS';
    }
    
    async sendWelcomeEmail(userEmail, username) {
        const mailOptions = {
            from: `${this.bbsName} <${this.fromEmail}>`,
            to: userEmail,
            subject: `Welcome to ${this.bbsName}!`,
            text: this.getWelcomeText(username),
            html: this.getWelcomeHtml(username)
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Welcome email sent to ${userEmail}`);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
        }
    }
    
    async sendPasswordResetEmail(userEmail, resetToken) {
        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: `${this.bbsName} <${this.fromEmail}>`,
            to: userEmail,
            subject: `Password Reset Request - ${this.bbsName}`,
            text: `Reset your password by visiting: ${resetUrl}`,
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Password reset email sent to ${userEmail}`);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
        }
    }
    
    async sendNewMessageNotification(userEmail, senderUsername, subject) {
        const mailOptions = {
            from: `${this.bbsName} <${this.fromEmail}>`,
            to: userEmail,
            subject: `New message from ${senderUsername} on ${this.bbsName}`,
            text: `You have a new message titled "${subject}" from ${senderUsername}. Login to read it.`,
            html: `
                <h3>New Message on ${this.bbsName}</h3>
                <p><strong>From:</strong> ${senderUsername}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><a href="${process.env.APP_URL}">Login to read message</a></p>
            `
        };
        
        try {
            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Failed to send message notification:', error);
        }
    }
    
    getWelcomeText(username) {
        return `
Welcome to ${this.bbsName}, ${username}!

You've successfully joined our retro BBS community.

Getting Started:
- Explore our message boards
- Download files from our archives
- Play classic door games
- Chat with other users

For help, type 'H' at any menu.

Happy BBSing!
The ${this.bbsName} Team
        `;
    }
    
    getWelcomeHtml(username) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Courier New', monospace; background: #000; color: #0f0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border: 2px solid #0f0; padding: 10px; text-align: center; }
        .content { margin-top: 20px; }
        pre { color: #0f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${this.bbsName}</h1>
        </div>
        <div class="content">
            <p>Greetings, ${username}!</p>
            <p>You've successfully joined our retro BBS community.</p>
            <h3>Getting Started:</h3>
            <ul>
                <li>Explore our message boards</li>
                <li>Download files from our archives</li>
                <li>Play classic door games</li>
                <li>Chat with other users</li>
            </ul>
            <p>For help, type 'H' at any menu.</p>
            <pre>
╔══════════════════════════════════════╗
║     Happy BBSing!                    ║
║     The ${this.bbsName.padEnd(28)} Team    ║
╚══════════════════════════════════════╝
            </pre>
        </div>
    </div>
</body>
</html>
        `;
    }
}

module.exports = EmailService;</content>