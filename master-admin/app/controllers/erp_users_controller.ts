import { DateTime } from 'luxon'
import User from '#models/user'
import ErpUser from '#models/erp_user'
import type { HttpContext } from '@adonisjs/core/http'
import {
  createErpUserValidator,
  updateErpUserValidator,
  resetErpUserPasswordValidator,
} from '#validators/erp_user'

/**
 * Duración por defecto de una cuenta.
 */
const DEFAULT_DURATION_DAYS = 30

/**
 * Serializa un usuario del ERP para evitar devolver información
 * sensible como la contraseña.
 */
function serializeErpUser(user: ErpUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    accountType: user.accountType,
    expiresAt: user.expiresAt,
    isExpired: user.isExpired,
    createdAt: user.createdAt,
  }
}

export default class ErpUsersController {
  /**
   * GET /api/v1/erp-users
   *
   * Lista todos los usuarios del ERP,
   * mostrando primero los más recientes.
   */
  async index() {
    const users = await ErpUser.query().orderBy('createdAt', 'desc')

    return {
      data: users.map(serializeErpUser),
    }
  }

  /**
   * GET /api/v1/erp-users/:id
   *
   * Obtiene un usuario específico.
   */
  async show({ params, response }: HttpContext) {
    const user = await ErpUser.find(params.id)

    if (!user) {
      return response.notFound({
        errors: [{ message: 'Usuario no encontrado' }],
      })
    }

    return {
      data: serializeErpUser(user),
    }
  }

  /**
   * POST /api/v1/erp-users
   *
   * Crea una cuenta nueva del ERP.
   *
   * accountType:
   *   trial  -> cuenta de prueba
   *   rental -> cuenta de alquiler
   *
   * durationDays:
   *   duración en días.
   *
   * Valores por defecto:
   *   accountType = trial
   *   durationDays = 30
   */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createErpUserValidator)

    const accountType = payload.accountType ?? 'trial'
    const durationDays = payload.durationDays ?? DEFAULT_DURATION_DAYS

    const user = await ErpUser.create({
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      accountType,
      expiresAt: DateTime.now().plus({
        days: durationDays,
      }),
    })

    return response.created({
      data: serializeErpUser(user),
    })
  }

  /**
   * PUT /api/v1/erp-users/:id
   *
   * Actualiza los datos enviados.
   *
   * Si se envía durationDays, se renueva la cuenta
   * desde la fecha actual.
   */
  async update({ params, request, response }: HttpContext) {
    const user = await ErpUser.find(params.id)

    if (!user) {
      return response.notFound({
        errors: [{ message: 'Usuario no encontrado' }],
      })
    }

    const payload = await request.validateUsing(updateErpUserValidator, {
      meta: {
        userId: user.id,
      },
    })

    if (payload.fullName !== undefined) {
      user.fullName = payload.fullName
    }

    if (payload.email !== undefined) {
      user.email = payload.email
    }

    if (payload.password !== undefined) {
      user.password = payload.password
    }

    if (payload.accountType !== undefined) {
      user.accountType = payload.accountType
    }

    if (payload.durationDays !== undefined) {
      user.expiresAt = DateTime.now().plus({
        days: payload.durationDays,
      })
    }

    await user.save()

    return {
      data: serializeErpUser(user),
    }
  }

  /**
   * PATCH /api/v1/erp-users/:id/reset-password
   *
   * Cambia únicamente la contraseña.
   */
  async resetPassword({ params, request, response }: HttpContext) {
    const user = await ErpUser.find(params.id)

    if (!user) {
      return response.notFound({
        errors: [{ message: 'Usuario no encontrado' }],
      })
    }

    const payload = await request.validateUsing(
      resetErpUserPasswordValidator
    )

    user.password = payload.password

    await user.save()

    return {
      data: {
        id: user.id,
        message: 'Contraseña actualizada correctamente',
      },
    }
  }

  /**
   * DELETE /api/v1/erp-users/:id
   */
  async destroy({ params, response }: HttpContext) {
    const user = await ErpUser.find(params.id)

    if (!user) {
      return response.notFound({
        errors: [{ message: 'Usuario no encontrado' }],
      })
    }

    await user.delete()

    return response.noContent()
  }

  async resetPassword({ params, request, response, auth }: HttpContext) {
    const user = await ErpUser.find(params.id)

    if (!user) {
      return response.notFound({
        errors: [{ message: 'Usuario no encontrado' }],
      })
    }

    const payload = await request.validateUsing(
      resetErpUserPasswordValidator
    )

    const admin = auth.getUserOrFail()

    try {
      // Re-verifica la contraseña del admin autenticado contra su
      // propio registro. Si no coincide, verifyCredentials lanza
      // E_INVALID_CREDENTIALS.
      await User.verifyCredentials(admin.email, payload.currentPassword)
    } catch {
      return response.unauthorized({
        errors: [{ message: 'Tu contraseña actual no es correcta.' }],
      })
    }

    user.password = payload.password

    await user.save()

    return {
      data: {
        id: user.id,
        message: 'Contraseña actualizada correctamente',
      },
    }
  }

}