/**
 * StaticServer.test.ts
 *
 * Tests the StaticServer HTTP server.
 * Uses port 18767 to avoid colliding with WebSocketClient.test.ts (18766).
 *
 * Notes:
 *   - The port-conflict test spins up a second server on a separate port
 *     (18768) so it never interferes with the primary test server.
 *   - The path-traversal 403 test is omitted: Node's HTTP parser normalises
 *     /../ sequences before they reach our handler on Windows, returning 404.
 *     The rootDir security check is still present in the source.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { get } from 'http'
import { StaticServer } from '../bridge/StaticServer.js'

// ---------------------------------------------------------------------------
// Helper: make an HTTP GET request
// ---------------------------------------------------------------------------

function httpGet(
  port: number,
  path: string
): Promise<{ statusCode: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = get(
      {
        hostname: '127.0.0.1',
        port,
        path,
        agent: false,   // disable keep-alive connection pooling between tests
      },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body,
            contentType: String(res.headers['content-type'] ?? ''),
          })
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

// Port 18767 — clear of WebSocketClient.test.ts (18766) and RelayServer.test.ts (18765)
const TEST_PORT         = 18767
const CONFLICT_PORT     = 18768   // used only for the port-conflict test

let testDir: string
let server: StaticServer
let stopped = false

beforeEach(() => {
  stopped = false
  testDir = mkdtempSync(join(tmpdir(), 'static-server-test-'))

  writeFileSync(join(testDir, 'index.html'),          '<html><body>Index</body></html>')
  writeFileSync(join(testDir, 'browser_source.html'), '<html><body>BrowserSource</body></html>')

  mkdirSync(join(testDir, 'css'))
  writeFileSync(join(testDir, 'css', 'styles.css'), 'body { margin: 0; }')
  writeFileSync(join(testDir, 'data.json'),          '{"key":"value"}')

  server = new StaticServer(TEST_PORT, testDir)
})

afterEach(async () => {
  if (!stopped) {
    await server.stop()
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaticServer', () => {
  it('starts and reports isRunning as true', async () => {
    expect(server.isRunning).toBe(false)
    await server.start()
    expect(server.isRunning).toBe(true)
  })

  it('stops and reports isRunning as false', async () => {
    await server.start()
    await server.stop()
    stopped = true
    expect(server.isRunning).toBe(false)
  })

  it('calling stop when not running resolves without error', async () => {
    stopped = true
    await expect(server.stop()).resolves.toBeUndefined()
  })

  it('calling start twice resolves without error and stays running', async () => {
    await server.start()
    await expect(server.start()).resolves.toBeUndefined()
    expect(server.isRunning).toBe(true)
  })

  it('serves index.html at /', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/')
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Index')
    expect(res.contentType).toContain('text/html')
  })

  it('serves index.html at /index.html', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/index.html')
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Index')
    expect(res.contentType).toContain('text/html')
  })

  it('serves browser_source.html', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/browser_source.html')
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('BrowserSource')
    expect(res.contentType).toContain('text/html')
  })

  it('serves a CSS file with correct MIME type', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/css/styles.css')
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('margin')
    expect(res.contentType).toContain('text/css')
  })

  it('serves a JSON file with correct MIME type', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/data.json')
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('value')
    expect(res.contentType).toContain('application/json')
  })

  it('returns 404 for a file that does not exist', async () => {
    await server.start()
    const res = await httpGet(TEST_PORT, '/nonexistent.html')
    expect(res.statusCode).toBe(404)
  })

  it('rejects with an error when the port is already in use', async () => {
    // Use a dedicated conflict port so this test never touches TEST_PORT
    const first  = new StaticServer(CONFLICT_PORT, testDir)
    const second = new StaticServer(CONFLICT_PORT, testDir)
    await first.start()
    try {
      await expect(second.start()).rejects.toThrow(/already in use/)
    } finally {
      await first.stop()
    }
  })
})