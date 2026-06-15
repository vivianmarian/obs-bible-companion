/**
 * Jest configuration for project-a.
 * Uses jsdom environment and supports ES6 modules via the experimental VM modules flag.
 * Run from repo root with:
 *   node --experimental-vm-modules node_modules\jest\bin\jest.js --rootDir project-a --config project-a\jest.config.js --coverage
 */

export default {
  testEnvironment: 'jsdom',
  transform: {},
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
    },
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/js/**/*.js',
    // Excluded: browser-only modules that depend on fetch() or WebSocket.
    // These are covered by Sprint 5 end-to-end testing in OBS.
    '!src/js/companion_bridge.js',
    '!src/js/translation.js',
  ],
  testMatch: ['**/__tests__/**/*.test.js'],
}
