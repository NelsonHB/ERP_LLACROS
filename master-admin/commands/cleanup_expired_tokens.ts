import { DateTime } from 'luxon'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class CleanupExpiredTokens extends BaseCommand {
  static commandName = 'cleanup-expired-tokens'
  static description = 'Elimina tokens de acceso vencidos u olvidados'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')

    const now = DateTime.now().toSQL()
    const staleThreshold = DateTime.now().minus({ days: 30 }).toSQL()

    const expiredCount = await db
      .from('auth_access_tokens')
      .where('expires_at', '<', now)
      .whereNotNull('expires_at')
      .delete()

    const staleCount = await db
      .from('auth_access_tokens')
      .whereNull('last_used_at')
      .where('created_at', '<', staleThreshold)
      .delete()

    this.logger.success(
      `Limpieza completada: ${expiredCount} tokens vencidos, ${staleCount} tokens olvidados sin usar`
    )
  }
}