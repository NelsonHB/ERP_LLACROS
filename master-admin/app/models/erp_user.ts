import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, computed } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

/**
 * Representa la tabla "users" del ERP,
 * administrada desde master-admin mediante la conexión "erp_db".
 */
export default class ErpUser extends compose(BaseModel, withAuthFinder(hash)) {
  static table = 'users'
  static connection = 'erp_db'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  /**
   * Tipo de cuenta:
   * trial  -> cuenta de prueba
   * rental -> cuenta de alquiler
   */
  @column()
  declare accountType: 'trial' | 'rental'

  /**
   * Fecha de expiración de la cuenta.
   * null = la cuenta no expira.
   */
  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Indica si la cuenta ya expiró.
   */
  @computed()
  get isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt <= DateTime.now()
  }
}