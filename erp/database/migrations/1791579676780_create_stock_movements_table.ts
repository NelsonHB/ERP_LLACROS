
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.string('movement_type', 30).notNullable()
      table.string('reference_type', 30).nullable()
      table.integer('reference_id').nullable()

      table.integer('quantity').notNullable()
      table.integer('stock_before').notNullable()
      table.integer('stock_after').notNullable()

      table.text('notes').nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['product_id'])
      table.index(['reference_type', 'reference_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
