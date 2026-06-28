/**
 * jest.config.js for project-b
 *
 * Uses ts-jest with ESM output so TypeScript source files are consumed
 * directly by Jest without a separate tsc build step.
 *
 * Coverage exclusions:
 *
 *  - src/index.ts              — Companion module entry point. Extends
 *                                InstanceBase and calls runEntrypoint(),
 *                                both of which require a live Companion
 *                                host process to fully initialize.
 *                                Excluded since Sprint 6 (Decision 23).
 *
 *  - src/bridge/RelayServer.ts     — WebSocket server; integration-tested
 *  - src/bridge/WebSocketClient.ts   end-to-end in Sprint 5. Excluded
 *                                    since Sprint 3 (Decision 23).
 *
 * Everything else is included:
 *  - src/companion/**         — pure functions, fully tested (Sprint 6)
 *  - src/navigation/**        — NavigationEngine (Sprint 4) +
 *                               NavigationController (Sprint 7), both
 *                               fully tested with in-memory fixtures
 *  - src/metadata/**          — MetadataGenerator (Sprint 3)
 *  - src/config.ts            — shared config constants
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
  testPathIgnorePatterns: ['/node_modules/', '/obs-bible-companion/', '/pkg/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/bridge/RelayServer.ts',
    '!src/bridge/WebSocketClient.ts',
  ],
  coverageThreshold: {
    global: {
      lines:      80,
      branches:   75,
      functions:  80,
      statements: 80,
    },
  },
}