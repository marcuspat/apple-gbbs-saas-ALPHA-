// Test message board fixtures

const TEST_BOARDS = {
  general: {
    name: 'General Discussion',
    description: 'General chat and discussions',
    is_active: 1
  },
  
  retro: {
    name: 'Retro Computing',
    description: 'Talk about vintage computers and systems',
    is_active: 1
  },
  
  programming: {
    name: 'Programming',
    description: 'Programming discussions and help',
    is_active: 1
  },
  
  inactive: {
    name: 'Inactive Board',
    description: 'This board is inactive',
    is_active: 0
  }
};

const TEST_MESSAGES = {
  welcome: {
    board_id: 1,
    user_id: 1,
    subject: 'Welcome to the BBS!',
    content: 'Welcome everyone to RetroBBS! Please follow the community guidelines.'
  },
  
  help: {
    board_id: 1,
    user_id: 1,
    subject: 'Need help with Apple II?',
    content: 'Looking for assistance with my Apple IIe setup. Any experts here?'
  },
  
  programming: {
    board_id: 4,
    user_id: 2,
    subject: 'JavaScript question',
    content: 'How do I implement async/await properly in Node.js?'
  },
  
  long: {
    board_id: 1,
    user_id: 1,
    subject: 'Long message test',
    content: 'This is a very long message that tests the system\'s ability to handle large amounts of text. '.repeat(100)
  }
};

// Board API test data
const BOARD_API_DATA = {
  validPost: {
    subject: 'Test Post',
    content: 'This is a test message post'
  },
  
  emptySubject: {
    subject: '',
    content: 'This message has no subject'
  },
  
  emptyContent: {
    subject: 'Empty Content Test',
    content: ''
  },
  
  longSubject: {
    subject: 'This is a very long subject line that exceeds normal limits and should be handled appropriately by the system',
    content: 'Normal content'
  },
  
  specialCharacters: {
    subject: 'Special chars: <>&"\'',
    content: 'Content with special characters: <script>alert("test")</script>'
  }
};

// Message query parameters
const MESSAGE_QUERY_PARAMS = {
  default: {},
  withLimit: { limit: 10 },
  withOffset: { offset: 5 },
  withBoth: { limit: 20, offset: 10 },
  invalidLimit: { limit: -1 },
  stringLimit: { limit: 'invalid' }
};

module.exports = {
  TEST_BOARDS,
  TEST_MESSAGES,
  BOARD_API_DATA,
  MESSAGE_QUERY_PARAMS
};