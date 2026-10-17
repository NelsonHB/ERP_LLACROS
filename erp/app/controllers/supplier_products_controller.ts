import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// EZCUDO360: Catálogo global + asociación N:M proveedores/productos.
// Tablas existentes: erp.suppliers, erp.products, erp.product_categories,
// erp.supplier_products y erp.product_images.
// IMPORTANTE: este módulo NO cambia products.stock ni products.sale_price.

type Input = Record<string, unknown>
type FieldErrors = Record<string, string>

const CODE_RE = /^[A-Za-z0-9._\/-]+$/
const BARCODE_RE = /^[A-Za-z0-9._\/-]+$/
const COST_RE = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/
const MAX_IMAGES = 8
const MAX_FILE_BYTES = 5 * 1024 * 1024

function bodyObject(value: unknown): Input {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Input
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | null {
  return text(value) || null
}

function positiveId(value: unknown): number | null {
  const raw = String(value ?? '')
  if (!/^[1-9]\d*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function booleanValue(value: unknown, errors: FieldErrors): boolean {
  if (value === undefined) return true
  if (typeof value !== 'boolean') {
    errors.active = 'El estado debe ser verdadero o falso.'
    return true
  }
  return value
}

function costValue(value: unknown, errors: FieldErrors): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') {
    errors.referenceCost = 'Ingresa un costo numérico válido.'
    return null
  }
  const raw = String(value).trim()
  if (!COST_RE.test(raw)) {
    errors.referenceCost = 'El costo debe ser positivo o cero, con máximo 2 decimales.'
    return null
  }
  return Number(raw).toFixed(2)
}

function linkData(body: Input) {
  const errors: FieldErrors = {}
  const supplierId = positiveId(body.supplierId)
  const productId = positiveId(body.productId)
  const supplierSku = optionalText(body.supplierSku)
  const referenceCost = costValue(body.referenceCost, errors)
  const active = booleanValue(body.active, errors)

  if (!supplierId) errors.supplierId = 'Selecciona un proveedor válido.'
  if (!productId) errors.productId = 'Selecciona un producto válido.'
  if (supplierSku && supplierSku.length > 100) {
    errors.supplierSku = 'El código del proveedor admite máximo 100 caracteres.'
  }
  return { supplierId, productId, supplierSku, referenceCost, active, errors }
}

function updateData(body: Input) {
  const errors: FieldErrors = {}
  const supplierSku = optionalText(body.supplierSku)
  const referenceCost = costValue(body.referenceCost, errors)
  const active = booleanValue(body.active, errors)

  if (supplierSku && supplierSku.length > 100) {
    errors.supplierSku = 'El código del proveedor admite máximo 100 caracteres.'
  }
  return { supplierSku, referenceCost, active, errors }
}

function newProductData(body: Input) {
  const errors: FieldErrors = {}
  const supplierId = positiveId(body.supplierId)
  const categoryId = body.categoryId === null || body.categoryId === undefined || body.categoryId === ''
    ? null
    : positiveId(body.categoryId)
  const code = text(body.code).toUpperCase()
  const barcode = optionalText(body.barcode)
  const name = text(body.name)
  const description = optionalText(body.description)
  const brand = optionalText(body.brand)
  const model = optionalText(body.model)
  const unit = text(body.unit).toUpperCase() || 'UNIDAD'
  const supplierSku = optionalText(body.supplierSku)
  const referenceCost = costValue(body.referenceCost, errors)

  if (!supplierId) errors.supplierId = 'Selecciona un proveedor válido.'
  if (body.categoryId !== null && body.categoryId !== undefined && body.categoryId !== '' && !categoryId) {
    errors.categoryId = 'Categoría inválida.'
  }
  if (!code || code.length > 50 || !CODE_RE.test(code)) {
    errors.code = 'Código obligatorio: máximo 50 caracteres (letras, números, guion, punto, barra o guion bajo).'
  }
  if (!name || name.length > 150) errors.name = 'Nombre obligatorio, máximo 150 caracteres.'
  if (barcode && (barcode.length > 100 || !BARCODE_RE.test(barcode))) {
    errors.barcode = 'Código de barras inválido o mayor a 100 caracteres.'
  }
  if (brand && brand.length > 100) errors.brand = 'Marca: máximo 100 caracteres.'
  if (model && model.length > 100) errors.model = 'Modelo: máximo 100 caracteres.'
  if (unit.length > 30 || !/^[\p{L}\p{N}._\/-]+$/u.test(unit)) {
    errors.unit = 'Unidad inválida (máximo 30 caracteres).'
  }
  if (supplierSku && supplierSku.length > 100) {
    errors.supplierSku = 'Código del proveedor: máximo 100 caracteres.'
  }
  if (body.active !== undefined && body.active !== true) {
    errors.active = 'Los productos nuevos se crean activos.'
  }

  return {
    supplierId, categoryId, code, barcode, name, description, brand, model,
    unit, supplierSku, referenceCost, errors,
  }
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '23505'
}

function reject(response: HttpContext['response'], message: string, errors: FieldErrors) {
  return response.status(422).send({ success: false, message, errors })
}

function serializeImage(row: Record<string, any>) {
  return {
    id: row.id,
    productId: row.product_id,
    url: row.image_url,
    altText: row.alt_text,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
  }
}

function serializeProduct(row: Record<string, any>) {
  return {
    id: row.id,
    code: row.code,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    brand: row.brand,
    model: row.model,
    unit: row.unit,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    salePrice: row.sale_price,
    stock: row.stock,
    minimumStock: row.minimum_stock,
    active: row.active,
  }
}

function isSupportedImage(bytes: Buffer, ext: string): boolean {
  if (ext === 'png') {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (ext === 'webp') {
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}

async function checkActiveSupplier(id: number): Promise<boolean> {
  const supplier = await db.from('erp.suppliers').where('id', id).where('active', true).first()
  return Boolean(supplier)
}

async function getImages(productIds: number[]): Promise<Map<string, ReturnType<typeof serializeImage>[]>> {
  const result = new Map<string, ReturnType<typeof serializeImage>[]>()
  if (!productIds.length) return result

  const rows = await db.from('erp.product_images')
    .select('*')
    .whereIn('product_id', productIds)
    .orderBy('is_primary', 'desc')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')

  for (const row of rows) {
    const key = String(row.product_id)
    if (!result.has(key)) result.set(key, [])
    result.get(key)!.push(serializeImage(row))
  }
  return result
}

export default class SupplierProductsController {
  // GET /api/v1/supplier-products/suppliers
  // Obtiene la lista REAL desde erp.suppliers, independientemente del catálogo.
  async suppliers({ response }: HttpContext) {
    try {
      const rows = await db.from('erp.suppliers')
        .select('id', 'business_name', 'trade_name', 'document_type', 'document_number', 'active')
        .orderBy('business_name', 'asc')

      return response.ok({
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          businessName: row.business_name,
          tradeName: row.trade_name,
          documentType: row.document_type,
          documentNumber: row.document_number,
          active: row.active,
        })),
      })
    } catch (error) {
      console.error('[SupplierProducts] suppliers', error)
      return response.internalServerError({
        success: false,
        message: 'No fue posible consultar los proveedores registrados.',
      })
    }
  }

  // GET /api/v1/supplier-products? - asociaciones con información completa.
  async index({ response }: HttpContext) {
    try {
      const rows = await db.from('erp.supplier_products as sp')
        .join('erp.suppliers as s', 's.id', 'sp.supplier_id')
        .join('erp.products as p', 'p.id', 'sp.product_id')
        .leftJoin('erp.product_categories as c', 'c.id', 'p.category_id')
        .select(
          'sp.id as id', 'sp.supplier_id as supplier_id', 'sp.product_id as product_id',
          'sp.supplier_sku as supplier_sku', 'sp.reference_cost as reference_cost',
          'sp.active as link_active', 'sp.created_at as linked_at',
          's.business_name as supplier_name', 's.document_number as supplier_document',
          's.active as supplier_active', 'p.code as code', 'p.barcode as barcode',
          'p.name as name', 'p.description as description', 'p.brand as brand',
          'p.model as model', 'p.unit as unit', 'p.category_id as category_id',
          'c.name as category_name', 'p.sale_price as sale_price',
          'p.stock as stock', 'p.minimum_stock as minimum_stock', 'p.active as product_active'
        ).orderBy('sp.id', 'desc')

      const productIds = [...new Set(rows.map((row) => Number(row.product_id)))]
      const imagesByProduct = await getImages(productIds)

      return response.ok({
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          supplierDocument: row.supplier_document,
          supplierActive: row.supplier_active,
          productId: row.product_id,
          product: serializeProduct({ ...row, id: row.product_id, active: row.product_active }),
          supplierSku: row.supplier_sku,
          referenceCost: row.reference_cost,
          active: row.link_active,
          linkedAt: row.linked_at,
          images: imagesByProduct.get(String(row.product_id)) ?? [],
        })),
      })
    } catch (error) {
      console.error('[SupplierProducts] index', error)
      return response.internalServerError({ success: false, message: 'No se pudieron cargar los productos por proveedor.' })
    }
  }

  // GET /api/v1/supplier-products/catalog - catálogo global de productos.
  async catalog({ response }: HttpContext) {
    try {
      const products = await db.from('erp.products as p')
        .leftJoin('erp.product_categories as c', 'c.id', 'p.category_id')
        .select('p.*', 'c.name as category_name')
        .orderBy('p.name', 'asc')

      const ids = products.map((row) => Number(row.id))
      const images = await getImages(ids)

      return response.ok({
        success: true,
        data: products.map((row) => ({
          ...serializeProduct(row),
          images: images.get(String(row.id)) ?? [],
        })),
      })
    } catch (error) {
      console.error('[SupplierProducts] catalog', error)
      return response.internalServerError({ success: false, message: 'No se pudo consultar el catálogo de productos.' })
    }
  }

  // GET /api/v1/supplier-products/categories
  async categories({ response }: HttpContext) {
    try {
      const rows = await db.from('erp.product_categories')
        .where('active', true).select('id', 'name').orderBy('name', 'asc')
      return response.ok({ success: true, data: rows })
    } catch (error) {
      console.error('[SupplierProducts] categories', error)
      return response.internalServerError({ success: false, message: 'No se pudieron consultar las categorías.' })
    }
  }

  // POST /api/v1/supplier-products - vincular producto existente.
  async store({ request, response }: HttpContext) {
    const { supplierId, productId, supplierSku, referenceCost, active, errors } = linkData(bodyObject(request.body()))
    if (Object.keys(errors).length) return reject(response, 'Revisa los datos del formulario.', errors)

    try {
      if (!await checkActiveSupplier(supplierId!)) {
        return reject(response, 'No se puede asociar el producto.', { supplierId: 'Selecciona un proveedor activo.' })
      }
      const product = await db.from('erp.products').where('id', productId!).where('active', true).first()
      if (!product) return reject(response, 'No se puede asociar el producto.', { productId: 'Selecciona un producto activo.' })

      const previous = await db.from('erp.supplier_products')
        .where('supplier_id', supplierId!)
        .where('product_id', productId!).first()

      if (previous) {
        return response.status(409).send({
          success: false,
          message: previous.active
            ? 'Este producto ya está asociado a ese proveedor.'
            : 'Este producto ya estaba asociado. Reactiva el vínculo desde la lista.',
          errors: { productId: 'Asociación existente.' },
        })
      }

      const [created] = await db.table('erp.supplier_products').insert({
        supplier_id: supplierId,
        product_id: productId,
        supplier_sku: supplierSku,
        reference_cost: referenceCost,
        active,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*')

      return response.created({
        success: true, message: 'Producto asociado al proveedor.',
        data: { id: created.id, productId: created.product_id, supplierId: created.supplier_id },
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(409).send({ success: false, message: 'El producto ya está asociado a este proveedor.' })
      }
      console.error('[SupplierProducts] store', error)
      return response.internalServerError({ success: false, message: 'No se pudo asociar el producto.' })
    }
  }

  // POST /api/v1/supplier-products/new-product
  // Crea producto compartido (stock=0, sale_price=0) + vínculo, en UNA transacción.
  async createProductAndLink({ request, response }: HttpContext) {
    const data = newProductData(bodyObject(request.body()))
    if (Object.keys(data.errors).length) return reject(response, 'Revisa los datos del producto.', data.errors)

    try {
      if (!await checkActiveSupplier(data.supplierId!)) {
        return reject(response, 'No se pudo registrar.', { supplierId: 'Selecciona un proveedor activo.' })
      }
      if (data.categoryId) {
        const category = await db.from('erp.product_categories')
          .where('id', data.categoryId).where('active', true).first()
        if (!category) return reject(response, 'No se pudo registrar.', { categoryId: 'Categoría inexistente o inactiva.' })
      }

      const created = await db.transaction(async (trx) => {
        const [product] = await trx.table('erp.products').insert({
          category_id: data.categoryId,
          code: data.code,
          barcode: data.barcode,
          name: data.name,
          description: data.description,
          brand: data.brand,
          model: data.model,
          unit: data.unit,
          sale_price: '0.00',
          stock: 0,
          minimum_stock: 0,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*')

        const [link] = await trx.table('erp.supplier_products').insert({
          supplier_id: data.supplierId,
          product_id: product.id,
          supplier_sku: data.supplierSku,
          reference_cost: data.referenceCost,
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*')

        return { linkId: link.id, productId: product.id, supplierId: data.supplierId }
      })

      return response.created({
        success: true,
        message: 'Producto creado en el catálogo y asociado al proveedor.',
        data: created,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(409).send({
          success: false,
          message: 'El código de producto o código de barras ya existe.',
          errors: { code: 'Comprueba que el código y el código de barras no estén duplicados.' },
        })
      }
      console.error('[SupplierProducts] createProductAndLink', error)
      return response.internalServerError({ success: false, message: 'No se pudo registrar el producto.' })
    }
  }

  // PUT /api/v1/supplier-products/:id - modifica SÓLO datos del vínculo.
  async update({ params, request, response }: HttpContext) {
    const id = positiveId(params.id)
    if (!id) return response.badRequest({ success: false, message: 'Asociación inválida.' })

    const { supplierSku, referenceCost, active, errors } = updateData(bodyObject(request.body()))
    if (Object.keys(errors).length) return reject(response, 'Revisa los datos.', errors)

    try {
      const link = await db.from('erp.supplier_products').where('id', id).first()
      if (!link) return response.notFound({ success: false, message: 'Asociación no encontrada.' })

      if (active) {
        const supplier = await db.from('erp.suppliers').where('id', link.supplier_id).where('active', true).first()
        const product = await db.from('erp.products').where('id', link.product_id).where('active', true).first()
        if (!supplier || !product) return reject(response, 'No se puede activar la asociación.', {
          active: 'El proveedor y el producto deben estar activos.',
        })
      }

      const [updated] = await db.from('erp.supplier_products').where('id', id).update({
        supplier_sku: supplierSku,
        reference_cost: referenceCost,
        active,
        updated_at: new Date(),
      }).returning('*')

      return response.ok({
        success: true, message: 'Asociación actualizada correctamente.',
        data: { id: updated.id, productId: updated.product_id, supplierId: updated.supplier_id },
      })
    } catch (error) {
      console.error('[SupplierProducts] update', error)
      return response.internalServerError({ success: false, message: 'No se pudo actualizar la asociación.' })
    }
  }

  // DELETE /api/v1/supplier-products/:id - desvinculación lógica.
  async destroy({ params, response }: HttpContext) {
    const id = positiveId(params.id)
    if (!id) return response.badRequest({ success: false, message: 'Asociación inválida.' })

    try {
      const [updated] = await db.from('erp.supplier_products').where('id', id).update({
        active: false, updated_at: new Date(),
      }).returning('id')
      if (!updated) return response.notFound({ success: false, message: 'Asociación no encontrada.' })
      return response.ok({ success: true, message: 'Producto desvinculado del proveedor; el inventario se conserva.' })
    } catch (error) {
      console.error('[SupplierProducts] destroy', error)
      return response.internalServerError({ success: false, message: 'No se pudo desvincular el producto.' })
    }
  }

  // POST /api/v1/supplier-products/products/:productId/images (multipart: image)
  async uploadImage({ params, request, response }: HttpContext) {
    const productId = positiveId(params.productId)
    if (!productId) return response.badRequest({ success: false, message: 'Producto inválido.' })

    const product = await db.from('erp.products').where('id', productId).first()
    if (!product) return response.notFound({ success: false, message: 'Producto no encontrado.' })

    const image = request.file('image', { size: '5mb', extnames: ['png', 'jpg', 'jpeg', 'webp'] })
    if (!image) return reject(response, 'Selecciona una imagen.', { image: 'Archivo obligatorio.' })
    if (!image.isValid) return reject(response, 'Imagen inválida.', {
      image: 'Solo JPG, PNG o WEBP de hasta 5 MB.',
    })

    const ext = String(image.extname || '').toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return reject(response, 'Formato inválido.', { image: 'Solo JPG, PNG o WEBP.' })
    }

    const images = await db.from('erp.product_images').where('product_id', productId).select('id')
    if (images.length >= MAX_IMAGES) {
      return reject(response, 'Límite de imágenes.', { image: `Máximo ${MAX_IMAGES} imágenes por producto.` })
    }

    const filename = `${randomUUID()}.${ext}`
    const folder = app.makePath('public/uploads/products')
    const destination = join(folder, filename)

    try {
      await mkdir(folder, { recursive: true })
      await image.move(folder, { name: filename, overwrite: false })

      if (!image.isValid || image.hasErrors) {
        return reject(response, 'No se pudo subir la imagen.', { image: 'El archivo no se pudo guardar.' })
      }

      const bytes = await readFile(destination)
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES || !isSupportedImage(bytes, ext)) {
        await unlink(destination).catch(() => {})
        return reject(response, 'Imagen inválida.', { image: 'El contenido no corresponde a un JPG, PNG o WEBP válido de máximo 5 MB.' })
      }

      const url = `/uploads/products/${filename}`
      const [saved] = await db.table('erp.product_images').insert({
        product_id: productId,
        image_url: url,
        alt_text: product.name,
        is_primary: images.length === 0,
        sort_order: images.length,
        created_at: new Date(),
      }).returning('*')

      return response.created({ success: true, message: 'Imagen guardada correctamente.', data: serializeImage(saved) })
    } catch (error) {
      await unlink(destination).catch(() => {})
      console.error('[SupplierProducts] uploadImage', error)
      return response.internalServerError({ success: false, message: 'No se pudo subir la imagen. Verifica los permisos de public/uploads/products.' })
    }
  }

  // DELETE /api/v1/supplier-products/products/:productId/images/:imageId
  async deleteImage({ params, response }: HttpContext) {
    const productId = positiveId(params.productId)
    const imageId = positiveId(params.imageId)
    if (!productId || !imageId) return response.badRequest({ success: false, message: 'Imagen o producto inválido.' })

    try {
      const row = await db.from('erp.product_images')
        .where('id', imageId).where('product_id', productId).first()
      if (!row) return response.notFound({ success: false, message: 'Imagen no encontrada.' })

      await db.transaction(async (trx) => {
        await trx.from('erp.product_images').where('id', imageId).where('product_id', productId).delete()
        if (row.is_primary) {
          const next = await trx.from('erp.product_images')
            .where('product_id', productId).orderBy('sort_order', 'asc').orderBy('id', 'asc').first()
          if (next) await trx.from('erp.product_images').where('id', next.id).update({ is_primary: true })
        }
      })

      // Solo se borran archivos propios; URLs externas no se tocan.
      if (typeof row.image_url === 'string' &&
          /^\/uploads\/products\/[a-f0-9-]+\.(?:png|jpg|jpeg|webp)$/.test(row.image_url)) {
        const filename = row.image_url.split('/').pop()!
        await unlink(app.makePath('public/uploads/products', filename)).catch((error) => {
          console.warn('[SupplierProducts] archivo huérfano:', error)
        })
      }

      return response.ok({ success: true, message: 'Imagen eliminada del producto.' })
    } catch (error) {
      console.error('[SupplierProducts] deleteImage', error)
      return response.internalServerError({ success: false, message: 'No se pudo eliminar la imagen.' })
    }
  }

  // PATCH /api/v1/supplier-products/products/:productId/images/:imageId/primary
  async setPrimaryImage({ params, response }: HttpContext) {
    const productId = positiveId(params.productId)
    const imageId = positiveId(params.imageId)
    if (!productId || !imageId) return response.badRequest({ success: false, message: 'Imagen o producto inválido.' })

    try {
      const image = await db.from('erp.product_images')
        .where('id', imageId).where('product_id', productId).first()
      if (!image) return response.notFound({ success: false, message: 'Imagen no encontrada.' })

      await db.transaction(async (trx) => {
        await trx.from('erp.product_images').where('product_id', productId).where('is_primary', true)
          .update({ is_primary: false })
        await trx.from('erp.product_images').where('id', imageId)
          .update({ is_primary: true })
      })
      return response.ok({ success: true, message: 'Imagen principal actualizada.' })
    } catch (error) {
      console.error('[SupplierProducts] setPrimaryImage', error)
      return response.internalServerError({ success: false, message: 'No se pudo establecer la imagen principal.' })
    }
  }
}
