/**
 * companion.test.ts
 *
 * Tests the pure, SDK-independent logic in the companion/ layer.
 *
 * API 2.0 changes reflected here:
 *   1. Action/feedback definitions can now be `false` (to disable them).
 *      The type is now `false | CompanionActionDefinition`. The `!`
 *      non-null assertion no longer narrows away `false`, so we must
 *      add explicit type guards before accessing `.callback`.
 *   2. parseVariablesInString moved from instance to context parameter.
 *      The fake instance no longer needs this method; the fake context
 *      object is passed as the second argument to callbacks instead.
 *   3. CompanionVariableDefinition now has a generic type parameter.
 *      Access variableId via `as any` cast to avoid the generic constraint
 *      mismatch in the test environment.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { getConfigFields } from '../companion/config.js'
import { getActionDefinitions } from '../companion/actions.js'
import { getFeedbackDefinitions } from '../companion/feedbacks.js'
import { getVariableDefinitions, getVariableValues } from '../companion/variables.js'
import { DEFAULT_BRIDGE_STATE, type BridgeState, type BridgeCommand } from '../companion/types.js'

// ---------------------------------------------------------------------------
// Fake instance — satisfies only what actions.ts/feedbacks.ts actually call
// Note: parseVariablesInString removed — it now lives on the context object
// ---------------------------------------------------------------------------

function makeFakeInstance(stateOverrides: Partial<BridgeState> = {}) {
  const sentCommands: BridgeCommand[] = []
  const logs: Array<{ level: string; message: string }> = []

  const fake = {
    state: { ...DEFAULT_BRIDGE_STATE, ...stateOverrides } as BridgeState,
    sendCommand: jest.fn((cmd: BridgeCommand) => {
      sentCommands.push(cmd)
    }),
    log: jest.fn((level: string, message: string) => {
      logs.push({ level, message })
    }),
  }

  return { fake, sentCommands, logs }
}

// Fake context — provides parseVariablesInString as a pass-through
const fakeContext = {
  parseVariablesInString: async (input: string) => input,
}

// ---------------------------------------------------------------------------
// Helper: narrow action/feedback away from `false` before calling callback
// API 2.0: definitions can be `false` to disable them
// ---------------------------------------------------------------------------

function getCallback(definition: false | { callback: unknown }): Function {
  if (definition === false) throw new Error('Definition is disabled (false)')
  return definition.callback as Function
}

// ---------------------------------------------------------------------------
// config.ts
// ---------------------------------------------------------------------------

describe('getConfigFields', () => {
  it('includes a relayHost field with default 127.0.0.1', () => {
    const fields = getConfigFields()
    const host = fields.find(f => f.id === 'relayHost')
    expect(host).toBeDefined()
    expect(host?.type).toBe('textinput')
    if (host?.type === 'textinput') {
      expect(host.default).toBe('127.0.0.1')
    }
  })

  it('includes a relayPort field with default 8765', () => {
    const fields = getConfigFields()
    const port = fields.find(f => f.id === 'relayPort')
    expect(port).toBeDefined()
    expect(port?.type).toBe('number')
    if (port?.type === 'number') {
      expect(port.default).toBe(8765)
    }
  })

  it('includes a static info text field', () => {
    const fields = getConfigFields()
    const info = fields.find(f => f.id === 'info')
    expect(info).toBeDefined()
    expect(info?.type).toBe('static-text')
  })
})

// ---------------------------------------------------------------------------
// actions.ts
// ---------------------------------------------------------------------------

describe('getActionDefinitions', () => {
  it('defines all 8 expected actions', () => {
    const { fake } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    expect(Object.keys(actions).sort()).toEqual(
      [
        'changeTranslation',
        'displayVerse',
        'hideOverlay',
        'nextVerse',
        'previousVerse',
        'refreshState',
        'showOverlay',
        'toggleOverlay',
      ].sort()
    )
  })

  it('displayVerse sends a displayVerse command with the given reference', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.displayVerse!)(
      { options: { reference: 'John 3:16' } },
      fakeContext
    )
    expect(sentCommands).toEqual([{ type: 'displayVerse', reference: 'John 3:16' }])
  })

  it('displayVerse logs a warning and sends nothing when reference is empty', async () => {
    const { fake, sentCommands, logs } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.displayVerse!)(
      { options: { reference: '   ' } },
      fakeContext
    )
    expect(sentCommands).toEqual([])
    expect(logs[0].level).toBe('warn')
  })

  it('nextVerse sends a nextVerse command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.nextVerse!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'nextVerse' }])
  })

  it('previousVerse sends a previousVerse command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.previousVerse!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'previousVerse' }])
  })

  it('showOverlay sends a showOverlay command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.showOverlay!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'showOverlay' }])
  })

  it('hideOverlay sends a hideOverlay command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.hideOverlay!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'hideOverlay' }])
  })

  it('toggleOverlay sends showOverlay when currently hidden', async () => {
    const { fake, sentCommands } = makeFakeInstance({ overlayVisible: false })
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.toggleOverlay!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'showOverlay' }])
  })

  it('toggleOverlay sends hideOverlay when currently visible', async () => {
    const { fake, sentCommands } = makeFakeInstance({ overlayVisible: true })
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.toggleOverlay!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'hideOverlay' }])
  })

  it('changeTranslation sends a changeTranslation command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.changeTranslation!)(
      { options: { translation: 'NIV' } },
      fakeContext
    )
    expect(sentCommands).toEqual([{ type: 'changeTranslation', translation: 'NIV' }])
  })

  it('changeTranslation logs a warning and sends nothing when translation is empty', async () => {
    const { fake, sentCommands, logs } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.changeTranslation!)(
      { options: { translation: '' } },
      fakeContext
    )
    expect(sentCommands).toEqual([])
    expect(logs[0].level).toBe('warn')
  })

  it('refreshState sends a getState command', async () => {
    const { fake, sentCommands } = makeFakeInstance()
    const actions = getActionDefinitions(fake as any)
    await getCallback(actions.refreshState!)({ options: {} }, fakeContext)
    expect(sentCommands).toEqual([{ type: 'getState' }])
  })
})

// ---------------------------------------------------------------------------
// feedbacks.ts
// ---------------------------------------------------------------------------

describe('getFeedbackDefinitions', () => {
  it('defines all 4 expected feedbacks', () => {
    const { fake } = makeFakeInstance()
    const feedbacks = getFeedbackDefinitions(fake as any)
    expect(Object.keys(feedbacks).sort()).toEqual(
      ['bridgeConnected', 'currentReferenceIs', 'currentTranslationIs', 'overlayIsVisible'].sort()
    )
  })

  it('overlayIsVisible returns true when overlay is visible', () => {
    const { fake } = makeFakeInstance({ overlayVisible: true })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.overlayIsVisible!)({ options: {} }, fakeContext)
    expect(result).toBe(true)
  })

  it('overlayIsVisible returns false when overlay is hidden', () => {
    const { fake } = makeFakeInstance({ overlayVisible: false })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.overlayIsVisible!)({ options: {} }, fakeContext)
    expect(result).toBe(false)
  })

  it('bridgeConnected returns true (feedback active) when NOT connected', () => {
    const { fake } = makeFakeInstance({ connected: false })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.bridgeConnected!)({ options: {} }, fakeContext)
    expect(result).toBe(true)
  })

  it('bridgeConnected returns false (feedback inactive) when connected', () => {
    const { fake } = makeFakeInstance({ connected: true })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.bridgeConnected!)({ options: {} }, fakeContext)
    expect(result).toBe(false)
  })

  it('currentReferenceIs returns true when reference matches', async () => {
    const { fake } = makeFakeInstance({ currentReference: 'John 3:16' })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = await getCallback(feedbacks.currentReferenceIs!)(
      { options: { reference: 'John 3:16' } },
      fakeContext
    )
    expect(result).toBe(true)
  })

  it('currentReferenceIs returns false when reference does not match', async () => {
    const { fake } = makeFakeInstance({ currentReference: 'Genesis 1:1' })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = await getCallback(feedbacks.currentReferenceIs!)(
      { options: { reference: 'John 3:16' } },
      fakeContext
    )
    expect(result).toBe(false)
  })

  it('currentTranslationIs returns true when translation matches', () => {
    const { fake } = makeFakeInstance({ currentTranslation: 'NIV' })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.currentTranslationIs!)(
      { options: { translation: 'NIV' } },
      fakeContext
    )
    expect(result).toBe(true)
  })

  it('currentTranslationIs returns false when translation does not match', () => {
    const { fake } = makeFakeInstance({ currentTranslation: 'KJV' })
    const feedbacks = getFeedbackDefinitions(fake as any)
    const result = getCallback(feedbacks.currentTranslationIs!)(
      { options: { translation: 'NIV' } },
      fakeContext
    )
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// variables.ts
// ---------------------------------------------------------------------------

describe('getVariableDefinitions', () => {
  it('defines all 5 expected variables', () => {
    const defs = getVariableDefinitions()
    // Cast to any to access variableId — the generic type parameter
    // in CompanionVariableDefinition<T> causes a TypeScript error in
    // the test environment but the field exists at runtime in v2.0.x.
    expect((defs as any[]).map((d: any) => d.variableId).sort()).toEqual(
      ['connected', 'overlay_visible', 'reference', 'translation', 'verse_index'].sort()
    )
  })
})

describe('getVariableValues', () => {
  it('converts a fully-populated BridgeState to variable values', () => {
    const state: BridgeState = {
      connected: true,
      currentReference: 'John 3:16',
      currentTranslation: 'KJV',
      overlayVisible: true,
      currentVerseIndex: 46,
    }
    const values = getVariableValues(state)
    expect(values).toEqual({
      connected: 'true',
      reference: 'John 3:16',
      translation: 'KJV',
      overlay_visible: 'true',
      verse_index: '46',
    })
  })

  it('converts the DEFAULT_BRIDGE_STATE to expected variable values', () => {
    const values = getVariableValues(DEFAULT_BRIDGE_STATE)
    expect(values).toEqual({
      connected: 'false',
      reference: '',
      translation: 'KJV',
      overlay_visible: 'false',
      verse_index: '-1',
    })
  })

  it('converts a null currentReference to an empty string', () => {
    const state: BridgeState = { ...DEFAULT_BRIDGE_STATE, currentReference: null }
    const values = getVariableValues(state)
    expect(values.reference).toBe('')
  })

  it('converts boolean false fields to the literal string "false", not empty', () => {
    const state: BridgeState = { ...DEFAULT_BRIDGE_STATE, connected: false, overlayVisible: false }
    const values = getVariableValues(state)
    expect(values.connected).toBe('false')
    expect(values.overlay_visible).toBe('false')
  })
})