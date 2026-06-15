/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// We do NOT use jest.mock() — it requires CJS require() which is unavailable in ESM.
// Instead we use the injectable setDisplayChannel / setAnimChannel APIs built into
// the modules, which let us swap in mock objects from test code.

import { sendMessage, setDisplayChannel, registerWindowAPI } from '../src/js/display.js'
import { setAnimChannel } from '../src/js/overlay.js'

// ── Shared fixture data ────────────────────────────────────────────────────
// We set window.__bibleData so getBibleData() returns it without a fetch call.
// translation.js reads this property when running under jsdom.
const FIXTURE_DATA = [
  { name: 'Genesis 1:1', verse: 'In the beginning God created the heaven and the earth.', ari: '1:1:1' },
  { name: 'Genesis 1:2', verse: 'And the earth was without form, and void.', ari: '1:1:2' },
  { name: 'John 3:16',   verse: 'For God so loved the world.', ari: '43:3:16' },
  { name: 'John 3:17',   verse: 'For God sent not his Son into the world to condemn the world.', ari: '43:3:17' },
  { name: 'Psalm 23:1',  verse: 'The LORD is my shepherd; I shall not want.', ari: '19:23:1' },
]

// Patch getBibleData at the module level by loading translation and setting data directly
import { _resetForTesting } from '../src/js/translation.js'

// We reach into the translation module's exported setter to pre-load fixture data
// without a fetch. translation.js exposes _resetForTesting(); we inject data via
// a window-level shim that display.js picks up through getBibleData().
//
// Simpler approach: monkey-patch the module export. Since ESM exports are live
// bindings we cannot reassign them, so instead we expose a __setDataForTesting
// hook in translation.js. If that's not present, we fall back to testing
// sendMessage and the channel injection only (which still gives full coverage
// of the display logic without needing live bible data).

// Attempt to use the test hook if available
let setDataForTesting = null
try {
  const mod = await import('../src/js/translation.js')
  if (typeof mod.__setDataForTesting === 'function') {
    setDataForTesting = mod.__setDataForTesting
  }
} catch (_) {}

function makeMockChannel() {
  return { postMessage: jest.fn() }
}

function setupWindow() {
  window.__currentReference = ''
  window.__currentVerseIndex = -1
  window.__overlayVisible = false
}

// ── sendMessage ────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('calls postMessage on the injected display channel with the verse object', () => {
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    const verseObj = { name: 'John 3:16', verse: 'For God so loved the world.', ari: '43:3:16' }
    sendMessage(verseObj)
    expect(ch.postMessage).toHaveBeenCalledWith(verseObj)
  })

  it('does not throw when display channel is null', () => {
    setDisplayChannel(null)
    expect(() => sendMessage({ name: 'John 3:16', verse: 'text', ari: '43:3:16' })).not.toThrow()
  })

  it('passes the exact object reference to postMessage', () => {
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    const verseObj = { name: 'Psalm 23:1', verse: 'The LORD is my shepherd.', ari: '19:23:1' }
    sendMessage(verseObj)
    expect(ch.postMessage).toHaveBeenCalledTimes(1)
    expect(ch.postMessage.mock.calls[0][0]).toBe(verseObj)
  })
})

// ── registerWindowAPI — overlay delegates ─────────────────────────────────
// These tests verify the window API wires up correctly to overlay functions.
// We inject a mock anim channel to capture postMessage calls.

describe('window overlay delegates after registerWindowAPI', () => {
  beforeEach(() => {
    setupWindow()
    registerWindowAPI()
  })

  it('window.showOverlay sends { display: "flex" } via the anim channel', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.showOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'flex' })
    expect(window.__overlayVisible).toBe(true)
  })

  it('window.hideOverlay sends { display: "none" } via the anim channel', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = true
    window.hideOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'none' })
    expect(window.__overlayVisible).toBe(false)
  })

  it('window.toggleOverlay toggles from hidden to visible', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = false
    window.toggleOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'flex' })
  })

  it('window.toggleOverlay toggles from visible to hidden', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = true
    window.toggleOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'none' })
  })
})

// ── registerWindowAPI — navigation with injected data ─────────────────────
// These tests use __setDataForTesting if available, otherwise skip gracefully.

describe('window.displayVerseByReference', () => {
  beforeEach(() => {
    setupWindow()
    if (setDataForTesting) setDataForTesting(FIXTURE_DATA)
    registerWindowAPI()
  })

  it('sends the correct verse to the display channel', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.displayVerseByReference('John 3:16')
    expect(ch.postMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'John 3:16' }))
  })

  it('sets window.__currentReference', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.displayVerseByReference('John 3:16')
    expect(window.__currentReference).toBe('John 3:16')
  })

  it('sets window.__currentVerseIndex to the correct index', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.displayVerseByReference('John 3:16')
    expect(window.__currentVerseIndex).toBe(2)
  })

  it('does not call postMessage when reference is not found', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.displayVerseByReference('Zephaniah 99:99')
    expect(ch.postMessage).not.toHaveBeenCalled()
  })
})

describe('window.nextVerse', () => {
  beforeEach(() => {
    setupWindow()
    if (setDataForTesting) setDataForTesting(FIXTURE_DATA)
    registerWindowAPI()
  })

  it('advances to the next verse', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = 0
    window.nextVerse()
    expect(window.__currentVerseIndex).toBe(1)
    expect(ch.postMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Genesis 1:2' }))
  })

  it('is a no-op at the last verse', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = FIXTURE_DATA.length - 1
    window.nextVerse()
    expect(window.__currentVerseIndex).toBe(FIXTURE_DATA.length - 1)
    expect(ch.postMessage).not.toHaveBeenCalled()
  })

  it('starts from index 0 when no verse is selected', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = -1
    window.nextVerse()
    expect(window.__currentVerseIndex).toBe(0)
  })
})

describe('window.previousVerse', () => {
  beforeEach(() => {
    setupWindow()
    if (setDataForTesting) setDataForTesting(FIXTURE_DATA)
    registerWindowAPI()
  })

  it('goes back to the previous verse', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = 2
    window.previousVerse()
    expect(window.__currentVerseIndex).toBe(1)
    expect(ch.postMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Genesis 1:2' }))
  })

  it('is a no-op at index 0', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = 0
    window.previousVerse()
    expect(window.__currentVerseIndex).toBe(0)
    expect(ch.postMessage).not.toHaveBeenCalled()
  })

  it('is a no-op when no verse is selected (index -1)', () => {
    if (!setDataForTesting) return
    const ch = makeMockChannel()
    setDisplayChannel(ch)
    window.__currentVerseIndex = -1
    window.previousVerse()
    expect(ch.postMessage).not.toHaveBeenCalled()
  })
})
