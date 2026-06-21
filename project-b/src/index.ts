/**
 * index.ts
 *
 * Bitfocus Companion v3 module entry point for OBS Bible Companion.
 *
 * This class:
 *   1. Connects to the RelayServer as ?client=companion (via WebSocketClient).
 *   2. Sends BridgeCommand messages when actions are triggered.
 *   3. Receives BridgeState updates and exposes them as Companion variables.
 *   4. Drives feedbacks (e.g. "is overlay visible") from the latest state.
 *
 * Uses InstanceBase + runEntrypoint per Companion v3 SDK (Decision 10).
 * Does NOT use the legacy v2 instance_skel API.
 */

import {
  InstanceBase,
  runEntrypoint,
  InstanceStatus,
  type SomeCompanionConfigField,
} from '@companion-module/base'

import { WebSocketClient } from './bridge/WebSocketClient.js'
import {
  DEFAULT_BRIDGE_STATE,
  type ModuleConfig,
  type BridgeState,
  type BridgeCommand,
} from './companion/types.js'
import { getConfigFields } from './companion/config.js'
import { getActionDefinitions } from './companion/actions.js'
import { getFeedbackDefinitions } from './companion/feedbacks.js'
import { getVariableDefinitions, getVariableValues } from './companion/variables.js'

export class ObsBibleCompanionInstance extends InstanceBase<ModuleConfig> {
  public config: ModuleConfig = { relayHost: '127.0.0.1', relayPort: 8765 }
  public state: BridgeState = { ...DEFAULT_BRIDGE_STATE }

  private client: WebSocketClient | null = null

  // ---------------------------------------------------------------------
  // Lifecycle — called by Companion
  // ---------------------------------------------------------------------

  async init(config: ModuleConfig): Promise<void> {
    this.config = config
    this.updateStatus(InstanceStatus.Connecting)

    this.setActionDefinitions(getActionDefinitions(this))
    this.setFeedbackDefinitions(getFeedbackDefinitions(this))
    this.setVariableDefinitions(getVariableDefinitions())
    this.setVariableValues(getVariableValues(this.state))

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

  // ---------------------------------------------------------------------
  // Relay connection management
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------

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
      typeof v.connected === 'boolean' &&
      (typeof v.currentReference === 'string' || v.currentReference === null) &&
      typeof v.currentTranslation === 'string' &&
      typeof v.overlayVisible === 'boolean' &&
      typeof v.currentVerseIndex === 'number'
    )
  }

  // ---------------------------------------------------------------------
  // Public API used by actions.ts
  // ---------------------------------------------------------------------

  public sendCommand(command: BridgeCommand): void {
    if (!this.client || !this.client.isOpen()) {
      this.log('warn', `Cannot send command, not connected: ${JSON.stringify(command)}`)
      return
    }
    this.client.send(JSON.stringify(command))
  }
}

runEntrypoint(ObsBibleCompanionInstance, [])