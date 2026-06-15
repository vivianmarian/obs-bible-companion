'use strict'

import { searchBible, findVerseIndexByReference } from './search.js'
import { getBibleData } from './translation.js'
import { showOverlay, hideOverlay, toggleOverlay, setAnimChannel } from './overlay.js'

export { setAnimChannel }

/**
 * The BroadcastChannel used to send verse data to browser_source.html.
 *
 * @type {BroadcastChannel | null}
 */
let _displayChannel = null

/**
 * Returns the display BroadcastChannel, creating it if necessary.
 *
 * @returns {BroadcastChannel | null}
 */
function getDisplayChannel() {
  if (_displayChannel) return _displayChannel
  if (typeof BroadcastChannel !== 'undefined') {
    _displayChannel = new BroadcastChannel('myChannel')
  }
  return _displayChannel
}

/**
 * Injects a replacement display channel for unit testing.
 *
 * @param {BroadcastChannel | {postMessage: Function} | null} channel
 * @returns {void}
 */
export function setDisplayChannel(channel) {
  _displayChannel = channel
}

/**
 * Sends a verse object to browser_source.html via BroadcastChannel.
 *
 * @param {{name: string, verse: string, ari: string}} verseObj - Verse to display
 * @returns {void}
 */
export function sendMessage(verseObj) {
  const ch = getDisplayChannel()
  if (ch) {
    ch.postMessage(verseObj)
  }
}

/**
 * Registers all programmatic window API functions.
 * Must be called once after bible data is loaded.
 * All functions are attached to window so companion_bridge.js can call them.
 *
 * @returns {void}
 */
export function registerWindowAPI() {
  if (typeof window === 'undefined') return

  // Initialise state properties
  window.__currentReference = window.__currentReference ?? ''
  window.__currentVerseIndex = window.__currentVerseIndex ?? -1
  window.__overlayVisible = window.__overlayVisible ?? false

  /**
   * Displays a verse by its reference string (e.g. 'John 3:16').
   * Updates __currentVerseIndex and __currentReference.
   *
   * @param {string} reference
   */
  window.displayVerseByReference = function (reference) {
    const data = getBibleData()
    const idx = findVerseIndexByReference(reference, data)
    if (idx === -1) {
      console.warn(`[OBS Bible] displayVerseByReference: reference not found: "${reference}"`)
      return
    }
    const verseObj = data[idx]
    window.__currentVerseIndex = idx
    window.__currentReference = verseObj.name
    sendMessage(verseObj)
  }

  /**
   * Advances to the next verse in the array. No-op at last verse.
   */
  window.nextVerse = function () {
    const data = getBibleData()
    if (data.length === 0) return
    const current = window.__currentVerseIndex ?? -1
    if (current >= data.length - 1) return // no-op at last verse
    const nextIdx = current === -1 ? 0 : current + 1
    const verseObj = data[nextIdx]
    window.__currentVerseIndex = nextIdx
    window.__currentReference = verseObj.name
    sendMessage(verseObj)
  }

  /**
   * Goes back to the previous verse. No-op at index 0 or when none selected.
   */
  window.previousVerse = function () {
    const data = getBibleData()
    if (data.length === 0) return
    const current = window.__currentVerseIndex ?? -1
    if (current <= 0) return // no-op at first verse or none selected
    const prevIdx = current - 1
    const verseObj = data[prevIdx]
    window.__currentVerseIndex = prevIdx
    window.__currentReference = verseObj.name
    sendMessage(verseObj)
  }

  /**
   * Shows the overlay in browser_source.html.
   */
  window.showOverlay = function () {
    showOverlay()
  }

  /**
   * Hides the overlay in browser_source.html.
   */
  window.hideOverlay = function () {
    hideOverlay()
  }

  /**
   * Toggles overlay visibility.
   */
  window.toggleOverlay = function () {
    toggleOverlay()
  }

  /**
   * Changes the active translation and re-displays the current verse in the new translation.
   * Dynamically imports translation.js to avoid circular deps.
   *
   * @param {string} translationName - e.g. 'NIV'
   */
  window.changeTranslation = async function (translationName) {
    const { loadTranslation } = await import('./translation.js')
    const success = await loadTranslation(translationName)
    if (success && window.__currentVerseIndex !== -1) {
      // Re-display in new translation using the same index
      const newData = getBibleData()
      const verseObj = newData[window.__currentVerseIndex]
      if (verseObj) {
        window.__currentReference = verseObj.name
        sendMessage(verseObj)
      }
    }
  }
}
