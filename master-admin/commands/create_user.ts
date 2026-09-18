import { errors } from '@vinejs/vine'
import { flags, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Crea una cuenta de administrador desde la terminal, sin pasar por HTTP.
 *
 * Reutiliza el mismo "signupValidator" que usa el registro público, así
 * que aplica exactamente las mismas reglas (correo único, contraseña de
 * 8 a 32 caracteres, etc). La contraseña se hashea automáticamente al
 * guardar el modelo (scrypt), igual que en el registro normal.
 *
 * Uso interactivo (recomendado, no deja la contraseña en el historial
 * de la terminal ni en los logs de Docker):
 *   node ace user:create
 *
 * Uso no interactivo (útil para scripts/automatización):
 *   node ace user:create --full-name="Harold Prueba" --email="harold@correo.com" --password="pruebas123"
 */
export default class CreateUser extends BaseCommand {
  static commandName = 'user:create'
  static description = 'Crea una cuenta de usuario (uso: administradores del sistema)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Nombre completo' })
  declare fullName?: string

  @flags.string({ description: 'Correo electrónico' })
  declare email?: string

  @flags.string({ description: 'Contraseña (si se omite, se pide de forma oculta)' })
  declare password?: string

  async run() {
    // Importaciones diferidas a propósito: si el modelo User o el
    // validador se importan arriba, a nivel de archivo, Ace falla al
    // leer los metadatos del comando (pasa antes de que la app termine
    // de arrancar y de que Lucid/Hash registren sus servicios).
    const { default: User } = await import('#models/user')
    const { signupValidator } = await import('#validators/user')

    const fullName = this.fullName ?? (await this.prompt.ask('Nombre completo'))
    const email = this.email ?? (await this.prompt.ask('Correo electrónico'))
    const password = this.password ?? (await this.prompt.secure('Contraseña (mínimo 8 caracteres)'))
    const passwordConfirmation =
      this.password ?? (await this.prompt.secure('Confirma la contraseña'))

    try {
      const payload = await signupValidator.validate({
        fullName,
        email,
        password,
        passwordConfirmation,
      })

      const user = await User.create({
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
      })

      this.logger.success(`Cuenta creada: ${user.email} (id ${user.id})`)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        this.logger.error('No se pudo crear la cuenta:')
        for (const message of error.messages) {
          this.logger.error(`  - ${message.field}: ${message.message}`)
        }
        this.exitCode = 1
        return
      }
      throw error
    }
  }
}