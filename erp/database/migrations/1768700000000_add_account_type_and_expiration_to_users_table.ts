import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // 'trial' -> cuenta de prueba
      // 'rental' -> cuenta de alquiler
      table.string('account_type', 20).notNullable().defaultTo('trial')

      // Fecha en la que la cuenta deja de poder iniciar sesión.
      // Nullable: si es null, la cuenta no expira (ej. cuentas internas).
      table.timestamp('expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('account_type')
      table.dropColumn('expires_at')
    })
  }
}
