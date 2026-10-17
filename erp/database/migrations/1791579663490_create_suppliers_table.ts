
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('document_type', 20).notNullable().defaultTo('RUC')
      table.string('document_number', 20).notNullable().unique()

      table.string('business_name', 200).notNullable()
      table.string('contact_name', 150).nullable()

      table.string('phone', 30).nullable()
      table.string('email', 254).nullable()
      table.string('address', 255).nullable()

      table.string('notes', 500).nullable()
      table.boolean('active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
