/**
 * RelayServer — the Node.js WebSocket relay between Bitfocus Companion and
 * the companion_bridge.js running inside the OBS Custom Browser Dock.
 *
 * Architecture (see Decision 1 in master prompt):
 *   Companion (Node.js) ←→ RelayServer ←→ companion_bridge.js (OBS browser)
 *
 * Two clients connect:
 *   ?client=companion  — the Companion module (Project B)
 *   ?client=browser    — companion_bridge.js loaded in OBS (Project A)
 *
 * The relay forwards every message from companion → browser and every
 * message from browser → companion. It holds exactly one reference to each
 * client at a time and replaces stale references cleanly on reconnect.
 */

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { config } from '../config'
import type { ClientRole } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayServerOptions {
  port?: number
  host?: string
}

// ─── RelayServer class ────────────────────────────────────────────────────────

export class RelayServer {
  private wss: WebSocketServer | null = null
  private companionSocket: WebSocket | null = null
  private browserSocket: WebSocket | null = null
  private readonly port: number
  private readonly host: string

  constructor(options: RelayServerOptions = {}) {
    this.port = options.port ?? config.relayPort
    this.host = options.host ?? config.relayHost
  }

  /**
   * Starts the WebSocket server and begins listening for connections.
   * Rejects if the port is already in use with a human-readable message.
   *
   * @returns Promise that resolves when the server is listening.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        host: this.host,
        port: this.port,
      })

      this.wss.on('listening', () => {
        console.log(`[RelayServer] Listening on ${this.host}:${this.port}`)
        resolve()
      })

      this.wss.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    const msg =
      `[RelayServer] ERROR: Port ${this.port} is already in use.\n` +
      `  → Close whatever is using port ${this.port} and try again.\n` +
      `  → Or set a different port: OBS_BIBLE_PORT=9000 node RelayServer.js`
    console.error(msg)
    this.wss?.close()
    reject(new Error(msg))
  } else {
    console.error(`[RelayServer] Server error: ${err.message}`)
    reject(err)
  }
})

      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const role = this.parseRole(req)
        this.handleConnection(ws, role)
      })
    })
  }

  /**
   * Stops the WebSocket server and closes all connections.
   *
   * @returns Promise that resolves when the server is fully closed.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.companionSocket = null
      this.browserSocket = null

      if (this.wss) {
        this.wss.close(() => {
          console.log('[RelayServer] Stopped.')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Returns the current companion WebSocket (or null if not connected).
   * Used in tests to inspect state.
   */
  getCompanionSocket(): WebSocket | null {
    return this.companionSocket
  }

  /**
   * Returns the current browser WebSocket (or null if not connected).
   * Used in tests to inspect state.
   */
  getBrowserSocket(): WebSocket | null {
    return this.browserSocket
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Parses the ?client= query param from the HTTP upgrade request.
   *
   * @param req - The incoming HTTP upgrade request.
   * @returns The client role string.
   */
  private parseRole(req: IncomingMessage): ClientRole {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const client = url.searchParams.get('client')
    if (client === 'companion') return 'companion'
    if (client === 'browser') return 'browser'
    return 'unknown'
  }

  /**
   * Wires up a newly connected WebSocket into the relay.
   * Replaces any existing stale socket for that role (handles reconnection).
   *
   * @param ws   - The new WebSocket connection.
   * @param role - The role the client identified itself as.
   */
  private handleConnection(ws: WebSocket, role: ClientRole): void {
    if (role === 'companion') {
      // Replace stale reference — handles Companion restart (Decision 6)
      this.companionSocket = ws
      console.log('[RelayServer] Companion client connected.')

      ws.on('message', (data) => {
        this.forwardTo(this.browserSocket, data, 'browser')
      })

      ws.on('close', () => {
        console.log('[RelayServer] Companion client disconnected.')
        if (this.companionSocket === ws) {
          this.companionSocket = null
        }
      })

      ws.on('error', (err) => {
        console.error(`[RelayServer] Companion socket error: ${err.message}`)
      })
    } else if (role === 'browser') {
      // Replace stale reference — handles OBS restart (Decision 6)
      this.browserSocket = ws
      console.log('[RelayServer] Browser client connected.')

      ws.on('message', (data) => {
        this.forwardTo(this.companionSocket, data, 'companion')
      })

      ws.on('close', () => {
        console.log('[RelayServer] Browser client disconnected.')
        if (this.browserSocket === ws) {
          this.browserSocket = null
        }
      })

      ws.on('error', (err) => {
        console.error(`[RelayServer] Browser socket error: ${err.message}`)
      })
    } else {
      console.warn('[RelayServer] Unknown client role — connection rejected.')
      ws.close(1008, 'Missing or invalid ?client= query parameter')
    }
  }

  /**
   * Forwards a raw message to a target socket if it is open.
   * Silently drops the message if the target is not connected.
   *
   * @param target      - The destination WebSocket (or null).
   * @param data        - The raw message data to forward.
   * @param targetName  - Human-readable name for log messages.
   */
  private forwardTo(
    target: WebSocket | null,
    data: unknown,
    targetName: string
  ): void {
    if (target && target.readyState === WebSocket.OPEN) {
      target.send(data as Parameters<WebSocket['send']>[0])
    } else {
      console.warn(
        `[RelayServer] Cannot forward to ${targetName} — not connected.`
      )
    }
  }
}

// ─── Standalone entry point ───────────────────────────────────────────────────
// Runs when executed directly: npx ts-node src/bridge/RelayServer.ts

if (require.main === module) {
  const server = new RelayServer()
  server.start().catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
