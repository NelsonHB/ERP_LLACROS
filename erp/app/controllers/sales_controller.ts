
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

const MAX_CENTS = 999_999_999_999

const PAYMENT_METHODS = [
  'EFECTIVO',
  'YAPE',
  'PLIN',
  'TARJETA',
  'TRANSFERENCIA',
] as const

type SaleItem = {
  productId: number
  quantity: number
}

class SaleError extends Error {
  constructor(
    message: string,
    public statusCode: number = 422
  ) {
    super(message)
  }
}

function positiveId(value: unknown): number | null {
  const raw = String(value ?? '')

  if (!/^[1-9]\d*$/.test(raw)) return null

  const id = Number(raw)

  return Number.isSafeInteger(id) ? id : null
}

function parseCents(value: unknown): number | null {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null
  }

  const raw = String(value).trim()

  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(raw)) {
    return null
  }

  const [whole, fraction = ''] = raw.split('.')

  const cents =
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'))

  return Number.isSafeInteger(cents) &&
    cents <= MAX_CENTS
    ? cents
    : null
}

function asMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parseItems(value: unknown): SaleItem[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 100
  ) {
    throw new SaleError(
      'Selecciona entre 1 y 100 productos.'
    )
  }

  const result: SaleItem[] = []
  const seen = new Set<number>()

  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      throw new SaleError('Producto inválido.')
    }

    const productId = positiveId(item.productId)
    const quantity = positiveId(item.quantity)

    if (
      !productId ||
      !quantity ||
      quantity > 1_000_000
    ) {
      throw new SaleError(
        'Cantidad o identificador de producto inválido.'
      )
    }

    if (seen.has(productId)) {
      throw new SaleError(
        'Hay productos repetidos en el carrito.'
      )
    }

    seen.add(productId)
    result.push({ productId, quantity })
  }

  return result.sort(
    (a, b) => a.productId - b.productId
  )
}

function handleError(
  response: HttpContext['response'],
  error: unknown,
  action: string
) {
  if (error instanceof SaleError) {
    return response.status(error.statusCode).send({
      success: false,
      message: error.message,
    })
  }

  console.error(`[Sales] ${action}`, error)

  return response.internalServerError({
    success: false,
    message: 'No se pudo procesar la venta.',
  })
}

export default class SalesController {

  // ========================================
  // CATÁLOGO DEL POS
  // GET /api/v1/sales/pos-products
  // ========================================

