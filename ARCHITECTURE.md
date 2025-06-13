# Apple GBBS SaaS - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Improvements](#architecture-improvements)
3. [Database Design](#database-design)
4. [Service Architecture](#service-architecture)
5. [Performance Optimizations](#performance-optimizations)
6. [Security Features](#security-features)
7. [Deployment Architecture](#deployment-architecture)
8. [Development Guidelines](#development-guidelines)

## System Overview

### Project Description
Apple GBBS SaaS is a modern web-based recreation of the classic Apple Golden Gate BBS (GBBS) experience from the 1980s. It combines authentic retro computing nostalgia with modern SaaS business models and infrastructure.

### Core Features
- **Authentic BBS Experience**: Green phosphor terminal interface, classic command structure
- **Multi-Board Messaging**: Traditional bulletin board message system
- **File Sharing**: Upload/download areas for retro software and files
- **Door Games**: Interactive text-based games (Guess the Number, Star Trek, Hangman)
- **Real-time Chat**: WebSocket-powered chat rooms
- **AI Integration**: OpenRouter/Qwen 2.5 for welcome messages and ASCII art
- **Subscription Tiers**: Hobbyist ($9/mo), Community ($29/mo), Enterprise ($99/mo)
- **Payment Processing**: Stripe integration with webhooks

### Technology Stack
- **Frontend**: Vanilla JavaScript, CSS Grid, WebSocket
- **Backend**: Node.js, Express.js, SQLite
- **Real-time**: WebSocket Server
- **AI**: OpenRouter API (Qwen 2.5 models)
- **Payment**: Stripe API
- **Authentication**: JWT with bcrypt
- **Email**: Nodemailer with queue system

## Architecture Improvements

### Problems Identified and Fixed

#### 1. Database Issues
**Before**: 
- No indexes on frequently queried columns
- Missing foreign key constraints
- No connection pooling
- Poor query optimization

**After**:
- Comprehensive indexing strategy for all tables
- Foreign key constraints enabled
- Connection pooling with retry logic
- Query optimization with caching
- Database views for complex queries

#### 2. Service Architecture Issues
**Before**:
- Monolithic server.js file (650+ lines)
- Tight coupling between services
- No dependency injection
- Poor error handling

**After**:
- Modular service architecture with clear separation of concerns
- Dependency injection pattern
- Enhanced error handling and retry logic
- Service-specific optimizations

#### 3. Performance Issues
**Before**:
- No caching layer
- Synchronous operations
- No rate limiting
- Memory leaks in chat system

**After**:
- Multi-layer caching (AI responses, database queries, computed data)
- Asynchronous operations with proper error handling
- Rate limiting across all services
- Persistent chat with cleanup mechanisms

#### 4. Scalability Issues
**Before**:
- In-memory chat storage
- No session management
- Single-threaded operations
- No health monitoring

**After**:
- Database-backed chat persistence
- Session management with cleanup
- Connection pooling
- Health monitoring and metrics

## Database Design

### Optimized Schema

```sql
-- Core Tables (Existing, Enhanced with Indexes)
users (id, username, email, password_hash, subscription_tier, stripe_customer_id, ...)
messages (id, board_id, user_id, subject, content, created_at, ...)
files (id, filename, uploaded_by, area_id, download_count, ...)
boards (id, name, description, is_active, ...)

-- New Performance Tables
ai_cache (id, cache_key, response, model, token_count, expires_at)
system_config (id, config_key, config_value, config_type, description)
email_queue (id, to_email, subject, html_body, status, priority, ...)
chat_rooms (id, name, description, max_users, is_private, ...)
chat_messages (id, room_id, user_id, message, message_type, ...)
user_sessions (id, user_id, session_token, expires_at, ...)
rate_limits (id, identifier, endpoint, request_count, window_start)

-- Enhanced Tables for Features
password_reset_tokens (id, user_id, token, expires_at, used)
door_games (id, name, description, command, active, category)
game_sessions (id, user_id, game_id, session_data, status, ...)
subscriptions (id, user_id, stripe_subscription_id, plan_id, ...)
payments (id, user_id, amount, currency, status, ...)
analytics (id, user_id, action, menu, session_id, ...)
```

### Performance Views
```sql
-- Optimized views for common queries
active_users        -- Users with active subscriptions
board_stats         -- Message counts and activity per board
user_activity_summary -- User engagement metrics
```

### Indexing Strategy
- Primary indexes on all foreign keys
- Composite indexes on frequently queried combinations
- Partial indexes for active records only
- Text indexes for search functionality

## Service Architecture

### Service Layer Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Express.js)                   │
├─────────────────────────────────────────────────────────────────┤
│                        Service Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Database    │ │ Enhanced    │ │ Enhanced    │ │ Performance ││
│  │ Service     │ │ AI Service  │ │ Chat        │ │ Service     ││
│  │             │ │             │ │ Service     │ │             ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Enhanced    │ │ Payment     │ │ Session     │ │ Analytics   ││
│  │ Email       │ │ Service     │ │ Manager     │ │ Service     ││
│  │ Service     │ │             │ │             │ │             ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   SQLite    │ │   Redis     │ │   File      │ │  External   ││
│  │  Database   │ │   Cache     │ │  Storage    │ │    APIs     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Enhanced Services

#### DatabaseService
- Connection pooling and retry logic
- Query optimization with caching
- Transaction support
- Automatic cleanup routines
- Configuration management

#### EnhancedAIService  
- Multi-tier model support based on subscription
- Response caching with configurable TTL
- Rate limiting per user
- Content moderation
- Fallback responses for service failures

#### EnhancedChatService
- Persistent message storage
- Real-time user presence
- Rate limiting and spam protection
- Message moderation
- Room management

#### EnhancedEmailService
- Queue-based email processing
- Template system with variable substitution
- Retry logic for failed sends
- Development mode with test accounts
- Batch processing

#### PerformanceService
- Multi-layer caching strategy
- Request/response timing
- Memory and resource monitoring
- Query optimization helpers
- Health check endpoints

## Performance Optimizations

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      Caching Layers                             │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Application │ │ Database    │ │ External    │              │
│  │ Cache       │ │ Query Cache │ │ API Cache   │              │
│  │             │ │             │ │             │              │
│  │ • Session   │ │ • Frequent  │ │ • AI        │              │
│  │ • Config    │ │   Queries   │ │   Responses │              │
│  │ • User Data │ │ • Computed  │ │ • Stripe    │              │
│  │             │ │   Results   │ │   Data      │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Optimization Techniques

1. **Database Optimizations**
   - Prepared statements with parameter binding
   - Batch operations for bulk inserts
   - Connection pooling
   - Query result caching
   - Database maintenance automation

2. **Memory Management**
   - LRU cache eviction
   - Configurable cache size limits
   - Memory usage monitoring
   - Automatic cleanup routines

3. **Network Optimizations**
   - Response compression
   - WebSocket connection pooling
   - Rate limiting to prevent abuse
   - Connection timeout management

4. **Code Optimizations**
   - Asynchronous operations
   - Error handling with circuit breakers
   - Resource pooling
   - Lazy loading patterns

## Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Password strength requirements
- Account lockout after failed attempts
- Session management with automatic expiration

### Data Protection
- Password hashing with bcrypt (10 rounds)
- SQL injection prevention via prepared statements
- XSS protection in chat messages
- CSRF protection on state-changing operations

### API Security
- Rate limiting per endpoint and user
- Request validation and sanitization
- Error message sanitization
- Secure headers implementation

### Content Security
- AI-powered content moderation
- File upload restrictions and scanning
- Message length limits
- Spam detection and prevention

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
├─────────────────────────────────────────────────────────────────┤
│                      Web Servers                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Node.js   │ │   Node.js   │ │   Node.js   │              │
│  │  Instance   │ │  Instance   │ │  Instance   │              │
│  │     #1      │ │     #2      │ │     #3      │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                      Data Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  Database   │ │   Redis     │ │   File      │              │
│  │   Cluster   │ │   Cache     │ │  Storage    │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                    External Services                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  OpenRouter │ │   Stripe    │ │   Email     │              │
│  │     AI      │ │  Payments   │ │  Service    │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Scalability Considerations
- Horizontal scaling via load balancer
- Database read replicas for performance
- Redis cluster for distributed caching
- CDN for static asset delivery
- Auto-scaling based on demand

### Monitoring & Observability
- Application performance monitoring
- Database query performance tracking
- Error rate and response time alerts
- Resource utilization monitoring
- Business metrics dashboard

## Development Guidelines

### Code Organization
```
backend/
├── services/           # Service layer
│   ├── database-service.js
│   ├── enhanced-ai-service.js
│   ├── enhanced-chat-service.js
│   ├── enhanced-email-service.js
│   └── performance-service.js
├── middleware/         # Express middleware
├── routes/            # API route handlers
├── models/            # Data models
├── utils/             # Utility functions
└── config/            # Configuration files
```

### Best Practices

1. **Service Design**
   - Single responsibility principle
   - Dependency injection
   - Error handling with proper logging
   - Async/await for better readability

2. **Database Interactions**
   - Use prepared statements
   - Implement proper error handling
   - Cache frequently accessed data
   - Use transactions for multi-step operations

3. **API Design**
   - RESTful endpoints
   - Consistent error responses
   - Request validation
   - Rate limiting

4. **Testing Strategy**
   - Unit tests for service logic
   - Integration tests for API endpoints
   - Performance tests for optimization verification
   - Security tests for vulnerability scanning

### Configuration Management
- Environment-based configuration
- Secure secret management
- Feature flags for gradual rollouts
- Configuration validation on startup

### Deployment Process
1. Code review and testing
2. Staging environment validation
3. Database migration execution
4. Zero-downtime deployment
5. Post-deployment monitoring

This architecture provides a solid foundation for scaling the Apple GBBS SaaS platform while maintaining the authentic retro computing experience that users expect.