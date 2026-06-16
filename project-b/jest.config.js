/**
 * jest.config.js for project-b
 *
 * Uses ts-jest with ESM output so TypeScript source files are consumed
 * directly by Jest without a separate tsc build step.
 */

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Rewrite .js extensions in imports to allow TypeScript → ESM resolution.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',                   // Companion entry point — integration only
    '!src/companion/**/*.ts',          // Companion SDK wrappers — integration only
    '!src/bridge/RelayServer.ts',      // WebSocket server — integration only (Sprint 5)
    '!src/bridge/WebSocketClient.ts',  // WebSocket client — integration only (Sprint 5)
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
}