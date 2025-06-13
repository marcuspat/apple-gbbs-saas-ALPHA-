# BBS Testing Guide

## Overview

This document describes the comprehensive testing strategy for the RetroBBS SaaS application. Our testing approach follows Test-Driven Development (TDD) principles with London School methodology.

## Test Structure

```
tests/
├── unit/              # Isolated component tests
├── integration/       # Component interaction tests
├── e2e/              # End-to-end workflow tests
├── fixtures/         # Test data and mocks
└── helpers/          # Test utilities

backend/tests/
├── unit/             # Backend unit tests
├── integration/      # Backend integration tests
└── e2e/             # Backend E2E tests

frontend/tests/
├── unit/            # Frontend unit tests
├── integration/     # Frontend integration tests
└── e2e/            # Frontend E2E tests
```

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test types
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests only

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Environment Setup

Tests require specific environment variables:

```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key-for-testing
STRIPE_SECRET_KEY=sk_test_fake_key_for_testing
OPENAI_API_KEY=sk-test-fake-openai-key-for-testing
```

## Test Coverage

### Coverage Requirements

- **Lines**: 90% minimum
- **Functions**: 90% minimum
- **Branches**: 90% minimum
- **Statements**: 90% minimum

### Coverage Reports

Coverage reports are generated in multiple formats:

- **HTML**: `coverage/lcov-report/index.html`
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info`
- **Text**: Console output during test runs

## Unit Tests

### Backend Unit Tests

#### Authentication Tests (`backend/tests/unit/auth.test.js`)

Tests user registration, login, password reset, and JWT token handling:

```bash
# Run authentication tests
npm test -- backend/tests/unit/auth.test.js
```

**Key Test Cases:**
- User registration with validation
- Login with various scenarios
- Password reset workflow
- JWT token verification
- Error handling

#### Message Board Tests (`backend/tests/unit/boards.test.js`)

Tests message board CRUD operations:

```bash
# Run board tests
npm test -- backend/tests/unit/boards.test.js
```

**Key Test Cases:**
- Fetch boards with message counts
- Message posting and retrieval
- Pagination handling
- Input validation and sanitization

#### File Management Tests (`backend/tests/unit/files.test.js`)

Tests file upload, download, and management:

```bash
# Run file tests
npm test -- backend/tests/unit/files.test.js
```

**Key Test Cases:**
- File upload with validation
- File download and tracking
- Security checks
- Storage management

#### WebSocket Tests (`backend/tests/unit/websocket.test.js`)

Tests real-time communication:

```bash
# Run WebSocket tests
npm test -- backend/tests/unit/websocket.test.js
```

**Key Test Cases:**
- Connection management
- Chat message handling
- Analytics tracking
- Error handling

### Frontend Unit Tests

#### BBS Application Tests (`frontend/tests/unit/bbs.test.js`)

Tests frontend application logic:

```bash
# Run frontend tests
npm test -- frontend/tests/unit/bbs.test.js
```

**Key Test Cases:**
- Application initialization
- Authentication flow
- WebSocket communication
- API integration
- Error handling

## Integration Tests

### API Integration Tests (`backend/tests/integration/api.test.js`)

Tests complete API workflows with real database:

```bash
# Run integration tests
npm run test:integration
```

**Key Test Cases:**
- Complete user registration and login flow
- Message board operations
- File upload and download cycle
- WebSocket communication
- Analytics tracking

## End-to-End Tests

### BBS Workflow Tests (`tests/e2e/bbs-workflow.test.js`)

Tests complete user workflows in a real environment:

```bash
# Run E2E tests
npm run test:e2e
```

**Key Test Cases:**
- Complete user lifecycle
- Password reset workflow
- Real-time chat sessions
- File management workflows
- Door games gameplay
- System analytics
- Concurrent user handling

## Test Data and Fixtures

### User Fixtures (`tests/fixtures/users.js`)

Provides test user data with various scenarios:

- Valid registration data
- Invalid input scenarios
- Different user roles and permissions
- Mock JWT tokens

### Board Fixtures (`tests/fixtures/boards.js`)

Provides test message board data:

- Different board configurations
- Message data with edge cases
- API request/response data

### File Fixtures (`tests/fixtures/files.js`)

Provides test file data:

- Various file types and sizes
- Upload scenarios
- File area configurations

## Mocking and Test Doubles

### Database Mocking

Tests use in-memory SQLite database for isolation:

```javascript
const testDb = new sqlite3.Database(':memory:');
```

### External Service Mocking

- **JWT**: Mocked for consistent token generation
- **bcrypt**: Mocked for predictable password hashing
- **WebSocket**: Custom mock implementation
- **File System**: Mocked for upload/download tests

### API Mocking

Frontend tests mock API calls using Jest:

```javascript
global.fetch = jest.fn();
fetch.mockResolvedValueOnce({
  ok: true,
  json: async () => mockData
});
```

## Test Utilities

### Global Test Utilities (`tests/helpers/setup.js`)

Provides common test functionality:

- Database setup and teardown
- Test user creation
- Data cleanup utilities
- Mock configurations

### Custom Matchers

Custom Jest matchers for BBS-specific assertions:

```javascript
expect(response).toBeValidBBSResponse();
expect(message).toBeValidChatMessage();
expect(user).toBeAuthenticatedUser();
```

## Debugging Tests

### Running Individual Tests

```bash
# Run specific test file
npm test -- auth.test.js

