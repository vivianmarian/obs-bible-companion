/**
 * RelayServer.test.ts
 *
 * Integration tests for the WebSocket relay server.
 *
 * FIX (Sprint 5): The "Cannot log after tests are done" warning was caused by
 * afterEach calling stopServer() and returning immediately, while WebSocket
 * close events fired asynchronously after Jest had already marked the test
 * complete. The fix is two-part:
 *
 *   1. Every test closes its own WebSocket clients explicitly BEFORE
 *      stopServer() is called, so the server's per-socket close handlers
 *      fire while the server is still alive and the console buffer is open.
 *
 *   2. afterEach awaits a short sleep(50) after stopServer() to drain any
 *      remaining async callbacks before Jest tears down the console buffer.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { WebSocket } from 'ws'
import { RelayServer } from '../bridge/RelayServer.js'

const TEST_PORT = 18765

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open a WebSocket to the test server and resolve when open. */
function connect(role: 'companion' | 'browser' | 'unknown'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const param = role === 'unknown' ? 'garbage' : role
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?client=${param}`)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

/**
 * Close a WebSocket and wait for the close event to fully propagate.
 * Must be called BEFORE stopServer() — if the server is stopped first,
 * its per-socket close handler fires asynchronously after Jest has already
 * cleared the console buffer, producing the "Cannot log after tests are done"
 * warning.
 */
function closeAndWait(ws: WebSocket): Promise<void> {
  return new Promise(resolve => {
    if (ws.readyState === WebSocket.CLOSED) { resolve(); return }
    ws.once('close', () => resolve())
    ws.close()
  })
}

/** Wait for the next message on a WebSocket. */
function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.once('message', data => resolve(data.toString()))
    ws.once('error', reject)
  })
}

/** Drain remaining async callbacks before Jest checks for stray console output. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

let server: RelayServer

beforeEach(async () => {
  server = new RelayServer({ port: TEST_PORT })
  await server.start()
})

afterEach(async () => {
  await server.stop()
  // Drain any remaining WebSocket close callbacks so they complete before
  // Jest tears down the console buffer.
  await sleep(50)
})

// ---------------------------------------------------------------------------
// Basic connectivity
// ---------------------------------------------------------------------------

describe('RelayServer — basic connectivity', () => {
  it('starts and listens on the configured port', async () => {
    const ws = await connect('companion')
    expect(ws.readyState).toBe(WebSocket.OPEN)
    await closeAndWait(ws)
  })

  it('accepts a companion client connection', async () => {
    const ws = await connect('companion')
    expect(ws.readyState).toBe(WebSocket.OPEN)
    await closeAndWait(ws)
  })

  it('accepts a browser client connection', async () => {
    const ws = await connect('browser')
    expect(ws.readyState).toBe(WebSocket.OPEN)
    await closeAndWait(ws)
  })

  it('rejects a connection with an unknown role', async () => {
    const ws = await connect('unknown')
    await new Promise<void>(resolve => {
      if (ws.readyState === WebSocket.CLOSED) { resolve(); return }
      ws.once('close', () => resolve())
    })
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  it('rejects a second server on a port already in use', async () => {
    const second = new RelayServer({ port: TEST_PORT })
    await expect(second.start()).rejects.toThrow(/already in use/)
    await second.stop()
    await sleep(20)
  })
})

// ---------------------------------------------------------------------------
// Message forwarding
// ---------------------------------------------------------------------------

describe('RelayServer — message forwarding', () => {
  it('forwards a message from companion to browser', async () => {
    const companion = await connect('companion')
    const browser   = await connect('browser')

    const received = waitForMessage(browser)
    companion.send(JSON.stringify({ type: 'displayVerse', reference: 'John 3:16' }))
    const msg = await received

    await closeAndWait(companion)
    await closeAndWait(browser)

    expect(JSON.parse(msg)).toMatchObject({ type: 'displayVerse', reference: 'John 3:16' })
  })

  it('forwards a message from browser to companion', async () => {
    const companion = await connect('companion')
    const browser   = await connect('browser')

    const received = waitForMessage(companion)
    browser.send(JSON.stringify({ connected: true, currentReference: 'John 3:16' }))
    const msg = await received

    await closeAndWait(companion)
    await closeAndWait(browser)

    expect(JSON.parse(msg)).toMatchObject({ connected: true, currentReference: 'John 3:16' })
  })

  it('warns but does not crash when companion sends with no browser connected', async () => {
    const companion = await connect('companion')
    expect(() => companion.send(JSON.stringify({ type: 'ping' }))).not.toThrow()
    await sleep(30)
    await closeAndWait(companion)
  })

  it('warns but does not crash when browser sends with no companion connected', async () => {
    const browser = await connect('browser')
    expect(() => browser.send(JSON.stringify({ connected: true }))).not.toThrow()
    await sleep(30)
    await closeAndWait(browser)
  })
})

// ---------------------------------------------------------------------------
// Reconnection handling
// ---------------------------------------------------------------------------

describe('RelayServer — reconnection handling', () => {
  it('replaces companionSocket cleanly when companion reconnects', async () => {
    const first = await connect('companion')
    await closeAndWait(first)
    await sleep(20)

    const second = await connect('companion')
    expect(second.readyState).toBe(WebSocket.OPEN)
    await closeAndWait(second)
  })

  it('replaces browserSocket cleanly when browser reconnects', async () => {
    const first = await connect('browser')
    await closeAndWait(first)
    await sleep(20)

    const second = await connect('browser')
    expect(second.readyState).toBe(WebSocket.OPEN)
    await closeAndWait(second)
  })

  it('forwards correctly after companion reconnects', async () => {
    const firstCompanion = await connect('companion')
    const browser = await connect('browser')
    await closeAndWait(firstCompanion)
    await sleep(20)

    const secondCompanion = await connect('companion')
    const received = waitForMessage(browser)
    secondCompanion.send(JSON.stringify({ type: 'nextVerse' }))
    const msg = await received

    await closeAndWait(secondCompanion)
    await closeAndWait(browser)

    expect(JSON.parse(msg)).toMatchObject({ type: 'nextVerse' })
  })

  it('forwards correctly after browser reconnects', async () => {
    const companion = await connect('companion')
    const firstBrowser = await connect('browser')
    await closeAndWait(firstBrowser)
    await sleep(20)

    const secondBrowser = await connect('browser')
    const received = waitForMessage(companion)
    secondBrowser.send(JSON.stringify({ connected: true, currentReference: 'Genesis 1:1' }))
    const msg = await received

    await closeAndWait(companion)
    await closeAndWait(secondBrowser)

    expect(JSON.parse(msg)).toMatchObject({ currentReference: 'Genesis 1:1' })
  })
})