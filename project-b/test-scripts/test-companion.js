/**
 * test-companion.js
 *
 * Simulates Bitfocus Companion (the controller side) for manual relay
 * testing. Connects as ?client=companion, waits briefly to avoid a
 * known race condition where messages sent immediately on 'open' can
 * arrive before the server has finished attaching its message listener,
 * then sends one displayVerse command and logs whatever comes back.
 *
 * Run with: node test-companion.js
 * Run this AFTER test-browser.js (or the real OBS bridge) is connected.
 */

import WebSocket from 'ws'

const ws = new WebSocket('ws://127.0.0.1:8765?client=companion')

ws.on('open', () => {
  console.log('[test-companion] Connected as companion.')
  console.log('[test-companion] Waiting 500ms before sending (race condition guard)...')

  setTimeout(() => {
    const command = { type: 'displayVerse', reference: 'John 3:16' }
    console.log('[test-companion] SENDING:', JSON.stringify(command))
    ws.send(JSON.stringify(command))
  }, 500)
})

ws.on('message', (data) => {
  console.log('[test-companion] RECEIVED:', data.toString())
  console.log('[test-companion] Test complete — closing.')
  ws.close()
})

ws.on('close', () => {
  console.log('[test-companion] Connection closed.')
  process.exit(0)
})

ws.on('error', (err) => {
  console.log('[test-companion] ERROR:', err.message)
})

console.log('[test-companion] Connecting to ws://127.0.0.1:8765?client=companion ...')

// Safety timeout — if nothing comes back in 8 seconds, say so clearly and exit.
setTimeout(() => {
  console.log('[test-companion] TIMEOUT — no response received within 8 seconds.')
  process.exit(1)
}, 8000)