# Run specific test case
npm test -- --testNamePattern="should register user"

# Run tests in debug mode
npm test -- --verbose

# Run tests with additional logging
DEBUG=* npm test
```

### Test Debugging Tips

1. **Use `console.log`** for debugging test data
2. **Use `describe.only`** to focus on specific test suites
3. **Use `test.only`** to run individual tests
4. **Check mock call history** with `expect(mockFn).toHaveBeenCalledWith(...)`

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Push to main/develop branches
- Pull requests
- Scheduled nightly runs

### CI Pipeline Stages

1. **Lint and Type Check**: Code quality validation
2. **Unit Tests**: Fast isolated tests
3. **Integration Tests**: Component interaction tests
4. **E2E Tests**: Full workflow validation
5. **Coverage Analysis**: Ensure coverage thresholds
6. **Security Audit**: Dependency vulnerability scanning

### Coverage Reporting

Coverage reports are uploaded to Codecov for tracking:

- Per-commit coverage tracking
- Coverage diff on pull requests
- Historical coverage trends

## Test Maintenance

### Adding New Tests

1. **Follow TDD**: Write failing tests first
2. **Use Fixtures**: Leverage existing test data
3. **Mock External Dependencies**: Keep tests isolated
4. **Test Edge Cases**: Include error scenarios
5. **Update Documentation**: Keep this guide current

### Test Performance

- **Unit Tests**: Should complete in <100ms each
- **Integration Tests**: Should complete in <1s each
- **E2E Tests**: Should complete in <10s each
- **Full Suite**: Should complete in <5 minutes

### Test Data Management

- **Use Factories**: For generating test data
- **Clean Between Tests**: Ensure test isolation
- **Avoid Hardcoded Values**: Use fixtures and generators
- **Test with Real Data**: When possible, mirror production

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is properly initialized
   - Check for concurrent test execution issues

2. **WebSocket Test Failures**
   - Verify mock WebSocket implementation
   - Check for timing issues in async tests

3. **File Upload Test Issues**
   - Ensure uploads directory exists
   - Check file permissions in test environment

4. **Coverage Reporting Problems**
   - Verify Jest configuration
   - Check that all source files are included

### Environment Issues

1. **Node Version Compatibility**
   - Use Node.js 18.x for consistency
   - Check package.json engines field

2. **Dependency Conflicts**
   - Run `npm audit` for security issues
   - Use `npm ci` for clean installs

3. **Platform Differences**
   - Test on multiple operating systems
   - Use consistent line endings

## Best Practices

### Test Writing

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Tests should be self-documenting
3. **Test One Thing**: Each test should have a single purpose
4. **Use Good Fixtures**: Realistic but minimal test data
5. **Mock Strategically**: Mock dependencies, not the system under test

### Test Organization

1. **Group Related Tests**: Use describe blocks effectively
2. **Order Tests Logically**: From simple to complex
3. **Use Setup/Teardown**: Keep tests clean and isolated
4. **Share Common Code**: Use helper functions and fixtures
5. **Document Complex Tests**: Add comments for clarity

### Performance

1. **Run Tests in Parallel**: Use Jest's parallel execution
2. **Use In-Memory Databases**: For faster test execution
3. **Mock Heavy Operations**: File I/O, network calls, etc.
4. **Profile Slow Tests**: Identify and optimize bottlenecks
5. **Use Test Timeouts**: Prevent hanging tests

## Security Testing

### Security Test Cases

1. **Input Validation**: SQL injection, XSS prevention
2. **Authentication**: Token handling, session management
3. **Authorization**: Permission checking, role-based access
4. **File Upload Security**: File type validation, size limits
5. **Rate Limiting**: API abuse prevention

### Security Test Tools

- **npm audit**: Dependency vulnerability scanning
- **ESLint Security**: Static code analysis
- **OWASP ZAP**: Dynamic application security testing
- **Snyk**: Continuous security monitoring

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [WebSocket Testing](https://github.com/websockets/ws)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [London School TDD](https://github.com/testdouble/contributing-tests/wiki/London-school-TDD)