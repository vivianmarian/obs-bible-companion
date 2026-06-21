/**
 * companion/config.ts
 *
 * Defines the configuration fields shown to the operator when they add
 * or edit this connection in Bitfocus Companion's web UI.
 *
 * Only two fields are needed: the RelayServer's host and port. Both have
 * sensible defaults matching config.ts in the rest of the project, so a
 * typical single-machine church setup works with zero changes.
 */

import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export function getConfigFields(): SomeCompanionConfigField[] {
  return [
    {
      type: 'static-text',
      id: 'info',
      width: 12,
      label: 'OBS Bible Companion',
      value:
        'Connects to the OBS Bible Companion RelayServer. ' +
        'Leave the defaults unless you changed the port via OBS_BIBLE_PORT, ' +
        'or are running the relay on a different machine.',
    },
    {
      type: 'textinput',
      id: 'relayHost',
      label: 'Relay Host',
      width: 6,
      default: '127.0.0.1',
      regex: Regex.HOSTNAME,
    },
    {
      type: 'number',
      id: 'relayPort',
      label: 'Relay Port',
      width: 6,
      default: 8765,
      min: 1,
      max: 65535,
      step: 1,
    },
  ]
}