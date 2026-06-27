/**
 * companion/feedbacks.ts
 *
 * Defines visual feedback (button background color changes) driven by
 * the module's current state. Companion calls checkFeedbacks() whenever
 * instance.state changes (wired up in index.ts's handleIncomingMessage
 * and onClose handlers), which re-evaluates every feedback below.
 *
 * API 2.0 note: parseVariablesInString was removed from @companion-module/base
 * ~2.0.x entirely. Option values are read directly from feedback.options.
 *
 * Colors use simple, high-contrast choices suitable for a control surface
 * glanced at during a live service — green for "active/connected", red
 * for "disconnected/problem", default Companion colors otherwise.
 */

import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ObsBibleCompanionInstance } from '../index.js'

const COLOR_GREEN_BG = combineRgb(0, 153, 0)
const COLOR_RED_BG = combineRgb(153, 0, 0)
const COLOR_WHITE_TEXT = combineRgb(255, 255, 255)

export function getFeedbackDefinitions(
  instance: ObsBibleCompanionInstance
): CompanionFeedbackDefinitions {
  return {
    overlayIsVisible: {
      type: 'boolean',
      name: 'Overlay Is Visible',
      description: 'Highlights the button green when the verse overlay is currently shown on the OBS scene',
      defaultStyle: {
        bgcolor: COLOR_GREEN_BG,
        color: COLOR_WHITE_TEXT,
      },
      options: [],
      callback: () => {
        return instance.state.overlayVisible
      },
    },

    bridgeConnected: {
      type: 'boolean',
      name: 'Bridge Connected',
      description: 'Highlights the button red when the connection to OBS is lost',
      defaultStyle: {
        bgcolor: COLOR_RED_BG,
        color: COLOR_WHITE_TEXT,
      },
      options: [],
      callback: () => {
        return !instance.state.connected
      },
    },

    currentReferenceIs: {
      type: 'boolean',
      name: 'Current Reference Is',
      description: 'Highlights the button green when the displayed verse matches the given reference',
      defaultStyle: {
        bgcolor: COLOR_GREEN_BG,
        color: COLOR_WHITE_TEXT,
      },
      options: [
        {
          id: 'reference',
          type: 'textinput',
          label: 'Verse Reference',
          default: 'John 3:16',
          useVariables: true,
        },
      ],
      callback: (feedback) => {
        const reference = String(feedback.options.reference ?? '').trim()
        return instance.state.currentReference === reference
      },
    },

    currentTranslationIs: {
      type: 'boolean',
      name: 'Current Translation Is',
      description: 'Highlights the button green when the active translation matches the given value',
      defaultStyle: {
        bgcolor: COLOR_GREEN_BG,
        color: COLOR_WHITE_TEXT,
      },
      options: [
        {
          id: 'translation',
          type: 'textinput',
          label: 'Translation (e.g. KJV)',
          default: 'KJV',
        },
      ],
      callback: (feedback) => {
        return instance.state.currentTranslation === String(feedback.options.translation ?? '')
      },
    },
  }
}