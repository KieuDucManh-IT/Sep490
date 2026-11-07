module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  passWithNoTests: true,
  moduleDirectories: ['<rootDir>/node_modules', 'node_modules', '<rootDir>/src'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/src/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['react-app'] }]
  },
  resetMocks: true
};
