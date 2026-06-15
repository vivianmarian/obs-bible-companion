/**
 * WebSocketClient — a typed WebSocket client with exponential backoff reconnection.
 *
 * Used by the Companion module (Project B) to maintain a persistent connection
 * to the RelayServer. Automatically reconnects when the relay is restarted.
 */

import { WebSocket } from 'ws'
import { config } from '../config'
import type { ConnectionStatus } from './types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WebSocketClientOptions {
  url: string
  /** Called when a message arrives from the server */
  onMessage?: (data: string) => void
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void
  /** Initial reconnect delay in ms (default: config.reconnectInitialDelayMs) */
  initialDelayMs?: number
  /** Maximum reconnect delay in ms (default: config.reconnectMaxDelayMs) */
  maxDelayMs?: number
}

// ─── WebSocketClient class ─────────────────────────────────────────────────────

export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private currentDelay: number
  private destroyed = false
  private status: ConnectionStatus = 'disconnected'

  private readonly url: string
  private readonly onMessage: (data: string) => void
  private readonly onStatusChange: (status: ConnectionStatus) => void
  private readonly initialDelayMs: number
  private readonly maxDelayMs: number

  constructor(options: WebSocketClientOptions) {
    this.url = options.url
    this.onMessage = options.onMessage ?? (() => undefined)
    this.onStatusChange = options.onStatusChange ?? (() => undefined)
    this.initialDelayMs = options.initialDelayMs ?? config.reconnectInitialDelayMs
    this.maxDelayMs = options.maxDelayMs ?? config.reconnectMaxDelayMs
    this.currentDelay = this.initialDelayMs
  }

  /**
   * Opens the WebSocket connection. Call once to begin the connection lifecycle.
   * Reconnection is handled automatically thereafter.
   */
  connect(): void {
    if (this.destroyed) return
    this.attemptConnect()
  }

  /**
   * Sends a JSON-serialisable message to the relay.
   * No-op if the socket is not currently open.
   *
   * @param data - Any JSON-serialisable object to send.
   * @returns true if the message was sent, false if the socket was not open.
   */
  send(data: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    }
    return false
  }

  /**
   * Returns the current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * Permanently closes the connection and prevents any further reconnection.
   * Call when the Companion module is shutting down.
   */
  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.terminate()
      this.ws = null
    }
    this.setStatus('disconnected')
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private attemptConnect(): void {
    if (this.destroyed) return

    try {
      this.ws = new WebSocket(this.url)
    } catch (err) {
      console.error(`[WebSocketClient] Failed to create socket: ${String(err)}`)
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      console.log(`[WebSocketClient] Connected to ${this.url}`)
      this.currentDelay = this.initialDelayMs // reset backoff on success
      this.setStatus('connected')
    })

    this.ws.on('message', (raw) => {
      this.onMessage(raw.toString())
    })

    this.ws.on('close', () => {
      console.log('[WebSocketClient] Connection closed.')
      this.ws = null
      if (!this.destroyed) {
        this.setStatus('reconnecting')
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (err) => {
      // 'error' always fires before 'close', so we just log here.
      // The 'close' handler will schedule the reconnect.
      console.error(`[WebSocketClient] Socket error: ${err.message}`)
    })
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    console.log(`[WebSocketClient] Reconnecting in ${this.currentDelay}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.attemptConnect()
    }, this.currentDelay)

    // Exponential backoff — double the delay up to maxDelayMs
    this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelayMs)
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status
      this.onStatusChange(status)
    }
  }
}
