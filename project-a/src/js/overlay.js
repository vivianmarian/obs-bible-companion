'use strict'

/**
 * The BroadcastChannel used to control overlay visibility in browser_source.html.
 * Created lazily so it does not throw in Node.js test environments.
 *
 * @type {BroadcastChannel | null}
 */
let _animChannel = null

/**
 * Returns the animation BroadcastChannel, creating it if necessary.
 * Allows injection of a mock channel for testing via setAnimChannel().
 *
 * @returns {BroadcastChannel | null}
 */
function getAnimChannel() {
  if (_animChannel) return _animChannel
  if (typeof BroadcastChannel !== 'undefined') {
    _animChannel = new BroadcastChannel('obs-bible-animation')
  }
  return _animChannel
}

/**
 * Injects a replacement channel for unit testing.
 *
 * @param {BroadcastChannel | {postMessage: Function} | null} channel
 * @returns {void}
 */
export function setAnimChannel(channel) {
  _animChannel = channel
}

/**
 * Posts a show command to the animation BroadcastChannel.
 * Sets window.__overlayVisible = true.
 *
 * @returns {void}
 */
export function showOverlay() {
  const ch = getAnimChannel()
  if (ch) {
    ch.postMessage({ display: 'flex' })
  }
  if (typeof window !== 'undefined') {
    window.__overlayVisible = true
  }
}

/**
 * Posts a hide command to the animation BroadcastChannel.
 * Sets window.__overlayVisible = false.
 *
 * @returns {void}
 */
export function hideOverlay() {
  const ch = getAnimChannel()
  if (ch) {
    ch.postMessage({ display: 'none' })
  }
  if (typeof window !== 'undefined') {
    window.__overlayVisible = false
  }
}

/**
 * Toggles overlay visibility based on current window.__overlayVisible state.
 * If the state is unknown, defaults to showing.
 *
 * @returns {void}
 */
export function toggleOverlay() {
  const visible = (typeof window !== 'undefined') ? window.__overlayVisible : false
  if (visible) {
    hideOverlay()
  } else {
    showOverlay()
  }
}
