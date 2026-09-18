import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Elimina de la base de datos la "basura" que se acumula con el tiempo:
 *
 * 1. Tokens de acceso ya vencidos (expires_at en el pasado).
 * 2. Tokens nunca usados y con más de 30 días de antigüedad
 *    (sesiones que el usuario empezó y nunca completó).
 *
 * Pensado para correr periódicamente (cron / scheduler), no de forma manual.
 */
export default class CleanupExpiredTokens extends BaseCommand {
  static commandName = 'cleanup:expired-tokens'
  static description = 'Elimina tokens de acceso vencidos u olvidados'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
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
