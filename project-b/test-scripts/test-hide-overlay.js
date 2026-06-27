/**
 * test-hide-overlay.js
 *
 * Sends a hideOverlay command through the relay to the real OBS bridge.
 * Run this AFTER the overlay is already visible (e.g. after test-show-overlay.js)
 * to hide the verse from the OBS video output.
 */

import WebSocket from 'ws'

const ws = new WebSocket('ws://127.0.0.1:8765?client=companion')

ws.on('open', () => {
  console.log('[test-hide-overlay] Connected as companion.')
  setTimeout(() => {
    const command = { type: 'hideOverlay' }
    console.log('[test-hide-overlay] SENDING:', JSON.stringify(command))
    ws.send(JSON.stringify(command))
  }, 300)
})

ws.on('message', (data) => {
  console.log('[test-hide-overlay] RECEIVED:', data.toString())
  ws.close()
})

ws.on('close', () => {
  console.log('[test-hide-overlay] Connection closed.')
  process.exit(0)
})

ws.on('error', (err) => {
  console.log('[test-hide-overlay] ERROR:', err.message)
})

setTimeout(() => {
  console.log('[test-hide-overlay] TIMEOUT.')
  process.exit(1)
}, 8000)