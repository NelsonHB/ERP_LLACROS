
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

type CustomerData = {
  document_type: string
  document_number: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

function validId(value: unknown): number | null {
  const raw = String(value ?? '')

  if (!/^[1-9]\d*$/.test(raw)) return null

  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

function validateCustomer(input: Record<string, unknown>): {
  data?: CustomerData
  error?: string
} {
  const documentType = String(
    input.documentType ?? ''
  ).trim().toUpperCase()

  const documentNumber = String(
    input.documentNumber ?? ''
  ).trim()

  const name = String(
    input.name ?? ''
  ).trim().replace(/\s+/g, ' ')

  const phone = String(
    input.phone ?? ''
  ).trim()

  const email = String(
    input.email ?? ''
  ).trim().toLowerCase()

  const address = String(
    input.address ?? ''
  ).trim()

  if (!['DNI', 'RUC'].includes(documentType)) {
    return { error: 'Selecciona DNI o RUC.' }
  }

  if (
    documentType === 'DNI' &&
    !/^\d{8}$/.test(documentNumber)
  ) {
    return {
      error: 'El DNI debe tener 8 dígitos.',
    }
  }

  if (
    documentType === 'RUC' &&
    !/^\d{11}$/.test(documentNumber)
  ) {
    return {
      error: 'El RUC debe tener 11 dígitos.',
    }
  }

  if (name.length < 2 || name.length > 150) {
    return {
      error: 'El nombre debe tener entre 2 y 150 caracteres.',
    }
  }

  if (
    !/^[\p{L}\p{M}\p{N}\s.,'&()/-]+$/u.test(name)
  ) {
    return {
      error: 'El nombre contiene caracteres no permitidos.',
    }
  }

  if (
    phone &&
    !/^\d{7,9}$/.test(phone)
  ) {
    return {
      error: 'El teléfono debe tener entre 7 y 9 números.',
    }
  }

  if (
    email &&
    (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
  ) {
    return {
      error: 'Ingresa un correo válido.',
    }
  }

  if (address.length > 255) {
    return {
      error: 'La dirección no debe superar 255 caracteres.',
    }
  }

  return {
    data: {
      document_type: documentType,
      document_number: documentNumber,
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    },
  }
}

function formatCustomer(customer: any) {
  return {
    id: customer.id,
    documentType: customer.document_type,
    documentNumber: customer.document_number,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    active: customer.active === true,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  }
}

function error500(
  response: HttpContext['response'],
  error: unknown,
  action: string
) {
  console.error(`[Customers] ${action}`, error)

  return response.internalServerError({
    success: false,
    message: 'No se pudo procesar la solicitud.',
  })
}

export default class CustomersController {

  // ========================================
  // BUSCAR CLIENTE PARA POS
  // GET /api/v1/customers/lookup
  // ========================================

  async lookup({ request, response }: HttpContext) {
    const type = String(
      request.input('documentType', '')
    ).trim().toUpperCase()

    const number = String(
      request.input('documentNumber', '')
    ).trim()

    const valid =
      (
        type === 'DNI' &&
        /^\d{8}$/.test(number)
      ) ||
      (
        type === 'RUC' &&
        /^\d{11}$/.test(number)
      )

    if (!valid) {
      return response.badRequest({
        success: false,
        message: 'Documento inválido.',
      })
    }

    try {
      const customer = await db
        .from('erp.customers')
        .select(
          'id',
          'name',
          'document_type',
          'document_number'
        )
        .where('document_type', type)
        .where('document_number', number)
        .where('active', true)
        .first()

      if (!customer) {
        return response.notFound({
          success: false,
          message:
            'Cliente no registrado o inactivo. Regístralo en Clientes.',
        })
      }

      return response.ok({
        success: true,
        data: {
          id: customer.id,
          name: customer.name,
          documentType: customer.document_type,
          documentNumber: customer.document_number,
        },
      })
    } catch (error) {
      return error500(response, error, 'lookup')
    }
  }

  // ========================================
  // LISTAR CLIENTES
  // GET /api/v1/customers
  // ========================================

  async index({ request, response }: HttpContext) {
    try {
      const search = String(
        request.input('search', '')
      ).trim().slice(0, 100)

      const status = String(
        request.input('status', 'all')
      )

      const rawPage = Number(
        request.input('page', 1)
      )

      const page =
        Number.isSafeInteger(rawPage) &&
        rawPage >= 1
          ? Math.min(rawPage, 100000)
          : 1

      const perPage = 10

      const query = db.from('erp.customers')

      if (search) {
        const pattern = `%${search}%`

        query.where((builder) => {
          builder
            .whereILike('name', pattern)
            .orWhereILike('document_number', pattern)
            .orWhereILike('phone', pattern)
            .orWhereILike('email', pattern)
        })
      }

      if (status === 'active') {
        query.where('active', true)
      }

      if (status === 'inactive') {
        query.where('active', false)
      }

      const countResult = await query
        .clone()
        .count('* as total')
        .first()

      const total = Number(
        countResult?.total ?? 0
      )

      const rows = await query
        .clone()
        .select(
          'id',
          'document_type',
          'document_number',
          'name',
          'phone',
          'email',
          'address',
          'active',
          'created_at',
          'updated_at'
        )
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(perPage)
        .offset((page - 1) * perPage)

      const statsResult = await db.rawQuery(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE active = TRUE
          )::int AS active,
          COUNT(*) FILTER (
            WHERE active = FALSE
          )::int AS inactive,
          COUNT(*) FILTER (
            WHERE document_type = 'RUC'
          )::int AS companies
        FROM erp.customers
      `)

      const stats = statsResult.rows[0]

      return response.ok({
        success: true,
        data: rows.map(formatCustomer),

        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.max(
            1,
            Math.ceil(total / perPage)
          ),
        },

        stats: {
          total: Number(stats.total),
          active: Number(stats.active),
          inactive: Number(stats.inactive),
          companies: Number(stats.companies),
        },
      })
    } catch (error) {
      return error500(response, error, 'index')
    }
  }

  // ========================================
  // VER CLIENTE
  // GET /api/v1/customers/:id
  // ========================================

  async show({ params, response }: HttpContext) {
    const id = validId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Identificador inválido.',
      })
    }

    try {
      const customer = await db
        .from('erp.customers')
        .where('id', id)
        .first()

      if (!customer) {
        return response.notFound({
          success: false,
          message: 'Cliente no encontrado.',
        })
      }

      return response.ok({
        success: true,
        data: formatCustomer(customer),
      })
    } catch (error) {
      return error500(response, error, 'show')
    }
  }

  // ========================================
  // CREAR CLIENTE
  // POST /api/v1/customers
  // ========================================

  async store({ request, response }: HttpContext) {
    const result = validateCustomer(
      request.body() as Record<string, unknown>
    )

    if (!result.data) {
      return response.unprocessableEntity({
        success: false,
        message: result.error,
      })
    }

    try {
      const duplicate = await db
        .from('erp.customers')
        .where(
          'document_number',
          result.data.document_number
        )
        .first()

      if (duplicate) {
        return response.conflict({
          success: false,
          message: 'Este documento ya está registrado.',
        })
      }

      const [created] = await db
        .table('erp.customers')
        .insert({
          ...result.data,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      const customer = await db
        .from('erp.customers')
        .where('id', created.id)
        .first()

      return response.created({
        success: true,
        message: 'Cliente registrado correctamente.',
        data: formatCustomer(customer),
      })
    } catch (error) {
      if ((error as any)?.code === '23505') {
        return response.conflict({
          success: false,
          message: 'Documento duplicado.',
        })
      }

      return error500(response, error, 'store')
    }
  }

  // ========================================
  // EDITAR CLIENTE
  // PUT /api/v1/customers/:id
  // ========================================

  async update({
    params,
    request,
    response,
  }: HttpContext) {
    const id = validId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Identificador inválido.',
      })
    }

    const result = validateCustomer(
      request.body() as Record<string, unknown>
    )

    if (!result.data) {
      return response.unprocessableEntity({
        success: false,
        message: result.error,
      })
    }

    try {
      const current = await db
        .from('erp.customers')
        .where('id', id)
        .first()

      if (!current) {
        return response.notFound({
          success: false,
          message: 'Cliente no encontrado.',
        })
      }

      const duplicate = await db
        .from('erp.customers')
        .where(
          'document_number',
          result.data.document_number
        )
        .whereNot('id', id)
        .first()

      if (duplicate) {
        return response.conflict({
          success: false,
          message: 'Ese documento pertenece a otro cliente.',
        })
      }

      await db
        .from('erp.customers')
        .where('id', id)
        .update({
          ...result.data,
          updated_at: new Date(),
        })

      const customer = await db
        .from('erp.customers')
        .where('id', id)
        .first()

      return response.ok({
        success: true,
        message: 'Cliente actualizado correctamente.',
        data: formatCustomer(customer),
      })
    } catch (error) {
      if ((error as any)?.code === '23505') {
        return response.conflict({
          success: false,
          message: 'Documento duplicado.',
        })
      }

      return error500(response, error, 'update')
    }
  }

  // ========================================
  // ACTIVAR / DESACTIVAR
  // PATCH /api/v1/customers/:id/status
  // ========================================

  async changeStatus({
    params,
    request,
    response,
  }: HttpContext) {
    const id = validId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Identificador inválido.',
      })
    }

    const active = request.input('active')

    if (typeof active !== 'boolean') {
      return response.unprocessableEntity({
        success: false,
        message: 'Estado inválido.',
      })
    }

    try {
      const updated = await db
        .from('erp.customers')
        .where('id', id)
        .update({
          active,
          updated_at: new Date(),
        })
        .returning('id')

      if (!updated.length) {
        return response.notFound({
          success: false,
          message: 'Cliente no encontrado.',
        })
      }

      return response.ok({
        success: true,
        message: active
          ? 'Cliente activado correctamente.'
          : 'Cliente desactivado correctamente.',
      })
    } catch (error) {
      return error500(response, error, 'changeStatus')
    }
  }

  // ========================================
  // ELIMINACIÓN LÓGICA
  // DELETE /api/v1/customers/:id
  // ========================================

  async destroy({ params, response }: HttpContext) {
    const id = validId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Identificador inválido.',
      })
    }

    try {
      const updated = await db
        .from('erp.customers')
        .where('id', id)
        .update({
          active: false,
          updated_at: new Date(),
        })
        .returning('id')

      if (!updated.length) {
        return response.notFound({
          success: false,
          message: 'Cliente no encontrado.',
        })
      }

      return response.ok({
        success: true,
        message: 'Cliente desactivado correctamente.',
      })
    } catch (error) {
      return error500(response, error, 'destroy')
    }
  }
}
