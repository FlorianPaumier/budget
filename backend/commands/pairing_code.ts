import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { createPairingCode } from '../app/services/device_access.js'

export default class PairingCode extends BaseCommand {
  static commandName = 'pairing:code'
  static description = 'Create a single-use pairing code from the server terminal'
  static options: CommandOptions = { startApp: true }

  async run() {
    const households = await db.from('households').select('id').limit(2)
    if (households.length !== 1) {
      this.logger.error('Expected one existing household. Initialize the household first.')
      this.exitCode = 1
      return
    }
    this.logger.log(await createPairingCode(households[0].id))
    this.logger.info(
      'Paste this code into the browser pairing form within five minutes. One use only.'
    )
  }
}
