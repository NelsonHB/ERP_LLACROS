
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare category: string

  @column()
  declare price: number

  @column()
  declare cost: number

  @column()
  declare stock: number

  @column()
  declare active: boolean

  @column()
  declare description: string | null

  @column()
  declare brand: string | null

  @column()
  declare unit: string

  @column()
  declare minimumStock: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
