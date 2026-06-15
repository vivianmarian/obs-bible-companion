/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { showOverlay, hideOverlay, toggleOverlay, setAnimChannel } from '../src/js/overlay.js'

function makeMockChannel() {
  return { postMessage: jest.fn() }
}

function resetWindow() {
  window.__overlayVisible = false
}

describe('showOverlay', () => {
  it('sends { display: "flex" } to the animation channel', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    resetWindow()
    showOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'flex' })
  })

  it('sets window.__overlayVisible to true', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = false
    showOverlay()
    expect(window.__overlayVisible).toBe(true)
  })

  it('does not throw when animation channel is null', () => {
    setAnimChannel(null)
    expect(() => showOverlay()).not.toThrow()
  })
})

describe('hideOverlay', () => {
  it('sends { display: "none" } to the animation channel', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    resetWindow()
    hideOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'none' })
  })

  it('sets window.__overlayVisible to false', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = true
    hideOverlay()
    expect(window.__overlayVisible).toBe(false)
  })

  it('does not throw when animation channel is null', () => {
    setAnimChannel(null)
    expect(() => hideOverlay()).not.toThrow()
  })
})

describe('toggleOverlay', () => {
  it('calls hideOverlay behaviour when overlay is currently visible', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = true
    toggleOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'none' })
    expect(window.__overlayVisible).toBe(false)
  })

  it('calls showOverlay behaviour when overlay is currently hidden', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = false
    toggleOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'flex' })
    expect(window.__overlayVisible).toBe(true)
  })

  it('defaults to showing when window.__overlayVisible is undefined', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    delete window.__overlayVisible
    toggleOverlay()
    expect(ch.postMessage).toHaveBeenCalledWith({ display: 'flex' })
  })

  it('alternates correctly on repeated calls', () => {
    const ch = makeMockChannel()
    setAnimChannel(ch)
    window.__overlayVisible = false
    toggleOverlay()
    expect(window.__overlayVisible).toBe(true)
    toggleOverlay()
    expect(window.__overlayVisible).toBe(false)
    toggleOverlay()
    expect(window.__overlayVisible).toBe(true)
  })
})
