/**
 * index.ts
 *
 * Bitfocus Companion v3 module entry point for OBS Bible Companion.
 *
 * Sprint 7 additions over Sprint 6:
 *   - Owns a NavigationController instance.
 *   - Rebuilds the Companion button grid (setActionDefinitions) whenever
 *     the NavigationController emits a new NavPage.
 *   - When the operator reaches READY_TO_DISPLAY, automatically sends
 *     a displayVerse command to the relay (no extra button press needed).
 *   - Loads bible_structure.json at startup to initialize the controller.
 *
 * The navigation action set and the static action set (showOverlay etc.)
 * are kept separate: navigation buttons are dynamic (rebuilt every page
 * transition), while the static actions (overlay, translation, etc.) are
 * registered once and never change.
 */

import {
  InstanceBase,
  runEntrypoint,
  InstanceStatus,
  combineRgb,
  type SomeCompanionConfigField,
  type CompanionActionDefinitions,
} from '@companion-module/base'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { WebSocketClient } from './bridge/WebSocketClient.js'
import {
  DEFAULT_BRIDGE_STATE,
  type ModuleConfig,
  type BridgeState,
  type BridgeCommand,
} from './companion/types.js'
import { getConfigFields }      from './companion/config.js'
import { getActionDefinitions } from './companion/actions.js'
import { getFeedbackDefinitions } from './companion/feedbacks.js'
import { getVariableDefinitions, getVariableValues } from './companion/variables.js'
import { NavigationController, type NavPage, type NavButton } from './navigation/NavigationController.js'
import type { BibleStructureData } from './navigation/BibleStructure.js'

// ---------------------------------------------------------------------------
// Colors for navigation buttons
// ---------------------------------------------------------------------------

const COLOR_OPTION_BG = combineRgb(0,   80,  160)   // blue — selectable option
const COLOR_BACK_BG   = combineRgb(80,  80,  80)    // grey — back
const COLOR_RESET_BG  = combineRgb(160, 40,  0)     // dark orange — reset/danger
const COLOR_READY_BG  = combineRgb(0,   140, 0)     // green — ready to display
const COLOR_WHITE     = combineRgb(255, 255, 255)

// ---------------------------------------------------------------------------
// Module class
// ---------------------------------------------------------------------------

export class ObsBibleCompanionInstance extends InstanceBase<ModuleConfig> {
  public config: ModuleConfig = { relayHost: '127.0.0.1', relayPort: 8765 }
  public state: BridgeState = { ...DEFAULT_BRIDGE_STATE }

  private client:     WebSocketClient | null = null
  private navCtrl:    NavigationController | null = null

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async init(config: ModuleConfig): Promise<void> {
    this.config = config
    this.updateStatus(InstanceStatus.Connecting)

    // Register static (non-navigation) actions, feedbacks, variables.
    this.setFeedbackDefinitions(getFeedbackDefinitions(this))
    this.setVariableDefinitions(getVariableDefinitions())
    this.setVariableValues(getVariableValues(this.state))

    // Build the navigation controller, then merge nav + static actions.
    this.initNavController()

    this.connectToRelay()
  }

  async configUpdated(config: ModuleConfig): Promise<void> {
    this.config = config
    this.disconnectFromRelay()
    this.connectToRelay()
  }

  async destroy(): Promise<void> {
    this.disconnectFromRelay()
  }

  getConfigFields(): SomeCompanionConfigField[] {
    return getConfigFields()
  }

  // -------------------------------------------------------------------------
  // Navigation controller setup
  // -------------------------------------------------------------------------

  private initNavController(): void {
    const structure = this.loadBibleStructure()
    if (!structure) return

    this.navCtrl = new NavigationController(
      structure,
      (page: NavPage) => {
        this.rebuildActionDefinitions(page)
      },
      (reference: string) => {
        this.sendCommand({ type: 'displayVerse', reference })
      },
    )

    // Render initial page.
    this.rebuildActionDefinitions(this.navCtrl.getCurrentPage())
  }

  private loadBibleStructure(): BibleStructureData | null {
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      const structurePath = resolve(
        __dirname,
        '../../project-a/src/bible_data/bible_structure.json'
      )
      const raw = readFileSync(structurePath, 'utf-8')
      return JSON.parse(raw) as BibleStructureData
    } catch (err) {
      this.log('warn', `Could not load bible_structure.json: ${(err as Error).message}`)
      this.log('warn', 'Navigation buttons will be unavailable. Run: npm run generate:metadata --workspace=project-b')
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Dynamic action definitions
  // -------------------------------------------------------------------------

  /**
   * Rebuilds the full action definition set every time the nav page changes.
   * Navigation buttons are dynamic; static buttons (overlay etc.) are merged in
   * alongside them so operators can always access them from any page.
   */
  private rebuildActionDefinitions(page: NavPage): void {
    const staticActions = getActionDefinitions(this)
    const navActions    = this.buildNavActions(page)

    // Merge: static actions take precedence if IDs clash (they won't in practice).
    const merged: CompanionActionDefinitions = { ...navActions, ...staticActions }
    this.setActionDefinitions(merged)
  }

  private buildNavActions(page: NavPage): CompanionActionDefinitions {
    const actions: CompanionActionDefinitions = {}

    for (const button of page.buttons) {
      const btn = button  // capture for closure
      actions[`nav_${btn.actionId}`] = {
        name: btn.label,
        options: [],
        callback: async () => {
          if (!this.navCtrl) return
          this.navCtrl.handleButtonPress(btn.value)
        },
      }
    }

    return actions
  }

  // -------------------------------------------------------------------------
  // Relay connection management
  // -------------------------------------------------------------------------

  private connectToRelay(): void {
    const url = `ws://${this.config.relayHost}:${this.config.relayPort}?client=companion`

    this.client = new WebSocketClient({
      url,
      onOpen: () => {
        this.updateStatus(InstanceStatus.Ok)
        this.sendCommand({ type: 'getState' })
      },
      onMessage: (raw: string) => {
        this.handleIncomingMessage(raw)
      },
      onClose: () => {
        this.updateStatus(InstanceStatus.Disconnected)
        this.state = { ...DEFAULT_BRIDGE_STATE }
        this.setVariableValues(getVariableValues(this.state))
        this.checkFeedbacks()
      },
      onError: (err: Error) => {
        this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
      },
    })

    this.client.connect()
  }

  private disconnectFromRelay(): void {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private handleIncomingMessage(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.log('warn', `Received non-JSON message from relay: ${raw}`)
      return
    }

    if (!this.isBridgeState(parsed)) {
      this.log('warn', `Received malformed state message: ${raw}`)
      return
    }

    this.state = parsed
    this.setVariableValues(getVariableValues(this.state))
    this.checkFeedbacks()
  }

  private isBridgeState(value: unknown): value is BridgeState {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
      typeof v.connected          === 'boolean' &&
      (typeof v.currentReference  === 'string' || v.currentReference === null) &&
      typeof v.currentTranslation === 'string' &&
      typeof v.overlayVisible     === 'boolean' &&
      typeof v.currentVerseIndex  === 'number'
    )
  }

  // -------------------------------------------------------------------------
  // Public API — called by actions.ts and NavigationController
  // -------------------------------------------------------------------------

  public sendCommand(command: BridgeCommand): void {
    if (!this.client || !this.client.isOpen()) {
      this.log('warn', `Cannot send command, not connected: ${JSON.stringify(command)}`)
      return
    }
    this.client.send(JSON.stringify(command))
  }
}

runEntrypoint(ObsBibleCompanionInstance, [])