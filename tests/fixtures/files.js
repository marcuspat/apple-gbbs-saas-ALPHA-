// Test file upload fixtures

const TEST_FILES = {
  document: {
    filename: 'test-doc.txt',
    original_name: 'Test Document.txt',
    file_size: 1024,
    mime_type: 'text/plain',
    area_id: 1,
    uploaded_by: 1,
    description: 'Test document file',
    download_count: 0
  },
  
  image: {
    filename: 'test-image.jpg',
    original_name: 'Test Image.jpg',
    file_size: 204800,
    mime_type: 'image/jpeg',
    area_id: 2,
    uploaded_by: 2,
    description: 'Test image file',
    download_count: 5
  },
  
  disk: {
    filename: 'apple-disk.dsk',
    original_name: 'Apple II Disk.dsk',
    file_size: 143360,
    mime_type: 'application/octet-stream',
    area_id: 3,
    uploaded_by: 1,
    description: 'Apple II disk image',
    download_count: 15
  },
  
  large: {
    filename: 'large-file.bin',
    original_name: 'Large File.bin',
    file_size: 10485760, // 10MB
    mime_type: 'application/octet-stream',
    area_id: 1,
    uploaded_by: 1,
    description: 'Large binary file',
    download_count: 2
  }
};

// File upload test data
const UPLOAD_TEST_DATA = {
  validText: {
    fieldname: 'file',
    originalname: 'test.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    buffer: Buffer.from('This is test file content'),
    size: 25
  },
  
  validImage: {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-jpeg-data'),
    size: 1024
  },
  
  tooLarge: {
    fieldname: 'file',
    originalname: 'large.bin',
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    buffer: Buffer.alloc(11 * 1024 * 1024), // 11MB
    size: 11 * 1024 * 1024
  },
  
  invalidType: {
    fieldname: 'file',
    originalname: 'script.exe',
    encoding: '7bit',
    mimetype: 'application/x-msdownload',
    buffer: Buffer.from('fake-exe-data'),
    size: 1024
  }
};

// File areas for organization
const FILE_AREAS = {
  general: { id: 1, name: 'General Files' },
  images: { id: 2, name: 'Images' },
  software: { id: 3, name: 'Software' },
  documents: { id: 4, name: 'Documents' }
};

// Mock file system operations
const MOCK_FILE_OPERATIONS = {
  existingFile: {
    path: '/uploads/existing-file.txt',
    exists: true,
    content: 'File content'
  },
  
  nonExistentFile: {
    path: '/uploads/missing-file.txt',
    exists: false
  },
  
  corruptedFile: {
    path: '/uploads/corrupted-file.bin',
    exists: true,
    corrupted: true
  }
};

module.exports = {
  TEST_FILES,
  UPLOAD_TEST_DATA,
  FILE_AREAS,
  MOCK_FILE_OPERATIONS
};