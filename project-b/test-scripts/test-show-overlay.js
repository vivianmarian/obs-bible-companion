/**
 * test-show-overlay.js
 *
 * Sends a showOverlay command through the relay to the real OBS bridge.
 * Run this AFTER displayVerse has already been sent (e.g. via test-companion.js)
 * so there's a verse loaded to show.
 */

import WebSocket from 'ws'

const ws = new WebSocket('ws://127.0.0.1:8765?client=companion')

ws.on('open', () => {
  console.log('[test-show-overlay] Connected as companion.')
  setTimeout(() => {
    const command = { type: 'showOverlay' }
    console.log('[test-show-overlay] SENDING:', JSON.stringify(command))
    ws.send(JSON.stringify(command))
  }, 300)
})

ws.on('message', (data) => {
  console.log('[test-show-overlay] RECEIVED:', data.toString())
  ws.close()
})

ws.on('close', () => {
  console.log('[test-show-overlay] Connection closed.')
  process.exit(0)
})

ws.on('error', (err) => {
  console.log('[test-show-overlay] ERROR:', err.message)
})

setTimeout(() => {
  console.log('[test-show-overlay] TIMEOUT.')
  process.exit(1)
}, 8000)