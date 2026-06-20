;(function () {
  'use strict'

  /**
   * companion_bridge.js
   *
   * Loaded by index.html as a plain <script> tag (no type="module").
   * Runs inside the OBS Custom Browser Dock for the entire OBS session.
   *
   * Responsibilities:
   *   1. Connect to the RelayServer via WebSocket (?client=browser).
   *   2. Receive commands from Companion (displayVerse, nextVerse,
   *      previousVerse, showOverlay, hideOverlay, changeTranslation).
   *   3. Execute those commands by calling window.* functions exposed
   *      by index.html, which then broadcast to browser_source.html
   *      via BroadcastChannel.
   *   4. Send state updates back to Companion whenever the displayed
   *      verse changes (so Companion variables stay in sync).
   *   5. Reconnect automatically if the WebSocket closes.
   *
   * Architectural notes (see master prompt Decisions 13, 14, 15, 22, 29):
   *   - Plain IIFE — no ES6 import/export.
   *   - No fetch() calls.
   *   - BroadcastChannel is NOT used here — that is index.html's job.
   *     This file only speaks WebSocket.
   *   - Port is read from window.OBS_BIBLE_PORT if set, otherwise 8765.
   *   - CRITICAL (Decision 29): OBS's CEF WebSocket implementation may
   *     deliver text frames as a Blob object instead of a string. Always
   *     check for Blob and convert via .text() before parsing — never
   *     discard non-string event.data, or messages will be silently lost
   *     with zero error trace.
   */

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  var PORT    = (window.OBS_BIBLE_PORT || 8765)
  var HOST    = '127.0.0.1'
  var WS_URL  = 'ws://' + HOST + ':' + PORT + '?client=browser'

  // Reconnect delays: start at 3 s, cap at 30 s (exponential back-off).
  var RECONNECT_INITIAL_MS = 3000
  var RECONNECT_MAX_MS     = 30000

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var ws               = null
  var reconnectDelay   = RECONNECT_INITIAL_MS
  var reconnectTimer   = null
  var destroyed        = false   // set true when OBS unloads the dock

  // ---------------------------------------------------------------------------
  // Logging helpers
  // ---------------------------------------------------------------------------

  function log (msg) {
    console.log('[companion_bridge] ' + msg)
  }

  function warn (msg) {
    console.warn('[companion_bridge] ' + msg)
  }

  // ---------------------------------------------------------------------------
  // State reporting — send current plugin state to Companion via WebSocket
  // ---------------------------------------------------------------------------

  function sendState () {
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    var state = {
      connected:          true,
      currentReference:   window.__currentReference   || null,
      currentTranslation: window.__currentTranslation || 'KJV',
      overlayVisible:     window.__overlayVisible     || false,
      currentVerseIndex:  (typeof window.__currentVerseIndex === 'number')
                            ? window.__currentVerseIndex
                            : -1,
    }

    try {
      ws.send(JSON.stringify(state))
    } catch (err) {
      warn('Failed to send state: ' + err.message)
    }
  }

  function sendDisconnected () {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify({ connected: false }))
    } catch (_) { /* ignore — socket may already be closing */ }
  }

  // ---------------------------------------------------------------------------
  // Command dispatch — called when a message arrives from Companion
  // ---------------------------------------------------------------------------

  function dispatch (msg) {
    var type = msg.type

    if (type === 'displayVerse') {
      if (typeof msg.reference !== 'string') {
        warn('displayVerse: missing reference field')
        return
      }
      if (typeof window.displayVerseByReference !== 'function') {
        warn('displayVerseByReference is not available on window yet')
        return
      }
      window.displayVerseByReference(msg.reference)
      setTimeout(sendState, 0)

    } else if (type === 'nextVerse') {
      if (typeof window.nextVerse !== 'function') {
        warn('nextVerse is not available on window yet')
        return
      }
      window.nextVerse()
      setTimeout(sendState, 0)

    } else if (type === 'previousVerse') {
      if (typeof window.previousVerse !== 'function') {
        warn('previousVerse is not available on window yet')
        return
      }
      window.previousVerse()
      setTimeout(sendState, 0)

    } else if (type === 'showOverlay') {
      if (typeof window.showOverlay !== 'function') {
        warn('showOverlay is not available on window yet')
        return
      }
      window.showOverlay()
      setTimeout(sendState, 0)

    } else if (type === 'hideOverlay') {
      if (typeof window.hideOverlay !== 'function') {
        warn('hideOverlay is not available on window yet')
        return
      }
      window.hideOverlay()
      setTimeout(sendState, 0)

    } else if (type === 'changeTranslation') {
      if (typeof msg.translation !== 'string') {
        warn('changeTranslation: missing translation field')
        return
      }
      if (typeof window.changeTranslation !== 'function') {
        warn('changeTranslation is not available on window yet')
        return
      }
      window.changeTranslation(msg.translation)
      setTimeout(sendState, 0)

    } else if (type === 'getState') {
      sendState()

    } else {
      warn('Unknown command type: ' + JSON.stringify(type))
    }
  }

  /**
   * Parses a raw text message and dispatches it.
   * Separated from ws.onmessage so it can be called either synchronously
   * (string data) or asynchronously after Blob-to-text conversion.
   */
  function handleIncomingMessage (raw) {
    var msg
    try {
      msg = JSON.parse(raw)
    } catch (err) {
      warn('Received non-JSON message: ' + raw)
      return
    }
    dispatch(msg)
  }

  // ---------------------------------------------------------------------------
  // WebSocket lifecycle
  // ---------------------------------------------------------------------------

  function connect () {
    if (destroyed) return

    log('Connecting to ' + WS_URL)
    ws = new WebSocket(WS_URL)

    ws.onopen = function () {
      log('Connected.')
      reconnectDelay = RECONNECT_INITIAL_MS
      sendState()
    }

    ws.onmessage = function (event) {
      // CRITICAL (Decision 29): OBS CEF may deliver text frames as a Blob
      // instead of a string. Convert Blob to text before parsing — never
      // silently discard non-string data, or messages vanish with zero trace.
      if (event.data instanceof Blob) {
        event.data.text().then(function (text) {
          handleIncomingMessage(text)
        }).catch(function (err) {
          warn('Failed to read Blob message: ' + err.message)
        })
        return
      }

      handleIncomingMessage(event.data)
    }

    ws.onerror = function (event) {
      warn('WebSocket error.')
    }

    ws.onclose = function () {
      log('Connection closed.')
      sendDisconnected()
      ws = null
      scheduleReconnect()
    }
  }

  function scheduleReconnect () {
    if (destroyed) return
    log('Reconnecting in ' + reconnectDelay + 'ms...')
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null
      connect()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
  }

  function destroy () {
    destroyed = true
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
    log('Bridge destroyed.')
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect)
  } else {
    connect()
  }

  window.addEventListener('beforeunload', destroy)

  window.__bridgeDestroy   = destroy
  window.__bridgeSendState = sendState

}())