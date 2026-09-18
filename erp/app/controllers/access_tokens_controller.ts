import User from '#models/user'
import { DateTime } from 'luxon'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

export default class AccessTokensController {
  async store({ request, response, serialize }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)

    // Bloquear cuentas que ya hayan expirado.
    // Si expiresAt es null, la cuenta no expira.
    if (user.expiresAt && user.expiresAt <= DateTime.now()) {
      return response.forbidden({
        errors: [
          {
            message:
              'Tu cuenta ha expirado. Contacta al administrador para renovarla.',
          },
        ],
      })
    }

    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '30 days',
    })

    return serialize({
      user: UserTransformer.transform(user),
      token: token.value!.release(),
    })
  }

  async destroy({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.currentAccessToken) {
      await User.accessTokens.delete(
        user,
        user.currentAccessToken.identifier
      )
    }

    return {
      message: 'Logged out successfully',
    }
  }
}