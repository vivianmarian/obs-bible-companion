/**
 * NavigationController.ts
 *
 * Owns a NavigationEngine instance and translates its state into
 * Companion button definitions. Called by index.ts whenever the operator
 * presses a navigation button.
 *
 * Design:
 *   - Up to MAX_BUTTONS buttons per page (matching a typical Stream Deck layout).
 *   - Each NavOption from the engine becomes one dynamic action.
 *   - A "Back" button is always added when not at TESTAMENT_SELECT.
 *   - A "Reset" button is always present.
 *   - When READY_TO_DISPLAY is reached, the displayVerse command is sent
 *     automatically — no extra button press required.
 *
 * The controller is a pure class with no Companion SDK imports — it works
 * entirely with plain objects (NavOption[], CompanionButtonDef) so that
 * it can be fully unit-tested without a live Companion host.
 */

import { NavigationEngine, type NavOption, type NavStage } from './NavigationEngine.js'
import type { BibleStructureData } from './BibleStructure.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single button definition the controller produces for Companion to render. */
export interface NavButton {
  /** Unique action ID used to identify this button press. */
  actionId: string
  /** Human-readable label shown on the physical button. */
  label: string
  /** The value to pass back to selectOption() when pressed. */
  value: string
  /** Visual style hint for the button. */
  style: 'option' | 'back' | 'reset' | 'ready'
}

/** The full page of buttons produced for the current navigation state. */
export interface NavPage {
  stage: NavStage
  title: string
  buttons: NavButton[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum navigation option buttons per page (fits a 4×3 Stream Deck minus Back/Reset). */
export const MAX_BUTTONS = 10

const BACK_ACTION_ID  = 'nav_back'
const RESET_ACTION_ID = 'nav_reset'

// ---------------------------------------------------------------------------
// NavigationController
// ---------------------------------------------------------------------------

export class NavigationController {
  private engine: NavigationEngine
  private onPageChange: (page: NavPage) => void
  private onVerseSelected: (reference: string) => void

  constructor(
    structure: BibleStructureData,
    onPageChange: (page: NavPage) => void,
    onVerseSelected: (reference: string) => void,
  ) {
    this.engine = new NavigationEngine(structure)
    this.onPageChange = onPageChange
    this.onVerseSelected = onVerseSelected
  }

  // -------------------------------------------------------------------------
  // Public API — called by Companion action callbacks
  // -------------------------------------------------------------------------

  /**
   * Handle a button press. actionId is either a nav option value,
   * BACK_ACTION_ID, or RESET_ACTION_ID.
   */
  handleButtonPress(actionId: string): void {
    if (actionId === RESET_ACTION_ID) {
      this.engine.reset()
      this.emitPage()
      return
    }

    if (actionId === BACK_ACTION_ID) {
      this.engine.back()
      this.emitPage()
      return
    }

    // It's a navigation option — find the matching option and advance the engine.
    const state = this.engine.getState()
    const option = state.options.find(o => o.value === actionId)
    if (!option) return

    this.advance(option)
  }

  /**
   * Returns the current navigation page without changing state.
   * Used on init and after an external state reset.
   */
  getCurrentPage(): NavPage {
    return this.buildPage()
  }

  /**
   * Resets the engine and emits the initial page.
   * Call on module init or when the operator wants to start over.
   */
  reset(): void {
    this.engine.reset()
    this.emitPage()
  }

  // -------------------------------------------------------------------------
  // Private — state machine advancement
  // -------------------------------------------------------------------------

  private advance(option: NavOption): void {
    const stage = this.engine.getState().stage

    switch (stage) {
      case 'TESTAMENT_SELECT':
        this.engine.selectTestament(option.value as 'Old' | 'New')
        break
      case 'BOOK_SELECT':
        this.engine.selectBook(option.value)
        break
      case 'CHAPTER_RANGE_SELECT':
        this.engine.selectChapterRange(parseInt(option.value, 10))
        break
      case 'CHAPTER_SELECT':
        this.engine.selectChapter(option.value)
        break
      case 'VERSE_RANGE_SELECT':
        this.engine.selectVerseRange(parseInt(option.value, 10))
        break
      case 'VERSE_SELECT':
        this.engine.selectVerse(option.value)
        break
      case 'READY_TO_DISPLAY':
        // Already at the end — reset to allow a new selection.
        this.engine.reset()
        break
    }

    const newState = this.engine.getState()

    if (newState.stage === 'READY_TO_DISPLAY' && newState.reference !== null) {
      this.onVerseSelected(newState.reference)
    }

    this.emitPage()
  }

  private emitPage(): void {
    this.onPageChange(this.buildPage())
  }

  // -------------------------------------------------------------------------
  // Private — page building
  // -------------------------------------------------------------------------

  private buildPage(): NavPage {
    const state = this.engine.getState()
    const buttons: NavButton[] = []

    if (state.stage === 'READY_TO_DISPLAY') {
      // Show the selected reference and a reset button.
      buttons.push({
        actionId: state.reference ?? 'ready',
        label: state.reference ?? 'Ready',
        value: state.reference ?? '',
        style: 'ready',
      })
      buttons.push({
        actionId: RESET_ACTION_ID,
        label: 'New Verse',
        value: RESET_ACTION_ID,
        style: 'reset',
      })
      return {
        stage: state.stage,
        title: state.reference ?? 'Ready to Display',
        buttons,
      }
    }

    // Add up to MAX_BUTTONS option buttons.
    const options = state.options.slice(0, MAX_BUTTONS)
    for (const option of options) {
      buttons.push({
        actionId: option.value,
        label: option.label,
        value: option.value,
        style: 'option',
      })
    }

    // Add Back button (except at the root stage).
    if (state.stage !== 'TESTAMENT_SELECT') {
      buttons.push({
        actionId: BACK_ACTION_ID,
        label: '← Back',
        value: BACK_ACTION_ID,
        style: 'back',
      })
    }

    // Always add Reset button.
    buttons.push({
      actionId: RESET_ACTION_ID,
      label: 'Reset',
      value: RESET_ACTION_ID,
      style: 'reset',
    })

    return {
      stage: state.stage,
      title: this.stageTitle(state.stage),
      buttons,
    }
  }

  private stageTitle(stage: NavStage): string {
    switch (stage) {
      case 'TESTAMENT_SELECT':      return 'Select Testament'
      case 'BOOK_SELECT':           return 'Select Book'
      case 'CHAPTER_RANGE_SELECT':  return 'Select Chapter Range'
      case 'CHAPTER_SELECT':        return 'Select Chapter'
      case 'VERSE_RANGE_SELECT':    return 'Select Verse Range'
      case 'VERSE_SELECT':          return 'Select Verse'
      case 'READY_TO_DISPLAY':      return 'Ready'
    }
  }
}