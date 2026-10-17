import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

// ============================================
// EZCUDO360 - API PROVEEDORES
// Tabla real: erp.suppliers
// ============================================

const BUSINESS_REGEX = /^[\p{L}\p{M}\p{N} .,&()'°º\/-]+$/u
const CONTACT_REGEX = /^[\p{L}\p{M} .'-]+$/u
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

type SupplierInput = {
  businessName: string
  tradeName: string | null
  documentType: 'RUC' | 'DNI'
  documentNumber: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
}

type ValidationErrors = Record<string, string>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | null {
  // Dirección y observaciones no tienen límite de caracteres extra.
  return text(value) || null
}

function parseId(value: unknown): number | null {
  const raw = String(value ?? '')
  if (!/^[1-9]\d*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

function readBody(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function validate(body: Record<string, unknown>) {
  const errors: ValidationErrors = {}

  const businessName = text(body.businessName)
  const tradeName = optionalText(body.tradeName)
  const documentTypeRaw = text(body.documentType).toUpperCase()
  const documentNumber = text(body.documentNumber)
  const contactName = optionalText(body.contactName)
  const phone = optionalText(body.phone)
  const email = optionalText(body.email)?.toLowerCase() ?? null
  const address = optionalText(body.address)
  const notes = optionalText(body.notes)

  if (businessName.length < 2 || businessName.length > 150 ||
      !BUSINESS_REGEX.test(businessName)) {
    errors.businessName = 'La razón social o nombre debe tener de 2 a 150 caracteres y no incluir símbolos especiales.'
  }

  if (tradeName && (tradeName.length > 150 || !BUSINESS_REGEX.test(tradeName))) {
    errors.tradeName = 'El nombre comercial no puede tener símbolos especiales ni superar 150 caracteres.'
  }

  if (documentTypeRaw !== 'RUC' && documentTypeRaw !== 'DNI') {
    errors.documentType = 'Selecciona RUC o DNI.'
  } else if (documentTypeRaw === 'RUC' && !/^\d{11}$/.test(documentNumber)) {
    errors.documentNumber = 'El RUC debe contener exactamente 11 números.'
  } else if (documentTypeRaw === 'DNI' && !/^\d{8}$/.test(documentNumber)) {
    errors.documentNumber = 'El DNI debe contener exactamente 8 números.'
  }

  if (contactName && (contactName.length > 120 || !CONTACT_REGEX.test(contactName))) {
    errors.contactName = 'El contacto solo admite letras, espacios y puntuación básica (máximo 120 caracteres).'
  }

  if (phone && !/^\d{1,9}$/.test(phone)) {
    errors.phone = 'El teléfono solo puede contener números, máximo 9 dígitos.'
  }

  if (email && (email.length > 150 || !EMAIL_REGEX.test(email))) {
    errors.email = 'Ingresa un correo válido como ventas@empresa.com.'
  }

  if (body.active !== undefined && typeof body.active !== 'boolean') {
    errors.active = 'Estado inválido.'
  }

  const data: SupplierInput = {
    businessName,
    tradeName,
    documentType: documentTypeRaw as 'RUC' | 'DNI',
    documentNumber,
    contactName,
    phone,
    email,
    address,
    notes,
    active: typeof body.active === 'boolean' ? body.active : true,
  }

  return { data, errors }
}

function dbFields(data: SupplierInput) {
  return {
    business_name: data.businessName,
    trade_name: data.tradeName,
    document_type: data.documentType,
    document_number: data.documentNumber,
    contact_name: data.contactName,
    phone: data.phone,
    email: data.email,
    address: data.address,
    notes: data.notes,
    active: data.active,
  }
}

function serialize(row: Record<string, any>) {
  return {
    id: row.id,
    businessName: row.business_name,
    tradeName: row.trade_name,
    documentType: row.document_type,
    documentNumber: row.document_number,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === '23505'
}

export default class SuppliersController {
  // GET /api/v1/suppliers
  async index({ response }: HttpContext) {
    try {
      const rows = await db.from('erp.suppliers').select('*').orderBy('id', 'desc')
      return response.ok({ success: true, data: rows.map(serialize) })
    } catch (error) {
      console.error('[Suppliers] index', error)
      return response.internalServerError({ success: false, message: 'No se pudieron cargar los proveedores.' })
    }
  }

  // GET /api/v1/suppliers/:id
  async show({ params, response }: HttpContext) {
    const id = parseId(params.id)
    if (id === null) return response.badRequest({ success: false, message: 'ID inválido.' })

    try {
      const row = await db.from('erp.suppliers').where('id', id).first()
      if (!row) return response.notFound({ success: false, message: 'Proveedor no encontrado.' })
      return response.ok({ success: true, data: serialize(row) })
    } catch (error) {
      console.error('[Suppliers] show', error)
      return response.internalServerError({ success: false, message: 'No se pudo consultar el proveedor.' })
    }
  }

  // POST /api/v1/suppliers
  async store({ request, response }: HttpContext) {
    const { data, errors } = validate(readBody(request.body()))
    if (Object.keys(errors).length) {
      return response.status(422).send({ success: false, message: 'Revisa los campos indicados.', errors })
    }

    try {
      const duplicate = await db.from('erp.suppliers')
        .where('document_number', data.documentNumber).first()
      if (duplicate) {
        return response.status(409).send({
          success: false,
          message: 'Ya existe un proveedor con ese documento.',
          errors: { documentNumber: 'Ese documento ya está registrado.' },
        })
      }

      const [created] = await db.table('erp.suppliers')
        .insert({ ...dbFields(data), created_at: new Date(), updated_at: new Date() })
        .returning('*')

      return response.created({ success: true, message: 'Proveedor registrado correctamente.', data: serialize(created) })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(409).send({
          success: false,
          message: 'Ya existe un proveedor con ese documento.',
          errors: { documentNumber: 'Ese documento ya está registrado.' },
        })
      }
      console.error('[Suppliers] store', error)
      return response.internalServerError({ success: false, message: 'No se pudo registrar el proveedor.' })
    }
  }

  // PUT /api/v1/suppliers/:id
  async update({ params, request, response }: HttpContext) {
    const id = parseId(params.id)
    if (id === null) return response.badRequest({ success: false, message: 'ID inválido.' })

    const { data, errors } = validate(readBody(request.body()))
    if (Object.keys(errors).length) {
      return response.status(422).send({ success: false, message: 'Revisa los campos indicados.', errors })
    }

    try {
      const found = await db.from('erp.suppliers').where('id', id).first()
      if (!found) return response.notFound({ success: false, message: 'Proveedor no encontrado.' })

      const duplicate = await db.from('erp.suppliers')
        .where('document_number', data.documentNumber)
        .whereNot('id', id).first()
      if (duplicate) {
        return response.status(409).send({
          success: false,
          message: 'El documento pertenece a otro proveedor.',
          errors: { documentNumber: 'Ese documento ya está registrado.' },
        })
      }

      const [updated] = await db.from('erp.suppliers').where('id', id)
        .update({ ...dbFields(data), updated_at: new Date() }).returning('*')

      return response.ok({ success: true, message: 'Proveedor actualizado correctamente.', data: serialize(updated) })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(409).send({
          success: false,
          message: 'Ese documento ya está registrado.',
          errors: { documentNumber: 'Ese documento ya está registrado.' },
        })
      }
      console.error('[Suppliers] update', error)
      return response.internalServerError({ success: false, message: 'No se pudo actualizar el proveedor.' })
    }
  }

  // DELETE /api/v1/suppliers/:id  -> BAJA LÓGICA
  async destroy({ params, response }: HttpContext) {
    const id = parseId(params.id)
    if (id === null) return response.badRequest({ success: false, message: 'ID inválido.' })

    try {
      const [updated] = await db.from('erp.suppliers').where('id', id)
        .update({ active: false, updated_at: new Date() }).returning('*')
      if (!updated) return response.notFound({ success: false, message: 'Proveedor no encontrado.' })
      return response.ok({ success: true, message: 'Proveedor desactivado.', data: serialize(updated) })
    } catch (error) {
      console.error('[Suppliers] destroy', error)
      return response.internalServerError({ success: false, message: 'No se pudo desactivar el proveedor.' })
    }
  }
}
