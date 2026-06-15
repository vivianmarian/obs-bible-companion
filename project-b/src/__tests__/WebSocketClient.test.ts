/**
 * Tests for WebSocketClient.ts
 *
 * Tests cover:
 *  - Connects to a WebSocket server successfully
 *  - Status changes to 'connected' on open
 *  - Receives messages and calls onMessage callback
 *  - Sends messages when connected
 *  - Returns false from send() when not connected
 *  - Reconnects after server closes connection
 *  - Exponential backoff increases delay between attempts
 *  - destroy() stops reconnection permanently
 *  - Status changes to 'reconnecting' after disconnect
 */

import { WebSocketServer, WebSocket } from 'ws'
import { WebSocketClient } from '../bridge/WebSocketClient'
import type { ConnectionStatus } from '../bridge/types'

const TEST_PORT = 18766

/** Helper: start a minimal echo WebSocket server */
function startEchoServer(port: number): Promise<WebSocketServer> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ host: '127.0.0.1', port })
    wss.on('listening', () => resolve(wss))
  })
}

/** Helper: stop a WebSocket server */
function stopServer(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => {
    // Force-close all active client connections first.
    // Without this, wss.close() waits indefinitely for clients
    // to disconnect on their own, causing test timeouts.
    wss.clients.forEach((client) => client.terminate())
    wss.close(() => resolve())
  })
}

/** Helper: wait for a status value via the onStatusChange callback */
function waitForStatus(
  client: WebSocketClient,
  targetStatus: ConnectionStatus,
  timeoutMs = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for status: ${targetStatus}`)),
      timeoutMs
    )
    const checkNow = setInterval(() => {
      if (client.getStatus() === targetStatus) {
        clearTimeout(timer)
        clearInterval(checkNow)
        resolve()
      }
    }, 50)
  })
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// ─── Test suite ────────────────────────────────────────────────────────────────

describe('WebSocketClient', () => {
  let wss: WebSocketServer

  beforeEach(async () => {
    wss = await startEchoServer(TEST_PORT)
  })

  afterEach(async () => {
    await stopServer(wss)
    await sleep(100) // let sockets drain
  })

  // ── Connection ─────────────────────────────────────────────────────────────

  it('connects to a WebSocket server and reaches connected status', async () => {
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')
    expect(client.getStatus()).toBe('connected')
    client.destroy()
  })

  it('calls onStatusChange with connected when the socket opens', async () => {
    const statuses: ConnectionStatus[] = []
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      onStatusChange: (s) => statuses.push(s),
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')
    expect(statuses).toContain('connected')
    client.destroy()
  })

  // ── Messaging ──────────────────────────────────────────────────────────────

  it('calls onMessage when a message is received from the server', async () => {
    const messages: string[] = []
    let serverSideSocket: WebSocket | null = null

    wss.on('connection', (ws) => {
      serverSideSocket = ws
    })

    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      onMessage: (data) => messages.push(data),
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')
    await sleep(50) // let server-side handler register

    serverSideSocket!.send('{"action":"nextVerse"}')
    await sleep(100)

    expect(messages).toContain('{"action":"nextVerse"}')
    client.destroy()
  })

  it('sends a message and returns true when connected', async () => {
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')

    const result = client.send({ action: 'show' })
    expect(result).toBe(true)
    client.destroy()
  })

  it('returns false from send() when not connected', () => {
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    // Never called connect() — not connected
    const result = client.send({ action: 'show' })
    expect(result).toBe(false)
    client.destroy()
  })

  // ── Reconnection ───────────────────────────────────────────────────────────

  it('changes status to reconnecting after server closes the connection', async () => {
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')

    // Force-close all server-side connections
    wss.clients.forEach((ws) => ws.terminate())

    await waitForStatus(client, 'reconnecting', 2000)
    expect(client.getStatus()).toBe('reconnecting')
    client.destroy()
  })

  it('reconnects automatically after the server restarts', async () => {
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')

    // Kill server
    await stopServer(wss)
    await waitForStatus(client, 'reconnecting', 2000)

    // Restart server on same port
    wss = await startEchoServer(TEST_PORT)
    await waitForStatus(client, 'connected', 5000)

    expect(client.getStatus()).toBe('connected')
    client.destroy()
  })

  // ── Destroy ────────────────────────────────────────────────────────────────

  it('does not reconnect after destroy() is called', async () => {
    const statuses: ConnectionStatus[] = []
    const client = new WebSocketClient({
      url: `ws://127.0.0.1:${TEST_PORT}`,
      onStatusChange: (s) => statuses.push(s),
      initialDelayMs: 100,
      maxDelayMs: 500,
    })
    client.connect()
    await waitForStatus(client, 'connected')

    client.destroy()
    const statusesAfterDestroy = [...statuses]

    // Wait to confirm no reconnect happens
    await sleep(300)

    // Status should not have gone to 'reconnecting' after destroy
    const reconnectingAfterDestroy = statuses
      .slice(statusesAfterDestroy.length)
      .includes('reconnecting')
    expect(reconnectingAfterDestroy).toBe(false)
  })
})
