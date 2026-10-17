
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('description').nullable()
      table.string('brand', 100).nullable()
      table.string('unit', 30).notNullable().defaultTo('unidad')
      table.integer('minimum_stock').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('description')
      table.dropColumn('brand')
      table.dropColumn('unit')
      table.dropColumn('minimum_stock')
    })
  }
}
