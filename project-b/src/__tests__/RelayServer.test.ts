/**
 * Tests for RelayServer.ts
 *
 * Tests cover:
 *  - Server starts and listens on correct port
 *  - Messages forwarded from companion → browser
 *  - Messages forwarded from browser → companion
 *  - Stale socket replacement when browser reconnects (Decision 6)
 *  - Stale socket replacement when companion reconnects (Decision 6)
 *  - Unknown client role is rejected
 *  - Port-in-use produces clear error and rejects promise
 *  - Messages dropped gracefully when target not connected
 */

import { WebSocket } from 'ws'
import { RelayServer } from '../bridge/RelayServer'

const TEST_PORT = 18765 // use non-default port to avoid conflicts in CI

/** Helper: open a WebSocket and wait for it to be ready */
function connectClient(port: number, role: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}?client=${role}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/** Helper: collect the next message that arrives on a WebSocket */
function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(data.toString()))
  })
}

/** Helper: wait for a socket close event */
function waitForClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => ws.once('close', () => resolve()))
}

/** Helper: small async sleep */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// ─── Test suite ────────────────────────────────────────────────────────────────

describe('RelayServer', () => {
  let server: RelayServer

  beforeEach(async () => {
    server = new RelayServer({ port: TEST_PORT })
    await server.start()
  })

  afterEach(async () => {
    await server.stop()
  })

  // ── Startup ────────────────────────────────────────────────────────────────

  it('starts and listens on the configured port', async () => {
    // If we reach here, start() resolved — server is listening
    const ws = await connectClient(TEST_PORT, 'companion')
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  // ── Forwarding ─────────────────────────────────────────────────────────────

  it('forwards a message from companion to browser', async () => {
    const companion = await connectClient(TEST_PORT, 'companion')
    const browser = await connectClient(TEST_PORT, 'browser')
    await sleep(50) // let server register both

    const payload = JSON.stringify({ action: 'nextVerse' })
    const received = nextMessage(browser)
    companion.send(payload)

    expect(await received).toBe(payload)
    companion.close()
    browser.close()
  })

  it('forwards a message from browser to companion', async () => {
    const companion = await connectClient(TEST_PORT, 'companion')
    const browser = await connectClient(TEST_PORT, 'browser')
    await sleep(50)

    const state = JSON.stringify({ connected: true, currentReference: 'John 3:16' })
    const received = nextMessage(companion)
    browser.send(state)

    expect(await received).toBe(state)
    companion.close()
    browser.close()
  })

  // ── Reconnection — Decision 6 ──────────────────────────────────────────────

  it('replaces stale browser socket when browser reconnects', async () => {
    const companion = await connectClient(TEST_PORT, 'companion')
    const browser1 = await connectClient(TEST_PORT, 'browser')
    await sleep(50)

    // Disconnect browser1
    browser1.close()
    await waitForClose(browser1)
    await sleep(50)

    // Reconnect with a new browser socket
    const browser2 = await connectClient(TEST_PORT, 'browser')
    await sleep(50)

    // Message from companion should arrive at browser2 (not stale browser1)
    const payload = JSON.stringify({ action: 'show' })
    const received = nextMessage(browser2)
    companion.send(payload)

    expect(await received).toBe(payload)
    companion.close()
    browser2.close()
  })

  it('replaces stale companion socket when companion reconnects', async () => {
    const companion1 = await connectClient(TEST_PORT, 'companion')
    const browser = await connectClient(TEST_PORT, 'browser')
    await sleep(50)

    // Disconnect companion1
    companion1.close()
    await waitForClose(companion1)
    await sleep(50)

    // Reconnect with a new companion socket
    const companion2 = await connectClient(TEST_PORT, 'companion')
    await sleep(50)

    // Message from browser should arrive at companion2
    const state = JSON.stringify({ connected: true, overlayVisible: false })
    const received = nextMessage(companion2)
    browser.send(state)

    expect(await received).toBe(state)
    companion2.close()
    browser.close()
  })

  // ── Unknown role ───────────────────────────────────────────────────────────

  it('closes connections with unknown client role', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?client=unknown`)
    await waitForClose(ws)
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  it('closes connections with no client role', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`)
    await waitForClose(ws)
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  // ── No target connected ────────────────────────────────────────────────────

  it('drops companion message gracefully when browser is not connected', async () => {
    const companion = await connectClient(TEST_PORT, 'companion')
    await sleep(50)

    // No browser connected — should not throw
    expect(() => {
      companion.send(JSON.stringify({ action: 'nextVerse' }))
    }).not.toThrow()

    await sleep(50) // give relay time to process
    companion.close()
  })

  it('drops browser message gracefully when companion is not connected', async () => {
    const browser = await connectClient(TEST_PORT, 'browser')
    await sleep(50)

    expect(() => {
      browser.send(JSON.stringify({ connected: true }))
    }).not.toThrow()

    await sleep(50)
    browser.close()
  })

  // ── Port in use ────────────────────────────────────────────────────────────

  it('rejects with a clear error message when port is already in use', async () => {
    // server is already running on TEST_PORT from beforeEach
    const duplicate = new RelayServer({ port: TEST_PORT })
    await expect(duplicate.start()).rejects.toThrow(
      `Port ${TEST_PORT} is already in use`
    )
  })
})
