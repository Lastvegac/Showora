module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  testTimeout: 30000,
};
