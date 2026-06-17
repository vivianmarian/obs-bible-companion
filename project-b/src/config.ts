/**
 * Shared configuration for the OBS Bible Companion module.
 * This is the single source of truth for all constants.
 * Import this file wherever a constant is needed — never hardcode values elsewhere.
 */
export const config = {
  /** WebSocket relay port. Override with OBS_BIBLE_PORT environment variable. */
  relayPort: parseInt(process.env['OBS_BIBLE_PORT'] ?? '8765', 10),

  /** Relay host — localhost only, never 0.0.0.0 (see Decision 9) */
  relayHost: '127.0.0.1',

  /** Initial reconnect delay in milliseconds */
  reconnectInitialDelayMs: 3000,

  /** Maximum reconnect delay in milliseconds (exponential backoff ceiling) */
  reconnectMaxDelayMs: 30000,

  /** BroadcastChannel name used to send verse text to browser_source.html */
  broadcastChannelDisplay: 'obs-bible-companion-display',

  /** BroadcastChannel name used to control overlay visibility */
  broadcastChannelAnimation: 'obs-bible-companion-anim',

  /** Default Bible translation to load on first run */
  defaultTranslation: 'KJV',

  /** Path to bible_data folder relative to project-b */
  bibleDataPath: '../project-a/bible_data',

  /** Path to the generated bible_structure.json file */
  bibleStructurePath: '../project-a/src/bible_data/bible_structure.json',
} as const
