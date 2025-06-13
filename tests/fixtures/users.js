// Test user fixtures
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Test users with hashed passwords
const TEST_USERS = {
  admin: {
    username: 'SYSOP',
    email: 'admin@test.com',
    password: 'admin123',
    subscription_tier: 'enterprise',
    is_active: 1
  },
  
  regular: {
    username: 'TESTUSER',
    email: 'user@test.com',
    password: 'password123',
    subscription_tier: 'free',
    is_active: 1
  },
  
  premium: {
    username: 'PREMIUM',
    email: 'premium@test.com',
    password: 'premium123',
    subscription_tier: 'premium',
    is_active: 1
  },
  
  inactive: {
    username: 'INACTIVE',
    email: 'inactive@test.com',
    password: 'inactive123',
    subscription_tier: 'free',
    is_active: 0
  }
};

// Generate password hashes for test users
async function hashTestPasswords() {
  const hashedUsers = {};
  
  for (const [key, user] of Object.entries(TEST_USERS)) {
    const password_hash = await bcrypt.hash(user.password, SALT_ROUNDS);
    hashedUsers[key] = {
      ...user,
      password_hash
    };
    delete hashedUsers[key].password; // Remove plain text password
  }
  
  return hashedUsers;
}

// Mock JWT tokens for testing
const TEST_TOKENS = {
  valid: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJTWVNPUCIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature',
  expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJTWVNPUCIsImlhdCI6MTUwMDAwMDAwMCwiZXhwIjoxNTAwMDAwMDAxfQ.expired-signature',
  invalid: 'invalid.jwt.token'
};

// User registration test data
const REGISTRATION_DATA = {
  valid: {
    username: 'NEWUSER',
    email: 'newuser@test.com',
    password: 'newpassword123'
  },
  
  invalidEmail: {
    username: 'TESTUSER2',
    email: 'invalid-email',
    password: 'password123'
  },
  
  weakPassword: {
    username: 'TESTUSER3',
    email: 'user3@test.com',
    password: '123'
  },
  
  duplicate: {
    username: 'TESTUSER', // Already exists
    email: 'duplicate@test.com',
    password: 'password123'
  }
};

// Login test data
const LOGIN_DATA = {
  valid: {
    username: 'TESTUSER',
    password: 'password123'
  },
  
  invalidPassword: {
    username: 'TESTUSER',
    password: 'wrongpassword'
  },
  
  nonexistentUser: {
    username: 'NONEXISTENT',
    password: 'password123'
  },
  
  inactiveUser: {
    username: 'INACTIVE',
    password: 'inactive123'
  }
};

module.exports = {
  TEST_USERS,
  TEST_TOKENS,
  REGISTRATION_DATA,
  LOGIN_DATA,
  hashTestPasswords
};