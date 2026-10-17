
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sales'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('sale_number', 50).notNullable().unique()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table
        .integer('customer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('customers')
        .onDelete('SET NULL')

      table.string('document_type', 20).notNullable()
      table.string('document_number', 50).nullable()

      table.decimal('subtotal', 12, 2).notNullable()
      table.decimal('igv', 12, 2).notNullable()
      table.decimal('total', 12, 2).notNullable()

      table.string('status', 30).notNullable().defaultTo('completed')

      table.timestamp('sold_at').notNullable().defaultTo(this.now())
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.index(['sold_at'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
