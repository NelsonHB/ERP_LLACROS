
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

// EZCUDO360 - Compras y recepción de mercadería.
// Guardar borrador: no cambia el inventario.
// Recibir compra: suma stock y registra movimientos.

type Json = Record<string, unknown>

type PurchaseItem = {
  supplierProductId: number
  quantity: number
  unitCost: string
  unitCents: number
}

type ParsedPurchase = {
  supplierId: number
  documentType: string | null
  documentNumber: string | null
  notes: string | null
  receiveNow: boolean
  items: PurchaseItem[]
  totalCents: number
}

const MONEY_REGEX = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/
const MAX_CENTS = 999_999_999_999
const MAX_QTY = 1_000_000
const MAX_ITEMS = 100

function objectValue(value: unknown): Json {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Json
    : {}
}

function idValue(value: unknown): number | null {
  const raw = String(value ?? '')
  if (!/^[1-9]\d*$/.test(raw)) return null

  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

function optString(value: unknown, limit: number): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Datos de texto inválidos.')
  }

  const trimmed = value.trim()

  if (trimmed.length > limit) {
    throw new Error(`El texto no debe superar ${limit} caracteres.`)
  }

  return trimmed || null
}

function amountCents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null
  }

  const raw = String(value).trim()
  if (!MONEY_REGEX.test(raw)) return null

  const [integer, decimals = ''] = raw.split('.')
  const result = Number(integer) * 100 +
    Number(decimals.padEnd(2, '0'))

  return Number.isSafeInteger(result) && result <= MAX_CENTS
    ? result
    : null
}

