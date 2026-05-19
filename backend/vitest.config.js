'use strict';

module.exports = {
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 30000, // mongodb-memory-server cold start can be slow
    hookTimeout: 60000,
  },
};
