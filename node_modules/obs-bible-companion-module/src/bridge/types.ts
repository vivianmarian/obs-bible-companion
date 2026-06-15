/**
 * All shared TypeScript types for the WebSocket bridge layer.
 * Used by RelayServer, WebSocketClient, companion_bridge.js, and Companion actions.
 */

/**
 * Commands sent FROM Companion TO the browser plugin via the relay.
 * Each action maps directly to a window.* function in Project A.
 */
export type BridgeCommand =
  | { action: 'displayVerse'; reference: string }
  | { action: 'changeTranslation'; translation: string }
  | { action: 'nextVerse' }
  | { action: 'previousVerse' }
  | { action: 'show' }
  | { action: 'hide' }

/**
 * State sent FROM the browser plugin TO Companion via the relay.
 * Sent after every successful command and on initial connection.
 */
export type BridgeState = {
  connected: boolean
  currentReference: string
  currentTranslation: string
  overlayVisible: boolean
  currentVerseIndex: number
}

/**
 * WebSocket connection status for the Companion module UI.
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

/**
 * Which role a WebSocket client is playing in the relay.
 */
export type ClientRole = 'companion' | 'browser' | 'unknown'
