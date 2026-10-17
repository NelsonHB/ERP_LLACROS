
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('code', 50).notNullable().unique()
      table.string('name', 200).notNullable()
      table.string('category', 100).notNullable()

      table.decimal('price', 12, 2).notNullable()
      table.decimal('cost', 12, 2).notNullable().defaultTo(0)

      table.integer('stock').notNullable().defaultTo(0)
      table.boolean('active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.index(['category'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
