'use strict'

/**
 * OBS Bible Companion Bridge
 *
 * Runs inside the OBS Custom Browser Dock (index.html).
 * Connects to the RelayServer via WebSocket and dispatches commands
 * to the window API exposed by display.js.
 *
 * Port is read from <meta name="obs-bible-port"> in index.html.
 * Falls back to 8765 if the tag is missing or malformed.
 */

;(function () {
  const PREFIX = '[OBS Bible Bridge]'

  // ── Port configuration ───────────────────────────────────────────────────
  function getPort() {
    const meta = document.querySelector('meta[name="obs-bible-port"]')
    if (meta) {
      const val = parseInt(meta.getAttribute('content'), 10)
      if (!isNaN(val) && val > 0 && val < 65536) return val
    }
    return 8765
  }

  const PORT = getPort()
  const RELAY_URL = `ws://127.0.0.1:${PORT}?client=browser`

  // ── Reconnect configuration ──────────────────────────────────────────────
  const INITIAL_DELAY_MS = 3000
  const MAX_DELAY_MS = 30000

  let socket = null
  let reconnectDelay = INITIAL_DELAY_MS
  let reconnectTimer = null

  // ── State sender ─────────────────────────────────────────────────────────

  /**
   * Sends current plugin state back to Companion via the relay.
   * Called immediately on connect and after every successful command.
   */
  function sendState() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    let currentTranslation = 'KJV'
    try {
      currentTranslation = localStorage.getItem('obs_bible_translation') ?? 'KJV'
    } catch (_) {}

    const state = {
      connected: true,
      currentReference: window.__currentReference ?? '',
      currentTranslation,
      overlayVisible: window.__overlayVisible ?? false,
      currentVerseIndex: window.__currentVerseIndex ?? -1,
    }
    socket.send(JSON.stringify(state))
  }

  // ── Command dispatcher ────────────────────────────────────────────────────

  /**
   * Dispatches a validated command object to the appropriate window API function.
   *
   * @param {{ action: string, [key: string]: unknown }} cmd
   */
  async function dispatch(cmd) {
    const { action } = cmd

    switch (action) {
      case 'displayVerse':
        if (typeof window.displayVerseByReference === 'function') {
          window.displayVerseByReference(cmd.reference)
        } else {
          console.warn(PREFIX, 'displayVerseByReference not available on window')
        }
        break

      case 'nextVerse':
        if (typeof window.nextVerse === 'function') {
          window.nextVerse()
        }
        break

      case 'previousVerse':
        if (typeof window.previousVerse === 'function') {
          window.previousVerse()
        }
        break

      case 'show':
        if (typeof window.showOverlay === 'function') {
          window.showOverlay()
        }
        break

      case 'hide':
        if (typeof window.hideOverlay === 'function') {
          window.hideOverlay()
        }
        break

      case 'toggleOverlay':
        if (typeof window.toggleOverlay === 'function') {
          window.toggleOverlay()
        }
        break

      case 'changeTranslation':
        if (typeof window.changeTranslation === 'function') {
          await window.changeTranslation(cmd.translation)
        }
        break

      default:
        console.warn(PREFIX, `Unknown action: "${action}" — ignoring`)
        return // do not send state for unknown actions
    }

    sendState()
  }

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    try {
      socket = new WebSocket(RELAY_URL)
    } catch (err) {
      console.error(PREFIX, 'Failed to create WebSocket:', err)
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      console.log(PREFIX, `Connected to relay on port ${PORT}`)
      reconnectDelay = INITIAL_DELAY_MS
      sendState()
    })

    socket.addEventListener('message', (event) => {
      let cmd
      try {
        cmd = JSON.parse(event.data)
      } catch (err) {
        console.warn(PREFIX, 'Received non-JSON message:', event.data)
        return
      }

      if (!cmd || typeof cmd.action !== 'string') {
        console.warn(PREFIX, 'Received message without "action" field:', cmd)
        return
      }

      dispatch(cmd).catch((err) => {
        console.error(PREFIX, 'Dispatch error:', err)
      })
    })

    socket.addEventListener('close', (event) => {
      console.log(PREFIX, `Disconnected (code ${event.code}), retrying in ${reconnectDelay / 1000}s`)
      socket = null
      scheduleReconnect()
    })

    socket.addEventListener('error', (event) => {
      // error is always followed by close — let the close handler schedule reconnect
      console.warn(PREFIX, 'WebSocket error:', event)
    })
  }

  function scheduleReconnect() {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelay)

    // Exponential backoff, capped at MAX_DELAY_MS
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY_MS)
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  // Wait for DOMContentLoaded so index.html scripts have run and window API is registered
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect)
  } else {
    connect()
  }
})()
