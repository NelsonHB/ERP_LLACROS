
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

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

      table.string('payment_method', 30).notNullable()

      table.decimal('amount', 12, 2).notNullable()
      table.decimal('received_amount', 12, 2).nullable()
      table.decimal('change_amount', 12, 2).nullable()

      table.string('reference', 100).nullable()

      table.timestamp('paid_at').notNullable().defaultTo(this.now())
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['sale_id'])
      table.index(['payment_method'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