function money(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parsePurchase(
  raw: Json
): { data?: ParsedPurchase; error?: string } {
  const supplierId = idValue(raw.supplierId)

  if (!supplierId) {
    return { error: 'Selecciona un proveedor válido.' }
  }

  if (typeof raw.receiveNow !== 'boolean') {
    return { error: 'Selecciona guardar borrador o recibir compra.' }
  }

  let documentType: string | null
  let documentNumber: string | null
  let notes: string | null

  try {
    documentType = optString(raw.documentType, 30)
    documentNumber = optString(raw.documentNumber, 50)
    notes = optString(raw.notes, 5000)
  } catch (error) {
    return { error: (error as Error).message }
  }

  if (
    documentType &&
    !['FACTURA', 'BOLETA', 'GUIA', 'OTRO'].includes(documentType)
  ) {
    return { error: 'Tipo de documento inválido.' }
  }

  if (
    !Array.isArray(raw.items) ||
    !raw.items.length ||
    raw.items.length > MAX_ITEMS
  ) {
    return {
      error: `Añade entre 1 y ${MAX_ITEMS} productos a la compra.`,
    }
  }

  const items: PurchaseItem[] = []
  const seen = new Set<number>()
  let totalCents = 0

  for (let index = 0; index < raw.items.length; index++) {
    const item = objectValue(raw.items[index])

    const supplierProductId = idValue(item.supplierProductId)
    const quantity = idValue(item.quantity)
    const unitCents = amountCents(item.unitCost)

    if (
      !supplierProductId ||
      !quantity ||
      quantity > MAX_QTY ||
      unitCents === null
    ) {
      return {
        error: `Revisa producto, cantidad y costo de la fila ${index + 1}.`,
      }
    }

    if (seen.has(supplierProductId)) {
      return {
        error: 'Un producto no puede aparecer dos veces en la misma compra.',
      }
    }

    seen.add(supplierProductId)

    const subtotal = quantity * unitCents

    if (
      !Number.isSafeInteger(subtotal) ||
      subtotal > MAX_CENTS ||
      totalCents + subtotal > MAX_CENTS
    ) {
      return { error: 'El total excede el monto máximo admitido.' }
    }

    totalCents += subtotal

    items.push({
      supplierProductId,
      quantity,
      unitCost: money(unitCents),
      unitCents,
    })
  }

  return {
    data: {
      supplierId,
      documentType,
      documentNumber,
      notes,
      receiveNow: raw.receiveNow,
      items,
      totalCents,
    },
  }
}

function errStatus(
  response: HttpContext['response'],
  message: string,
  status = 422
) {
  return response.status(status).send({
    success: false,
    message,
  })
}

// Se ejecuta dentro de una transacción.
// Los bloqueos FOR UPDATE evitan recibir una compra dos veces.

async function receivePurchase(
  trx: any,
  purchaseId: number,
  userId: number
) {
  const purchase = await trx
    .from('erp.purchases')
    .where('id', purchaseId)
    .forUpdate()
    .first()

  if (!purchase) {
    throw new Error('Compra no encontrada.')
  }

  if (purchase.status !== 'BORRADOR') {
    throw new Error('Esta compra ya fue recibida o anulada.')
  }

  const details = await trx
    .from('erp.purchase_details as d')
    .join(
      'erp.supplier_products as sp',
      'sp.id',
      'd.supplier_product_id'
    )
    .join('erp.products as p', 'p.id', 'd.product_id')
    .select(
      'd.id',
      'd.product_id',
      'd.quantity',
      'd.supplier_product_id',
      'sp.supplier_id',
      'sp.active as link_active',
      'p.active as product_active'
    )
    .where('d.purchase_id', purchaseId)
    .orderBy('d.product_id', 'asc')

  if (!details.length) {
    throw new Error('No hay productos registrados en esta compra.')
  }


const productIds: number[] = [
  ...new Set<number>(
    details.map((d: any): number => Number(d.product_id))
  ),
].sort((a: number, b: number) => a - b)


  const lockedProducts = await trx
    .from('erp.products')
    .select('id', 'stock', 'name')
    .whereIn('id', productIds)
    .orderBy('id', 'asc')
    .forUpdate()

  const byId = new Map<number, any>(
    lockedProducts.map((p: any) => [Number(p.id), p])
  )

  if (byId.size !== productIds.length) {
    throw new Error('Uno o más productos ya no existen.')
  }

  for (const detail of details) {
    if (String(detail.supplier_id) !== String(purchase.supplier_id)) {
      throw new Error('La compra contiene un producto de otro proveedor.')
    }

    if (!detail.link_active || !detail.product_active) {
      throw new Error(
        'Hay productos inactivos o desasociados. Revísalos antes de recibir.'
      )
    }

    const product = byId.get(Number(detail.product_id))!

    const before = Number(product.stock)
    const quantity = Number(detail.quantity)
    const after = before + quantity

    if (
      !Number.isSafeInteger(after) ||
      after > 2_147_483_647
    ) {
      throw new Error(
        `El stock máximo se excede para ${product.name}.`
      )
    }

    await trx
      .from('erp.products')
      .where('id', detail.product_id)
      .update({
        stock: after,
        updated_at: new Date(),
      })

    await trx.table('erp.stock_movements').insert({
      product_id: detail.product_id,
      movement_type: 'ENTRADA',
      reference_type: 'COMPRA',
      reference_id: purchaseId,
      quantity_change: quantity,
      stock_before: before,
      stock_after: after,
      reason: `Recepción compra ${purchase.purchase_number}`,
      user_id: userId,
      created_at: new Date(),
    })

    product.stock = after
  }

  await trx
    .from('erp.purchases')
    .where('id', purchaseId)
    .update({
      status: 'RECIBIDA',
      received_at: new Date(),
      updated_at: new Date(),
    })
}

export default class PurchasesController {

  // GET /api/v1/purchases/suppliers
  async suppliers({ response }: HttpContext) {
    try {
      const rows = await db
        .from('erp.suppliers')
        .select('id', 'business_name', 'document_number')
        .where('active', true)
        .orderBy('business_name', 'asc')

      return response.ok({
        success: true,
        data: rows.map((s) => ({
          id: s.id,
          name: s.business_name,
          documentNumber: s.document_number,
        })),
      })
    } catch (error) {
      console.error('[Purchases] suppliers:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudieron cargar los proveedores.',
      })
    }
  }

  // GET /api/v1/purchases/catalog?supplierId=ID
  async catalog({ request, response }: HttpContext) {
    const supplierId = idValue(request.input('supplierId'))

    if (!supplierId) {
      return errStatus(response, 'Selecciona un proveedor válido.')
    }

    try {
      const rows = await db
        .from('erp.supplier_products as sp')
        .join('erp.products as p', 'p.id', 'sp.product_id')
        .leftJoin(
          'erp.product_categories as c',
          'c.id',
          'p.category_id'
        )
        .select(
          'sp.id as supplier_product_id',
          'sp.reference_cost',
          'p.id as product_id',
          'p.code',
          'p.name',
          'p.brand',
          'p.stock',
          'p.unit',
          'p.sale_price',
          'c.name as category_name'
        )
        .where('sp.supplier_id', supplierId)
        .where('sp.active', true)
        .where('p.active', true)
        .orderBy('p.name', 'asc')

      const ids = rows.map((r) => Number(r.product_id))

      const images = ids.length
        ? await db
            .from('erp.product_images')
            .select('product_id', 'image_url', 'is_primary')
            .whereIn('product_id', ids)
            .orderBy('is_primary', 'desc')
            .orderBy('id', 'asc')
        : []

      const imageById = new Map<string, string>()

      for (const img of images) {
        const key = String(img.product_id)

        if (!imageById.has(key)) {
          imageById.set(key, img.image_url)
        }
      }

      return response.ok({
        success: true,
        data: rows.map((r) => ({
          supplierProductId: r.supplier_product_id,
          productId: r.product_id,
          code: r.code,
          name: r.name,
          brand: r.brand,
          category: r.category_name,
          unit: r.unit,
          stock: r.stock,
          referenceCost: r.reference_cost,
          salePrice: r.sale_price,
          imageUrl:
            imageById.get(String(r.product_id)) || null,
        })),
      })
    } catch (error) {
      console.error('[Purchases] catalog:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudo cargar el catálogo del proveedor.',
      })
    }
  }

  // GET /api/v1/purchases
  async index({ response }: HttpContext) {
    try {
      const rows = await db
        .from('erp.purchases as pu')
        .join('erp.suppliers as s', 's.id', 'pu.supplier_id')
        .select(
          'pu.id',
          'pu.purchase_number',
          'pu.supplier_id',
          's.business_name as supplier_name',
          'pu.purchase_date',
          'pu.received_at',
          'pu.status',
          'pu.document_type',
          'pu.document_number',
          'pu.subtotal',
          'pu.tax_amount',
          'pu.total',
          'pu.notes'
        )
        .orderBy('pu.purchase_date', 'desc')
        .orderBy('pu.id', 'desc')
        .limit(500)

      return response.ok({
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          purchaseNumber: r.purchase_number,
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          purchaseDate: r.purchase_date,
          receivedAt: r.received_at,
          status: r.status,
          documentType: r.document_type,
          documentNumber: r.document_number,
          subtotal: r.subtotal,
          taxAmount: r.tax_amount,
          total: r.total,
          notes: r.notes,
        })),
      })
    } catch (error) {
      console.error('[Purchases] index:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudo cargar el historial de compras.',
      })
    }
  }

  // GET /api/v1/purchases/:id
  async show({ params, response }: HttpContext) {
    const id = idValue(params.id)

    if (!id) {
      return errStatus(response, 'Identificador inválido.')
    }

    try {
      const row = await db
        .from('erp.purchases as pu')
        .join('erp.suppliers as s', 's.id', 'pu.supplier_id')
        .select('pu.*', 's.business_name as supplier_name')
        .where('pu.id', id)
        .first()

      if (!row) {
        return errStatus(response, 'Compra no encontrada.', 404)
      }

      const details = await db
        .from('erp.purchase_details as d')
        .join('erp.products as p', 'p.id', 'd.product_id')
        .select(
          'd.id',
          'd.product_id',
          'd.supplier_product_id',
          'd.quantity',
          'd.unit_cost',
          'd.subtotal',
          'p.code',
          'p.name',
          'p.unit'
        )
        .where('d.purchase_id', id)
        .orderBy('d.id', 'asc')

      return response.ok({
        success: true,
        data: {
          id: row.id,
          purchaseNumber: row.purchase_number,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          purchaseDate: row.purchase_date,
          receivedAt: row.received_at,
          status: row.status,
          documentType: row.document_type,
          documentNumber: row.document_number,
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          total: row.total,
          notes: row.notes,
          items: details.map((d) => ({
            id: d.id,
            productId: d.product_id,
            supplierProductId: d.supplier_product_id,
            code: d.code,
            name: d.name,
            unit: d.unit,
            quantity: d.quantity,
            unitCost: d.unit_cost,
            subtotal: d.subtotal,
          })),
        },
      })
    } catch (error) {
      console.error('[Purchases] show:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudo consultar la compra.',
      })
    }
  }

  // POST /api/v1/purchases
  async store({ request, response, auth }: HttpContext) {
    const userId = idValue(auth.user?.id)

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Debes iniciar sesión.',
      })
    }

    const parsed = parsePurchase(objectValue(request.body()))

    if (!parsed.data) {
      return errStatus(
        response,
        parsed.error || 'Datos de compra inválidos.'
      )
    }

    const data = parsed.data

    try {
      const createdId = await db.transaction(async (trx) => {
        const supplier = await trx
          .from('erp.suppliers')
          .select('id')
          .where('id', data.supplierId)
          .where('active', true)
          .first()

        if (!supplier) {
          throw new Error(
            'El proveedor no existe o está inactivo.'
          )
        }

        const ids = data.items.map(
          (i) => i.supplierProductId
        )

        const links = await trx
          .from('erp.supplier_products as sp')
          .join('erp.products as p', 'p.id', 'sp.product_id')
          .select(
            'sp.id',
            'sp.product_id',
            'sp.supplier_id',
            'sp.active as link_active',
            'p.active as product_active'
          )
          .whereIn('sp.id', ids)

        const linkById = new Map<string, any>(
          links.map((link) => [String(link.id), link])
        )

        for (const item of data.items) {
          const link = linkById.get(
            String(item.supplierProductId)
          )

          if (
            !link ||
            String(link.supplier_id) !== String(data.supplierId) ||
            !link.link_active ||
            !link.product_active
          ) {
            throw new Error(
              'Un producto ya no está activo o no pertenece a este proveedor.'
            )
          }
        }

        const dateCode = new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '')

        const purchaseNumber =
          `CMP-${dateCode}-${randomUUID().slice(0, 12).toUpperCase()}`

        const [purchase] = await trx
          .table('erp.purchases')
          .insert({
            purchase_number: purchaseNumber,
            supplier_id: data.supplierId,
            user_id: userId,
            document_type: data.documentType,
            document_number: data.documentNumber,
            notes: data.notes,
            purchase_date: new Date(),
            subtotal: money(data.totalCents),
            tax_amount: '0.00',
            total: money(data.totalCents),
            status: 'BORRADOR',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id')

        const purchaseId = Number(purchase.id)

        await trx
          .table('erp.purchase_details')
          .insert(
            data.items.map((item) => ({
              purchase_id: purchaseId,
              product_id: linkById.get(
                String(item.supplierProductId)
              ).product_id,
              supplier_product_id: item.supplierProductId,
              quantity: item.quantity,
              unit_cost: item.unitCost,
              subtotal: money(
                item.quantity * item.unitCents
              ),
              created_at: new Date(),
            }))
          )

        if (data.receiveNow) {
          await receivePurchase(
            trx,
            purchaseId,
            userId
          )
        }

        return purchaseId
      })

      return response.created({
        success: true,
        message: data.receiveNow
          ? 'Compra recibida. Stock actualizado correctamente.'
          : 'Borrador de compra guardado. El stock no cambió.',
        data: {
          id: createdId,
          status: data.receiveNow ? 'RECIBIDA' : 'BORRADOR',
        },
      })
    } catch (error) {
      console.error('[Purchases] store:', error)

      return errStatus(
        response,
        error instanceof Error
          ? error.message
          : 'No se pudo registrar la compra.'
      )
    }
  }

  // POST /api/v1/purchases/:id/receive
  async receive({ params, response, auth }: HttpContext) {
    const id = idValue(params.id)
    const userId = idValue(auth.user?.id)

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Debes iniciar sesión.',
      })
    }

    if (!id) {
      return errStatus(response, 'Identificador inválido.')
    }

    try {
      await db.transaction(async (trx) => {
        await receivePurchase(trx, id, userId)
      })

      return response.ok({
        success: true,
        message: 'Mercadería recibida y stock actualizado.',
      })
    } catch (error) {
      console.error('[Purchases] receive:', error)

      return errStatus(
        response,
        error instanceof Error
          ? error.message
          : 'No se pudo recibir la compra.'
      )
    }
  }

  // POST /api/v1/purchases/:id/cancel
  async cancel({ params, response }: HttpContext) {
    const id = idValue(params.id)

    if (!id) {
      return errStatus(response, 'Identificador inválido.')
    }

    try {
      const updated = await db.transaction(async (trx) => {
        const purchase = await trx
          .from('erp.purchases')
          .where('id', id)
          .forUpdate()
          .first()

        if (!purchase) {
          throw new Error('Compra no encontrada.')
        }

        if (purchase.status !== 'BORRADOR') {
          throw new Error(
            'Solo puedes anular una compra en borrador.'
          )
        }

        await trx
          .from('erp.purchases')
          .where('id', id)
          .update({
            status: 'ANULADA',
            updated_at: new Date(),
          })

        return true
      })

      return response.ok({
        success: updated,
        message: 'Borrador anulado. No se modificó el stock.',
      })
    } catch (error) {
      console.error('[Purchases] cancel:', error)

      return errStatus(
        response,
        error instanceof Error
          ? error.message
          : 'No se pudo anular la compra.'
      )
    }
  }
}
