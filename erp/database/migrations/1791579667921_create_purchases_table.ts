
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'purchases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('purchase_number', 50).notNullable().unique()

      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('RESTRICT')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.string('document_type', 30).nullable()
      table.string('document_number', 50).nullable()

      table.decimal('subtotal', 12, 2).notNullable()
      table.decimal('igv', 12, 2).notNullable().defaultTo(0)
      table.decimal('total', 12, 2).notNullable()

      table.string('status', 30).notNullable().defaultTo('registered')
      table.text('notes').nullable()

      table.timestamp('purchased_at').notNullable().defaultTo(this.now())
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.index(['supplier_id'])
      table.index(['purchased_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
