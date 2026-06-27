/**
 * index.ts
 *
 * Bitfocus Companion v3/v4 module entry point for OBS Bible Companion.
 *
 * Sprint 10 addition over Sprint 7:
 *   - The RelayServer is now started automatically inside init() and stopped
 *     inside destroy(). The operator no longer needs to run start.bat / start.sh
 *     to launch the relay — it starts and stops with the Companion module.
 *   - Port conflict on relay startup sets the module status to ConnectionFailure
 *     with a clear message instead of crashing the process.
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

import { RelayServer } from './bridge/RelayServer.js'
import { WebSocketClient } from './bridge/WebSocketClient.js'
import {
  DEFAULT_BRIDGE_STATE,
  type ModuleConfig,
  type BridgeState,
  type BridgeCommand,
} from './companion/types.js'
import { getConfigFields }        from './companion/config.js'
import { getActionDefinitions }   from './companion/actions.js'
import { getFeedbackDefinitions } from './companion/feedbacks.js'
import { getVariableDefinitions, getVariableValues } from './companion/variables.js'
import { NavigationController, type NavPage, type NavButton } from './navigation/NavigationController.js'
import type { BibleStructureData } from './navigation/BibleStructure.js'

// ---------------------------------------------------------------------------
// Colors for navigation buttons
// ---------------------------------------------------------------------------

const COLOR_OPTION_BG = combineRgb(0,   80,  160)   // blue  — selectable option
const COLOR_BACK_BG   = combineRgb(80,  80,  80)    // grey  — back
const COLOR_RESET_BG  = combineRgb(160, 40,  0)     // orange — reset
const COLOR_READY_BG  = combineRgb(0,   140, 0)     // green — ready to display
const COLOR_WHITE     = combineRgb(255, 255, 255)

// ---------------------------------------------------------------------------
// Module class
// ---------------------------------------------------------------------------

export class ObsBibleCompanionInstance extends InstanceBase<ModuleConfig> {
  public config: ModuleConfig = { relayHost: '127.0.0.1', relayPort: 8765 }
  public state:  BridgeState  = { ...DEFAULT_BRIDGE_STATE }

  private relay:   RelayServer       | null = null
  private client:  WebSocketClient   | null = null
  private navCtrl: NavigationController | null = null

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async init(config: ModuleConfig): Promise<void> {
    this.config = config
    this.updateStatus(InstanceStatus.Connecting)

    // Register static feedbacks, variables (actions registered after nav init).
    this.setFeedbackDefinitions(getFeedbackDefinitions(this))
    this.setVariableDefinitions(getVariableDefinitions())
    this.setVariableValues(getVariableValues(this.state))

    // Build navigation controller and merge nav + static actions.
    this.initNavController()

    // Start the relay server embedded in this module process, then connect.
    await this.startRelay()
    if (this.relay) {
      this.connectToRelay()
    }
  }

  async configUpdated(config: ModuleConfig): Promise<void> {
    this.config = config
    this.disconnectFromRelay()
    await this.stopRelay()
    await this.startRelay()
    if (this.relay) {
      this.connectToRelay()
    }
  }

  async destroy(): Promise<void> {
    this.disconnectFromRelay()
    await this.stopRelay()
  }

  getConfigFields(): SomeCompanionConfigField[] {
    return getConfigFields()
  }

  // -------------------------------------------------------------------------
  // Relay lifecycle
  // -------------------------------------------------------------------------

  private async startRelay(): Promise<void> {
    const port = this.config.relayPort ?? 8765
    this.relay = new RelayServer(port)
    try {
      await this.relay.start()
      this.log('info', `RelayServer started on port ${port}`)
    } catch (err) {
      const msg = `RelayServer failed to start on port ${port}: ${(err as Error).message}`
      this.log('error', msg)
      this.updateStatus(InstanceStatus.ConnectionFailure, msg)
      this.relay = null
    }
  }

  private async stopRelay(): Promise<void> {
    if (this.relay) {
      await this.relay.stop()
      this.relay = null
    }
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
      this.log('warn', 'Navigation buttons unavailable. Run: npm run generate:metadata --workspace=project-b')
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Dynamic action definitions
  // -------------------------------------------------------------------------

  private rebuildActionDefinitions(page: NavPage): void {
    const staticActions = getActionDefinitions(this)
    const navActions    = this.buildNavActions(page)
    const merged: CompanionActionDefinitions = { ...navActions, ...staticActions }
    this.setActionDefinitions(merged)
  }

  private buildNavActions(page: NavPage): CompanionActionDefinitions {
    const actions: CompanionActionDefinitions = {}
    for (const button of page.buttons) {
      const btn = button
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