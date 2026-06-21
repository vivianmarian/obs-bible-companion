/**
 * jest.config.js for project-b
 *
 * Uses ts-jest with ESM output so TypeScript source files are consumed
 * directly by Jest without a separate tsc build step.
 *
 * Coverage exclusions:
 *
 *  - src/index.ts          — Companion module entry point. Extends
 *                            InstanceBase and calls runEntrypoint(), both
 *                            of which require a live Companion host process
 *                            to fully initialize. Not unit-testable in
 *                            isolation; verified manually by loading the
 *                            module into a real Companion instance (Sprint 6/7).
 *  - RelayServer.ts        — WebSocket server; integration-tested end-to-end
 *                            in Sprint 5. Its test suite fails to load in ESM
 *                            mode due to a CommonJS require.main guard
 *                            historically present in early versions; even
 *                            with that fixed (Decision 24), it is kept
 *                            excluded since its true behavior is best
 *                            verified via live socket integration tests
 *                            rather than coverage percentage.
 *  - WebSocketClient.ts    — WebSocket client; integration-tested alongside
 *                            RelayServer in Sprint 5.
 *
 *  src/companion/**       — NOT excluded as of Sprint 6. config.ts,
 *                            actions.ts, feedbacks.ts, and variables.ts are
 *                            all pure functions taking a fake instance
 *                            object and are fully unit-tested in
 *                            companion.test.ts.
 */

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
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
    '!src/index.ts',
    '!src/bridge/RelayServer.ts',
    '!src/bridge/WebSocketClient.ts',
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