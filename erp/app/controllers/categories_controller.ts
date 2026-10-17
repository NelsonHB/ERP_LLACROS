import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

// ============================================
// EZCUDO360 - CATEGORÍAS DE PRODUCTOS
// Tabla: erp.product_categories
// No crea tablas ni modifica productos existentes.
// ============================================

type CategoryFields = {
  name: string
  description: string | null
  active: boolean
}

type FieldErrors = Record<string, string>

const NAME_REGEX = /^[\p{L}\p{M}\p{N} .,&()'°º\/-]+$/u

function bodyObject(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

function positiveId(value: unknown): number | null {
  const input = String(value ?? '')
  if (!/^[1-9]\d*$/.test(input)) return null
  const parsed = Number(input)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function validate(raw: Record<string, unknown>): { data: CategoryFields; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const name = normalizeName(raw.name)
  const description = typeof raw.description === 'string'
    ? raw.description.trim() || null
    : null

  if (name.length < 2 || name.length > 100 || !NAME_REGEX.test(name)) {
    errors.name = 'El nombre debe tener de 2 a 100 caracteres, sin símbolos especiales.'
  }
  if (raw.description !== undefined && raw.description !== null && typeof raw.description !== 'string') {
    errors.description = 'La descripción debe ser un texto.'
  }
  if (raw.name !== undefined && typeof raw.name !== 'string') {
    errors.name = 'El nombre de la categoría debe ser un texto.'
  }
  if (raw.active !== undefined && typeof raw.active !== 'boolean') {
    errors.active = 'El estado debe ser activo o inactivo.'
  }

  return {
    data: {
      name,
      description,
      active: typeof raw.active === 'boolean' ? raw.active : true,
    },
    errors,
  }
}

function format(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active === true,
    productCount: Number(row.product_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function uniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === '23505'
}

function validationError(response: HttpContext['response'], errors: FieldErrors) {
  return response.status(422).send({
    success: false,
    message: 'Revisa los campos señalados.',
    errors,
  })
}

async function existingName(name: string, exceptId?: number) {
  const query = db.from('erp.product_categories')
    .whereRaw('LOWER(TRIM(name)) = LOWER(?)', [name])
  if (exceptId !== undefined) query.whereNot('id', exceptId)
  return query.first()
}

export default class CategoriesController {
  // GET /api/v1/categories
  // Incluye las inactivas para poder reactivarlas.
  async index({ response }: HttpContext) {
    try {
      const rows = await db.from('erp.product_categories as c')
        .leftJoin('erp.products as p', 'p.category_id', 'c.id')
        .select(
          'c.id', 'c.name', 'c.description', 'c.active',
          'c.created_at', 'c.updated_at'
        )
        .count('p.id as product_count')
        .groupBy(
          'c.id', 'c.name', 'c.description', 'c.active',
          'c.created_at', 'c.updated_at'
        )
        .orderBy('c.name', 'asc')

      return response.ok({ success: true, data: rows.map(format) })
    } catch (error) {
      console.error('[Categories] index:', error)
      return response.internalServerError({
        success: false,
        message: 'No se pudieron cargar las categorías.',
      })
    }
  }

  // GET /api/v1/categories/:id
  async show({ params, response }: HttpContext) {
    const id = positiveId(params.id)
    if (id === null) {
      return response.badRequest({ success: false, message: 'Identificador inválido.' })
    }
    try {
      const row = await db.from('erp.product_categories as c')
        .leftJoin('erp.products as p', 'p.category_id', 'c.id')
        .select('c.id', 'c.name', 'c.description', 'c.active', 'c.created_at', 'c.updated_at')
        .count('p.id as product_count')
        .where('c.id', id)
        .groupBy('c.id', 'c.name', 'c.description', 'c.active', 'c.created_at', 'c.updated_at')
        .first()

      if (!row) {
        return response.notFound({ success: false, message: 'Categoría no encontrada.' })
      }
      return response.ok({ success: true, data: format(row) })
    } catch (error) {
      console.error('[Categories] show:', error)
      return response.internalServerError({ success: false, message: 'No se pudo consultar la categoría.' })
    }
  }

  // POST /api/v1/categories
  async store({ request, response }: HttpContext) {
    const { data, errors } = validate(bodyObject(request.body()))
    if (Object.keys(errors).length) return validationError(response, errors)

    try {
      if (await existingName(data.name)) {
        return response.status(409).send({
          success: false,
          message: 'Ya existe una categoría con ese nombre.',
          errors: { name: 'Ese nombre ya está registrado, incluso si la categoría está inactiva.' },
        })
      }

      const [row] = await db.table('erp.product_categories')
        .insert({
          name: data.name,
          description: data.description,
          active: data.active,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*')

      return response.created({
        success: true,
        message: 'Categoría creada correctamente.',
        data: format(row),
      })
    } catch (error) {
      if (uniqueViolation(error)) {
        return response.status(409).send({
          success: false,
          message: 'Ya existe una categoría con ese nombre.',
          errors: { name: 'Nombre duplicado.' },
        })
      }
      console.error('[Categories] store:', error)
      return response.internalServerError({ success: false, message: 'No se pudo crear la categoría.' })
    }
  }

  // PUT /api/v1/categories/:id
  async update({ params, request, response }: HttpContext) {
    const id = positiveId(params.id)
    if (id === null) {
      return response.badRequest({ success: false, message: 'Identificador inválido.' })
    }

    const { data, errors } = validate(bodyObject(request.body()))
    if (Object.keys(errors).length) return validationError(response, errors)

    try {
      const previous = await db.from('erp.product_categories').where('id', id).first()
      if (!previous) {
        return response.notFound({ success: false, message: 'Categoría no encontrada.' })
      }

      if (await existingName(data.name, id)) {
        return response.status(409).send({
          success: false,
          message: 'Ya existe una categoría con ese nombre.',
          errors: { name: 'Ese nombre pertenece a otra categoría.' },
        })
      }

      const [row] = await db.from('erp.product_categories')
        .where('id', id)
        .update({
          name: data.name,
          description: data.description,
          active: data.active,
          updated_at: new Date(),
        })
        .returning('*')

      return response.ok({
        success: true,
        message: 'Categoría actualizada correctamente.',
        data: format(row),
      })
    } catch (error) {
      if (uniqueViolation(error)) {
        return response.status(409).send({
          success: false,
          message: 'El nombre ya está registrado.',
          errors: { name: 'Nombre duplicado.' },
        })
      }
      console.error('[Categories] update:', error)
      return response.internalServerError({ success: false, message: 'No se pudo actualizar la categoría.' })
    }
  }

  // DELETE /api/v1/categories/:id
  // Desactiva sin borrar los productos que ya tienen esta categoría.
  async destroy({ params, response }: HttpContext) {
    const id = positiveId(params.id)
    if (id === null) {
      return response.badRequest({ success: false, message: 'Identificador inválido.' })
    }

    try {
      const [row] = await db.from('erp.product_categories')
        .where('id', id)
        .update({ active: false, updated_at: new Date() })
        .returning('*')

      if (!row) {
        return response.notFound({ success: false, message: 'Categoría no encontrada.' })
      }

      return response.ok({
        success: true,
        message: 'Categoría desactivada. Los productos existentes conservan su categoría.',
        data: format(row),
      })
    } catch (error) {
      console.error('[Categories] destroy:', error)
      return response.internalServerError({ success: false, message: 'No se pudo desactivar la categoría.' })
    }
  }
}