  async posProducts({ response }: HttpContext) {
    try {
      const rows = await db
        .from('erp.products as p')
        .leftJoin(
          'erp.product_categories as c',
          'c.id',
          'p.category_id'
        )
        .select(
          'p.id',
          'p.code',
          'p.name',
          'p.brand',
          'p.unit',
          'p.stock',
          'p.sale_price',
          'c.name as category_name'
        )
        .where('p.active', true)
        .orderBy('p.name', 'asc')
        .limit(5000)

      const ids: number[] = rows.map(
        (p) => Number(p.id)
      )

      const images = ids.length
        ? await db
            .from('erp.product_images')
            .select(
              'product_id',
              'image_url',
              'is_primary'
            )
            .whereIn('product_id', ids)
            .orderBy('is_primary', 'desc')
            .orderBy('sort_order', 'asc')
            .orderBy('id', 'asc')
        : []

      const imageMap = new Map<string, string>()

      for (const image of images) {
        const key = String(image.product_id)

        if (
          !imageMap.has(key) &&
          image.image_url
        ) {
          imageMap.set(key, image.image_url)
        }
      }

      return response.ok({
        success: true,
        data: rows.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          brand: p.brand,
          unit: p.unit,
          stock: Number(p.stock),
          salePrice: p.sale_price,
          category: p.category_name,
          imageUrl:
            imageMap.get(String(p.id)) || null,
        })),
      })
    } catch (error) {
      return handleError(
        response,
        error,
        'posProducts'
      )
    }
  }

  // ========================================
  // HISTORIAL DE VENTAS
  // GET /api/v1/sales
  // ========================================

  async index({ response }: HttpContext) {
    try {
      const rows = await db
        .from('erp.sales as s')
        .leftJoin(
          'erp.customers as c',
          'c.id',
          's.customer_id'
        )
        .select(
          's.id',
          's.sale_number',
          's.sale_date',
          's.customer_id',
          's.subtotal',
          's.discount_amount',
          's.tax_amount',
          's.total',
          's.status',
          'c.name as customer_name',
          'c.document_type',
          'c.document_number'
        )
        .orderBy('s.sale_date', 'desc')
        .orderBy('s.id', 'desc')
        .limit(500)

      return response.ok({
        success: true,
        data: rows.map((s) => ({
          id: s.id,
          saleNumber: s.sale_number,
          saleDate: s.sale_date,
          customerId: s.customer_id,
          customerName: s.customer_name,
          customerDocumentType: s.document_type,
          customerDocumentNumber: s.document_number,
          subtotal: s.subtotal,
          discountAmount: s.discount_amount,
          taxAmount: s.tax_amount,
          total: s.total,
          status: s.status,
        })),
      })
    } catch (error) {
      return handleError(response, error, 'index')
    }
  }

  // ========================================
  // DETALLE DE VENTA
  // GET /api/v1/sales/:id
  // ========================================

  async show({ params, response }: HttpContext) {
    const id = positiveId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Venta inválida.',
      })
    }

    try {
      const sale = await db
        .from('erp.sales as s')
        .leftJoin(
          'erp.customers as c',
          'c.id',
          's.customer_id'
        )
        .select(
          's.*',
          'c.name as customer_name',
          'c.document_type',
          'c.document_number'
        )
        .where('s.id', id)
        .first()

      if (!sale) {
        return response.notFound({
          success: false,
          message: 'Venta no encontrada.',
        })
      }

      const details = await db
        .from('erp.sale_details')
        .select(
          'id',
          'product_id',
          'product_code',
          'product_name',
          'quantity',
          'unit_price',
          'subtotal'
        )
        .where('sale_id', id)
        .orderBy('id', 'asc')

      const payments = await db
        .from('erp.payments')
        .select(
          'payment_method',
          'amount',
          'amount_received',
          'change_amount'
        )
        .where('sale_id', id)
        .orderBy('id', 'asc')

      return response.ok({
        success: true,
        data: {
          id: sale.id,
          saleNumber: sale.sale_number,
          saleDate: sale.sale_date,
          customerId: sale.customer_id,
          customerName: sale.customer_name,
          customerDocumentType: sale.document_type,
          customerDocumentNumber: sale.document_number,
          subtotal: sale.subtotal,
          discountAmount: sale.discount_amount,
          taxAmount: sale.tax_amount,
          total: sale.total,
          status: sale.status,
          items: details.map((d) => ({
            productId: d.product_id,
            code: d.product_code,
            name: d.product_name,
            quantity: Number(d.quantity),
            unitPrice: d.unit_price,
            subtotal: d.subtotal,
          })),
          payments: payments.map((p) => ({
            method: p.payment_method,
            amount: p.amount,
            amountReceived: p.amount_received,
            changeAmount: p.change_amount,
          })),
        },
      })
    } catch (error) {
      return handleError(response, error, 'show')
    }
  }

  // ========================================
  // REGISTRAR VENTA CON CLIENTE
  // POST /api/v1/sales
  // ========================================

  async store({
    request,
    response,
    auth,
  }: HttpContext) {
    const userId = positiveId(auth.user?.id)

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Debes iniciar sesión.',
      })
    }

    try {
      const customerId = positiveId(
        request.input('customerId')
      )

      const documentType = String(
        request.input('customerDocumentType', '')
      ).trim().toUpperCase()

      const documentNumber = String(
        request.input('customerDocumentNumber', '')
      ).trim()

      if (!customerId) {
        throw new SaleError(
          'Selecciona un cliente registrado.'
        )
      }

      const validDocument =
        (
          documentType === 'DNI' &&
          /^\d{8}$/.test(documentNumber)
        ) ||
        (
          documentType === 'RUC' &&
          /^\d{11}$/.test(documentNumber)
        )

      if (!validDocument) {
        throw new SaleError(
          'El DNI o RUC del cliente es inválido.'
        )
      }

      const items = parseItems(
        request.input('items')
      )

      const paymentMethod = String(
        request.input('paymentMethod', '')
      )

      if (
        !PAYMENT_METHODS.includes(
          paymentMethod as typeof PAYMENT_METHODS[number]
        )
      ) {
        throw new SaleError(
          'Método de pago inválido.'
        )
      }

      const discountCents = parseCents(
        request.input('discountAmount', '0')
      )

      if (discountCents === null) {
        throw new SaleError(
          'El descuento es inválido.'
        )
      }

      const expectedTotalCents = parseCents(
        request.input('expectedTotal')
      )

      if (expectedTotalCents === null) {
        throw new SaleError(
          'No se recibió un total válido.'
        )
      }

      const amountReceivedInput =
        request.input('amountReceived')

      const result = await db.transaction(async (trx) => {
        // Comprobar cliente desde PostgreSQL:
        // no se confía en el nombre enviado por el navegador.
        const customer = await trx
          .from('erp.customers')
          .select(
            'id',
            'name',
            'document_type',
            'document_number'
          )
          .where('id', customerId)
          .where('document_type', documentType)
          .where('document_number', documentNumber)
          .where('active', true)
          .forShare()
          .first()

        if (!customer) {
          throw new SaleError(
            'Cliente no registrado, inactivo o documento incorrecto.'
          )
        }

        const productIds = items.map(
          (i) => i.productId
        )

        // Bloquear productos para impedir
        // ventas simultáneas con stock insuficiente.
        const lockedProducts = await trx
          .from('erp.products')
          .select(
            'id',
            'code',
            'name',
            'stock',
            'sale_price',
            'active'
          )
          .whereIn('id', productIds)
          .orderBy('id', 'asc')
          .forUpdate()

        const byId = new Map<string, any>(
          lockedProducts.map((p) => [
            String(p.id),
            p,
          ])
        )

        if (byId.size !== items.length) {
          throw new SaleError(
            'Uno o más productos ya no existen.'
          )
        }

        let grossCents = 0

        const lines = items.map((item) => {
          const product = byId.get(
            String(item.productId)
          )

          if (!product || !product.active) {
            throw new SaleError(
              'Hay productos inactivos.'
            )
          }

          const stock = Number(product.stock)

          if (stock < item.quantity) {
            throw new SaleError(
              `Stock insuficiente para ${product.name}.`
            )
          }

          const priceCents = parseCents(
            product.sale_price
          )

          if (
            priceCents === null ||
            priceCents <= 0
          ) {
            throw new SaleError(
              `Configura el precio de ${product.name}.`
            )
          }

          const lineCents =
            priceCents * item.quantity

          if (
            !Number.isSafeInteger(lineCents) ||
            lineCents > MAX_CENTS ||
            grossCents + lineCents > MAX_CENTS
          ) {
            throw new SaleError(
              'El importe de la venta es demasiado alto.'
            )
          }

          grossCents += lineCents

          return {
            productId: item.productId,
            code: product.code,
            name: product.name,
            quantity: item.quantity,
            priceCents,
            lineCents,
            stockBefore: stock,
            stockAfter: stock - item.quantity,
          }
        })

        if (discountCents > grossCents) {
          throw new SaleError(
            'El descuento no puede superar el total de productos.'
          )
        }

        const totalCents =
          grossCents - discountCents

        if (expectedTotalCents !== totalCents) {
          throw new SaleError(
            'El precio cambió en Inventario. Actualiza el catálogo y revisa el carrito.',
            409
          )
        }

        let receivedCents = totalCents

        if (paymentMethod === 'EFECTIVO') {
          const received = parseCents(
            amountReceivedInput
          )

          if (
            received === null ||
            received < totalCents
          ) {
            throw new SaleError(
              'El efectivo recibido es insuficiente.'
            )
          }

          receivedCents = received
        }

        const changeCents =
          receivedCents - totalCents

        // IGV desglosado sobre precios finales.
        const taxCents = Math.round(
          totalCents * 18 / 118
        )

        const saleNumber =
          'VTA-' +
          new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '') +
          '-' +
          randomUUID()
            .slice(0, 12)
            .toUpperCase()

        const now = new Date()

        // 1. Guardar cabecera de venta
        const [created] = await trx
          .table('erp.sales')
          .insert({
            sale_number: saleNumber,
            customer_id: customer.id,
            user_id: userId,
            sale_date: now,
            subtotal: asMoney(grossCents),
            discount_amount: asMoney(discountCents),
            tax_amount: asMoney(taxCents),
            total: asMoney(totalCents),
            status: 'COMPLETADA',
            created_at: now,
            updated_at: now,
          })
          .returning('id')

        const saleId = Number(created.id)

        // 2. Guardar productos vendidos
        await trx
          .table('erp.sale_details')
          .insert(
            lines.map((line) => ({
              sale_id: saleId,
              product_id: line.productId,
              product_code: line.code,
              product_name: line.name,
              quantity: line.quantity,
              unit_price: asMoney(line.priceCents),
              subtotal: asMoney(line.lineCents),
              created_at: now,
            }))
          )

        // 3. Guardar método de pago
        await trx
          .table('erp.payments')
          .insert({
            sale_id: saleId,
            payment_method: paymentMethod,
            amount: asMoney(totalCents),
            amount_received: asMoney(receivedCents),
            change_amount: asMoney(changeCents),
            created_at: now,
          })

        // 4. Descontar stock y dejar movimientos
        for (const line of lines) {
          await trx
            .from('erp.products')
            .where('id', line.productId)
            .update({
              stock: line.stockAfter,
              updated_at: now,
            })

          await trx
            .table('erp.stock_movements')
            .insert({
              product_id: line.productId,
              movement_type: 'SALIDA',
              reference_type: 'VENTA',
              reference_id: saleId,
              quantity_change: -line.quantity,
              stock_before: line.stockBefore,
              stock_after: line.stockAfter,
              reason: `Venta ${saleNumber}`,
              user_id: userId,
              created_at: now,
            })
        }

        // 5. Respuesta para la boleta
        return {
          id: saleId,
          saleNumber,
          saleDate: now.toISOString(),

          customerId: Number(customer.id),
          customerName: customer.name,
          customerDocumentType: customer.document_type,
          customerDocumentNumber: customer.document_number,

          paymentMethod,
          subtotal: asMoney(grossCents),
          discountAmount: asMoney(discountCents),
          taxAmount: asMoney(taxCents),
          total: asMoney(totalCents),
          amountReceived: asMoney(receivedCents),
          changeAmount: asMoney(changeCents),

          items: lines.map((line) => ({
            productId: line.productId,
            code: line.code,
            name: line.name,
            quantity: line.quantity,
            unitPrice: asMoney(line.priceCents),
            subtotal: asMoney(line.lineCents),
          })),
        }
      })

      return response.created({
        success: true,
        message: 'Venta registrada correctamente.',
        data: result,
      })
    } catch (error) {
      return handleError(response, error, 'store')
    }
  }
}
