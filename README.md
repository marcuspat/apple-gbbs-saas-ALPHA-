# RetroBBS SaaS - Apple GBBS Experience

A modern SaaS platform that recreates the authentic Apple GBBS (Golden Gate BBS) terminal experience in a web browser, complete with AI-powered features and subscription monetization.

## 🎯 Features

### Core BBS Experience
- **Authentic Apple II Terminal Interface** - Green phosphor screen with retro styling
- **Classic BBS Navigation** - Menu-driven interface with traditional commands
- **Message Boards** - Multi-board discussion system
- **File Areas** - Upload/download with classic BBS file listings
- **Real-time Chat** - Multi-user chat with WebSocket support
- **Door Games** - Retro-style text games (coming soon)
- **User Profiles** - Classic BBS user stats and information

### AI-Powered Features (Qwen 2.5 72B via OpenRouter)
- **Smart Welcome Messages** - AI-generated BBS welcome screens
- **Intelligent Responses** - AI-powered message board responses
- **Dynamic ASCII Art** - AI-created ASCII graphics
- **Door Game Generation** - AI-created text-based games
- **Help System** - AI-powered user assistance
- **Content Moderation** - Automated content filtering

### SaaS Business Model
- **Tiered Subscriptions**:
  - **Hobbyist** ($9/month) - Personal BBS, 50 users, basic features
  - **Community** ($29/month) - Enhanced BBS, 250 users, AI features
  - **Enterprise** ($99/month) - Multi-tenant, unlimited users, full features
- **Stripe Integration** - Payment processing and billing
- **Usage Analytics** - Track engagement and monetization
- **Customer Portal** - Self-service billing management

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- OpenRouter API key (for AI features)
- Stripe account (for payments)

### Installation

1. **Clone and Setup**:
   ```bash
   git clone [repository-url]
   cd apple-gbbs-saas
   chmod +x start.sh
   ```

2. **Configure Environment**:
   ```bash
   # Copy and edit environment variables
   cp .env.example .env
   
   # Required for AI features
   export OPENROUTER_API_KEY="your-openrouter-key"
   
   # Required for payments
   export STRIPE_SECRET_KEY="sk_test_your-stripe-key"
   export STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"
   ```

3. **Start the Application**:
   ```bash
   ./run.sh
   ```
   
   Or manually:
   ```bash
   npm install express cors
   node server.js
   ```

4. **Access the BBS**:
   - Open http://localhost:3000
   - Use guest access or create an account
   - Experience the authentic Apple GBBS interface!

## 🏗️ Architecture

### Frontend
- **Pure JavaScript** - No frameworks for authentic feel
- **CSS3** - Retro terminal styling with green phosphor effects
- **WebSockets** - Real-time communication
- **Responsive Design** - Works on mobile while maintaining retro aesthetic

### Backend
- **Node.js + Express** - RESTful API server
- **SQLite** - Embedded database for easy deployment
- **WebSocket Server** - Real-time features
- **JWT Authentication** - Secure user sessions
- **Rate Limiting** - API protection

### Services
- **AI Service** - OpenRouter/Qwen 2.5 72B integration
- **Payment Service** - Stripe subscription management
- **Multi-tenant** - Support for multiple BBS instances

## 📊 Business Model

### Revenue Streams
- **Monthly Subscriptions** - Tiered pricing model
- **Add-on Services** - Extra storage, custom themes
- **Enterprise Solutions** - White-label deployments
- **Professional Services** - Setup and customization

### Target Market
- **Retro Computing Enthusiasts** - Nostalgia-driven users
- **Online Communities** - Unique communication platforms
- **Educational Institutions** - Computing history teaching
- **Gaming Communities** - Retro/indie game players

### Projected Growth
- **Year 1 Target**: 1,000 users, $8,500 MRR
- **Break-even**: Month 8-10
- **Scale**: Multi-tenant hosting, API marketplace

## 🛠️ Development

### Project Structure
```
apple-gbbs-saas/
├── frontend/           # Web interface
│   ├── index.html     # Main terminal interface
│   ├── styles.css     # Retro BBS styling
│   ├── terminal.js    # Terminal emulation
│   └── bbs.js        # BBS application logic
├── backend/           # Server code
│   ├── server.js      # Main Express server
│   ├── ai-service.js  # OpenRouter AI integration
│   └── payment-service.js # Stripe integration
├── docs/              # Documentation
└── scripts/           # Deployment scripts
```

### API Endpoints
```
POST /api/auth/login           # User authentication
GET  /api/boards              # Message boards
POST /api/boards/:id/messages # Post message
GET  /api/files/:area         # File listings
POST /api/ai/welcome          # AI welcome generation
POST /api/checkout            # Stripe checkout
GET  /api/billing/portal      # Customer portal
```

### Environment Variables
```bash
# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your-jwt-secret

# AI Service (OpenRouter)
OPENROUTER_API_KEY=your-key
APP_URL=http://localhost:3000

# Payment Service (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 🔧 Customization

### Themes
- Modify `frontend/styles.css` for visual changes
- AI can generate custom welcome screens
- Support for multiple color schemes (green, amber, white)

### AI Features
- Configure models in `ai-service.js`
- Adjust prompts for different BBS personalities
- Add new AI-powered features

### Payment Plans
- Modify plans in `payment-service.js`
- Create Stripe products and prices
- Adjust feature limits per tier

## 📈 Analytics & Monitoring

### Built-in Analytics
- User session tracking
- Command usage statistics
- Revenue metrics
- System performance

### Third-party Integration
- Stripe Dashboard for payments
- OpenRouter usage tracking
- Custom analytics endpoints

## 🚢 Deployment

### Production Setup
```bash
# Environment
export NODE_ENV=production
export PORT=3000

# Security
export JWT_SECRET="strong-production-secret"

# Services
export OPENROUTER_API_KEY="prod-key"
export STRIPE_SECRET_KEY="sk_live_..."

# Start
npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Hosting Options
- **Railway** - Easy Node.js deployment
- **Heroku** - Traditional PaaS
- **DigitalOcean** - VPS with more control
- **AWS/GCP** - Enterprise scalability

## 🔐 Security

### Features
- JWT-based authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS protection
- Helmet.js security headers

### Best Practices
- Regular dependency updates
- Environment variable secrets
- HTTPS in production
- Database query parameterization

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Contact**: support@retrobbs.com
- **Community**: Join our BBS at demo.retrobbs.com

---

**RetroBBS SaaS** - *Where the past meets the future of online communities* 🖥️✨
