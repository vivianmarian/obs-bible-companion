/**
 * companion/variables.ts
 *
 * Defines the Companion variables this module exposes (e.g. $(obs-bible:reference))
 * and converts the current BridgeState into the value map Companion expects.
 *
 * Variable IDs are prefixed implicitly by Companion using the connection's
 * configured name, so these stay short and unprefixed here per SDK convention.
 */

import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { BridgeState } from './types.js'

export function getVariableDefinitions(): CompanionVariableDefinition[] {
  return [
    { variableId: 'connected', name: 'Connected to OBS (true/false)' },
    { variableId: 'reference', name: 'Current verse reference' },
    { variableId: 'translation', name: 'Current translation' },
    { variableId: 'overlay_visible', name: 'Overlay visible (true/false)' },
    { variableId: 'verse_index', name: 'Current verse index' },
  ]
}

export function getVariableValues(state: BridgeState): CompanionVariableValues {
  return {
    connected: state.connected ? 'true' : 'false',
    reference: state.currentReference ?? '',
    translation: state.currentTranslation,
    overlay_visible: state.overlayVisible ? 'true' : 'false',
    verse_index: String(state.currentVerseIndex),
  }
}