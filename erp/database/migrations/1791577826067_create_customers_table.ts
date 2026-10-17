
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('document_type', 20).nullable()
      table.string('document_number', 20).nullable()

      table.string('name', 200).notNullable()
      table.string('phone', 30).nullable()
      table.string('email', 254).nullable()
      table.string('address', 255).nullable()

      table.boolean('active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.unique(['document_type', 'document_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
