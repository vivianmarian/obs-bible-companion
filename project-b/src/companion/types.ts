/**
 * companion/types.ts
 *
 * Shared types for the Bitfocus Companion module layer.
 * These describe the module's configuration fields, its runtime state
 * (mirrored from the bridge's state broadcasts), and the shape of the
 * config object Companion passes in.
 *
 * Kept separate from bridge/types.ts (ClientRole etc.) because these are
 * Companion-SDK-facing concerns, not relay-protocol concerns.
 */

/**
 * Configuration fields the operator sets up in the Companion module's
 * connection settings page.
 */
export interface ModuleConfig {
  /** Host the RelayServer is running on. Almost always 127.0.0.1. */
  relayHost: string
  /** Port the RelayServer is listening on. Default 8765. */
  relayPort: number
}

/**
 * Mirrors the state object companion_bridge.js sends after every command.
 * This is the module's live view of what OBS is currently displaying.
 */
export interface BridgeState {
  connected: boolean
  currentReference: string | null
  currentTranslation: string
  overlayVisible: boolean
  currentVerseIndex: number
}

/** Default state before any connection or state message has been received. */
export const DEFAULT_BRIDGE_STATE: BridgeState = {
  connected: false,
  currentReference: null,
  currentTranslation: 'KJV',
  overlayVisible: false,
  currentVerseIndex: -1,
}

/**
 * The set of command messages the module can send to the bridge.
 * Mirrors the dispatch() switch in companion_bridge.js exactly — keep
 * these in sync if new command types are added.
 */
export type BridgeCommand =
  | { type: 'displayVerse'; reference: string }
  | { type: 'nextVerse' }
  | { type: 'previousVerse' }
  | { type: 'showOverlay' }
  | { type: 'hideOverlay' }
  | { type: 'changeTranslation'; translation: string }
  | { type: 'getState' }