/**
 * test-browser.js
 *
 * Simulates companion_bridge.js (the OBS side) for manual relay testing.
 * Connects as ?client=browser, logs every message it receives, and sends
 * a fake state object back whenever it gets a message — mimicking what
 * companion_bridge.js does after executing a command.
 *
 * Run with: node test-browser.js
 * Leave this running, then run test-companion.js in a second terminal.
 *
 * Uses ESM import syntax because project-b/package.json has "type": "module".
 */

import WebSocket from 'ws'

const ws = new WebSocket('ws://127.0.0.1:8765?client=browser')

ws.on('open', () => {
  console.log('[test-browser] Connected as browser.')
})

ws.on('message', (data) => {
  const raw = data.toString()
  console.log('[test-browser] RECEIVED:', raw)

  let msg
  try {
    msg = JSON.parse(raw)
  } catch (e) {
    console.log('[test-browser] Could not parse as JSON, ignoring.')
    return
  }

  // Simulate companion_bridge.js sending state back after handling a command.
  const fakeState = {
    connected: true,
    currentReference: msg.reference || 'Genesis 1:1',
    currentTranslation: 'KJV',
    overlayVisible: false,
    currentVerseIndex: 0,
  }

  console.log('[test-browser] SENDING BACK:', JSON.stringify(fakeState))
  ws.send(JSON.stringify(fakeState))
})

ws.on('close', () => {
  console.log('[test-browser] Connection closed.')
})

ws.on('error', (err) => {
  console.log('[test-browser] ERROR:', err.message)
})

console.log('[test-browser] Connecting to ws://127.0.0.1:8765?client=browser ...')
