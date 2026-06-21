/**
 * companion/actions.ts
 *
 * Defines every action (button press behavior) the operator can assign
 * to a Companion button. Each action calls instance.sendCommand() with
 * the matching BridgeCommand, which the module's WebSocketClient sends
 * to the RelayServer — exactly the protocol proven working end-to-end
 * in Sprint 5.
 *
 * Action IDs are kept stable and descriptive since operators' saved
 * button configurations reference them by ID — renaming an action ID
 * later breaks every existing button using it.
 */

import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ObsBibleCompanionInstance } from '../index.js'

export function getActionDefinitions(
  instance: ObsBibleCompanionInstance
): CompanionActionDefinitions {
  return {
    displayVerse: {
      name: 'Display Verse',
      description: 'Display a specific verse by reference, e.g. "John 3:16"',
      options: [
        {
          id: 'reference',
          type: 'textinput',
          label: 'Verse Reference',
          default: 'John 3:16',
          useVariables: true,
        },
      ],
      callback: async (event) => {
        const reference = await instance.parseVariablesInString(
          String(event.options.reference ?? '')
        )
        if (!reference.trim()) {
          instance.log('warn', 'Display Verse action called with empty reference')
          return
        }
        instance.sendCommand({ type: 'displayVerse', reference })
      },
    },

    nextVerse: {
      name: 'Next Verse',
      description: 'Advance to the next verse in the current translation',
      options: [],
      callback: async () => {
        instance.sendCommand({ type: 'nextVerse' })
      },
    },

    previousVerse: {
      name: 'Previous Verse',
      description: 'Go back to the previous verse in the current translation',
      options: [],
      callback: async () => {
        instance.sendCommand({ type: 'previousVerse' })
      },
    },

    showOverlay: {
      name: 'Show Overlay',
      description: 'Show the verse overlay on the OBS scene',
      options: [],
      callback: async () => {
        instance.sendCommand({ type: 'showOverlay' })
      },
    },

    hideOverlay: {
      name: 'Hide Overlay',
      description: 'Hide the verse overlay on the OBS scene',
      options: [],
      callback: async () => {
        instance.sendCommand({ type: 'hideOverlay' })
      },
    },

    toggleOverlay: {
      name: 'Toggle Overlay',
      description: 'Show the overlay if hidden, hide it if shown',
      options: [],
      callback: async () => {
        if (instance.state.overlayVisible) {
          instance.sendCommand({ type: 'hideOverlay' })
        } else {
          instance.sendCommand({ type: 'showOverlay' })
        }
      },
    },

    changeTranslation: {
      name: 'Change Translation',
      description: 'Switch the active Bible translation',
      options: [
        {
          id: 'translation',
          type: 'textinput',
          label: 'Translation (e.g. KJV, NIV)',
          default: 'KJV',
          useVariables: true,
        },
      ],
      callback: async (event) => {
        const translation = await instance.parseVariablesInString(
          String(event.options.translation ?? '')
        )
        if (!translation.trim()) {
          instance.log('warn', 'Change Translation action called with empty translation')
          return
        }
        instance.sendCommand({ type: 'changeTranslation', translation })
      },
    },

    refreshState: {
      name: 'Refresh State',
      description: 'Request the current state from OBS (useful after reconnecting)',
      options: [],
      callback: async () => {
        instance.sendCommand({ type: 'getState' })
      },
    },
  }
}