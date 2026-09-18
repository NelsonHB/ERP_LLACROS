import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

/**
 * NOTA: la ruta pública de este controlador (POST /api/v1/auth/signup)
 * está deshabilitada a propósito en start/routes.ts. Los usuarios que
 * pueden operar el ERP se crean únicamente desde master-admin, no aquí.
 * Se deja el controlador listo para cuando se conecte la autenticación
 * compartida entre master-admin y erp (master-admin llamará a este
 * método internamente, o erp validará los tokens emitidos por
 * master-admin en vez de tener su propia tabla de usuarios).
 */

export default class NewAccountController {
  async store({ request, serialize }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)

    const user = await User.create({ fullName, email, password })
    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '30 days',
    })

    return serialize({
      user: UserTransformer.transform(user),
      token: token.value!.release(),
    })
  }
}
