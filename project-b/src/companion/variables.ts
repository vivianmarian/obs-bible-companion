/**
 * companion/variables.ts
 *
 * Defines the Companion variables this module exposes (e.g. $(obs-bible:reference))
 * and converts the current BridgeState into the value map Companion expects.
 *
 * API 2.0 note: setVariableDefinitions expects a record object keyed by
 * variableId, not an array. getVariableDefinitions() returns that object.
 */

import type { CompanionVariableValues } from '@companion-module/base'
import type { BridgeState } from './types.js'

export interface VariableDefinition {
  name: string
}

export function getVariableDefinitions(): Record<string, VariableDefinition> {
  return {
    connected:       { name: 'Connected to OBS (true/false)' },
    reference:       { name: 'Current verse reference' },
    translation:     { name: 'Current translation' },
    overlay_visible: { name: 'Overlay visible (true/false)' },
    verse_index:     { name: 'Current verse index' },
  }
}

export function getVariableValues(state: BridgeState): CompanionVariableValues {
  return {
    connected:       state.connected ? 'true' : 'false',
    reference:       state.currentReference ?? '',
    translation:     state.currentTranslation,
    overlay_visible: state.overlayVisible ? 'true' : 'false',
    verse_index:     String(state.currentVerseIndex),
  }
}