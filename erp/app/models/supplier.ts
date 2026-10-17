
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Supplier extends BaseModel {
  static table = 'suppliers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare documentType: string

  @column()
  declare documentNumber: string

  @column()
  declare businessName: string

  @column()
  declare contactName: string | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column()
  declare address: string | null

  @column()
  declare notes: string | null

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
