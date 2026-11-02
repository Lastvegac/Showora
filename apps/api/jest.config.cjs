module.exports = {
  watchman: false,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^@showora/shared-validation$': '<rootDir>/../../packages/shared-validation/src',
  },
};
