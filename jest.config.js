module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 30000,
  maxWorkers: 1,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  clearMocks: true,
  restoreMocks: true
};
