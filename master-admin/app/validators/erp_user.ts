import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)

const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Tipo de cuenta del usuario del ERP.
 */
const accountType = () => vine.enum(['trial', 'rental'] as const)

/**
 * Días de vigencia de la cuenta.
 * 1 día como mínimo y 3650 días como máximo.
 */
const durationDays = () => vine.number().min(1).max(3650)

/**
 * Crear usuario del ERP.
 *
 * La contraseña es obligatoria.
 * accountType y durationDays son opcionales:
 * - accountType: trial
 * - durationDays: 30 días
 */
export const createErpUserValidator = vine.create({
  fullName: vine.string().nullable(),

  email: email().unique({
    connection: 'erp_db',
    table: 'users',
    column: 'email',
  }),

  password: password(),

  accountType: accountType().optional(),

  durationDays: durationDays().optional(),
})

/**
 * Actualizar usuario del ERP.
 *
 * Todos los campos son opcionales.
 * Solo se actualizan los campos enviados.
 *
 * Si se envía durationDays, el controlador debe utilizarlo
 * para calcular una nueva fecha de expiración.
 */
export const updateErpUserValidator = vine.create({
  fullName: vine.string().nullable().optional(),

  email: email()
    .unique({
      connection: 'erp_db',
      table: 'users',
      column: 'email',
      filter: (query, _value, field) => {
        const userId = field.meta?.userId

        if (userId) {
          query.whereNot('id', userId as number)
        }
      },
    })
    .optional(),

  password: password().optional(),

  accountType: accountType().optional(),

  durationDays: durationDays().optional(),
})

/**
 * Restablecer la contraseña de un usuario del ERP.
 *
 * Además de la contraseña nueva, exige la contraseña ACTUAL del
 * admin que hace el cambio (re-autenticación). Esto evita que un
 * script que solo consiguió el token de sesión (robado por XSS,
 * pegado en la consola, etc.) pueda resetear contraseñas sin más:
 * la contraseña del admin no vive en el navegador, solo la sabe
 * la persona.
 */
export const resetErpUserPasswordValidator = vine.create({
  password: password(),
  currentPassword: vine.string().minLength(1),
})