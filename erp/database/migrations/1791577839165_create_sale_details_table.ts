
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sale_details'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('sale_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('sales')
        .onDelete('CASCADE')

      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      table.string('product_code', 50).notNullable()
      table.string('product_name', 200).notNullable()
      table.string('category', 100).notNullable()

      table.integer('quantity').notNullable()

      table.decimal('unit_price', 12, 2).notNullable()
      table.decimal('unit_cost', 12, 2).notNullable()

      table.decimal('subtotal', 12, 2).notNullable()

      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['sale_id'])
      table.index(['product_id'])
      table.index(['category'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
