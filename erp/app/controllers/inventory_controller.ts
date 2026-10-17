
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

const PAGE_SIZE = 15

function positiveId(value: unknown): number | null {
  const raw = String(value ?? '')

  if (!/^[1-9]\d*$/.test(raw)) {
    return null
  }

  const id = Number(raw)

  return Number.isSafeInteger(id) ? id : null
}

function parsePrice(value: unknown): string | null {
  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    return null
  }

  const raw = String(value).trim()

  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(raw)) {
    return null
  }

  const [whole, decimal = ''] = raw.split('.')

  const cents =
    Number(whole) * 100 +
    Number(decimal.padEnd(2, '0'))

  if (
    !Number.isSafeInteger(cents) ||
    cents <= 0 ||
    cents > 999_999_999_999
  ) {
    return null
  }

  return (cents / 100).toFixed(2)
}

export default class InventoryController {

  // =========================================
  // LISTAR PRODUCTOS DEL INVENTARIO
  // GET /api/v1/inventory
  // =========================================
  async index({ request, response }: HttpContext) {
    try {
      const rawPage = Number(request.input('page', 1))

      const page =
        Number.isSafeInteger(rawPage) && rawPage > 0
          ? Math.min(rawPage, 100000)
          : 1

      const search = String(
        request.input('search', '')
      ).trim().slice(0, 100)

      const category = positiveId(
        request.input('categoryId')
      )

      const stockFilter = String(
        request.input('stockFilter', 'all')
      )

      const queryProducts = () => {
        const query = db
          .from('erp.products as p')
          .leftJoin(
            'erp.product_categories as c',
            'c.id',
            'p.category_id'
          )
          .where('p.active', true)

        if (search) {
          const pattern = `%${search}%`

          query.where((builder) => {
            builder
              .whereILike('p.name', pattern)
              .orWhereILike('p.code', pattern)
              .orWhereILike('p.brand', pattern)
              .orWhereILike('c.name', pattern)
          })
        }

        if (category) {
          query.where('p.category_id', category)
        }

        if (stockFilter === 'out') {
          query.where('p.stock', '<=', 0)
        }

        if (stockFilter === 'low') {
          query
            .where('p.stock', '>', 0)
            .where('p.stock', '<=', 5)
        }

        if (stockFilter === 'available') {
          query.where('p.stock', '>', 5)
        }

        if (stockFilter === 'unpriced') {
          query.where((builder) => {
            builder
              .whereNull('p.sale_price')
              .orWhere('p.sale_price', '<=', 0)
          })
        }

        return query
      }

      const countRow = await queryProducts()
        .count('p.id as total')
        .first()

      const total = Number(countRow?.total ?? 0)

      const products = await queryProducts()
        .select(
          'p.id',
          'p.code',
          'p.name',
          'p.brand',
          'p.unit',
          'p.stock',
          'p.sale_price',
          'p.category_id',
          'c.name as category_name'
        )
        .orderBy('p.name', 'asc')
        .orderBy('p.id', 'asc')
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)

      const productIds = products.map(
        (product) => Number(product.id)
      )

      const images = productIds.length
        ? await db
            .from('erp.product_images')
            .select(
              'product_id',
              'image_url',
              'is_primary'
            )
            .whereIn('product_id', productIds)
            .orderBy('is_primary', 'desc')
            .orderBy('id', 'asc')
        : []

      const imageMap = new Map<number, string>()

      for (const image of images) {
        const id = Number(image.product_id)

        if (!imageMap.has(id) && image.image_url) {
          imageMap.set(id, image.image_url)
        }
      }

      return response.ok({
        success: true,

        data: products.map((product) => ({
          id: product.id,
          code: product.code,
          name: product.name,
          brand: product.brand,
          categoryId: product.category_id,
          categoryName: product.category_name,
          unit: product.unit,
          stock: Number(product.stock),
          salePrice:
            product.sale_price === null
              ? null
              : Number(product.sale_price),
          imageUrl:
            imageMap.get(Number(product.id)) || null,
        })),

        pagination: {
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages: Math.max(
            1,
            Math.ceil(total / PAGE_SIZE)
          ),
        },
      })
    } catch (error) {
      console.error('[Inventory] index:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudo cargar el inventario.',
      })
    }
  }

  // =========================================
  // ESTADÍSTICAS DEL INVENTARIO
  // GET /api/v1/inventory/stats
  // =========================================
  async stats({ response }: HttpContext) {
    try {
      const result = await db.rawQuery(`
        SELECT
          COUNT(*)::int AS total_products,

          COALESCE(
            SUM(GREATEST(stock, 0)),
            0
          ) AS total_units,

          COUNT(*) FILTER (
            WHERE stock > 0 AND stock <= 5
          )::int AS low_stock,

          COUNT(*) FILTER (
            WHERE stock <= 0
          )::int AS out_of_stock,

          COUNT(*) FILTER (
            WHERE sale_price IS NULL
               OR sale_price <= 0
          )::int AS without_price,

          COALESCE(
            SUM(
              GREATEST(stock, 0) *
              COALESCE(sale_price, 0)
            ),
            0
          ) AS retail_value

        FROM erp.products
        WHERE active = TRUE
      `)

      const row = result.rows[0]

      return response.ok({
        success: true,

        data: {
          totalProducts: Number(row.total_products),
          totalUnits: Number(row.total_units),
          lowStock: Number(row.low_stock),
          outOfStock: Number(row.out_of_stock),
          withoutPrice: Number(row.without_price),
          retailValue: Number(row.retail_value),
        },
      })
    } catch (error) {
      console.error('[Inventory] stats:', error)

      return response.internalServerError({
        success: false,
        message:
          'No se pudieron obtener las estadísticas.',
      })
    }
  }

  // =========================================
  // CATEGORÍAS PARA FILTROS
  // GET /api/v1/inventory/categories
  // =========================================
  async categories({ response }: HttpContext) {
    try {
      const categories = await db
        .from('erp.product_categories')
        .select('id', 'name')
        .where('active', true)
        .orderBy('name', 'asc')

      return response.ok({
        success: true,
        data: categories,
      })
    } catch (error) {
      console.error('[Inventory] categories:', error)

      return response.internalServerError({
        success: false,
        message: 'No se pudieron cargar las categorías.',
      })
    }
  }

  // =========================================
  // ACTUALIZAR PRECIO DE VENTA
  // PATCH /api/v1/inventory/:id/price
  // =========================================
  async updatePrice({ params, request, response }: HttpContext) {
    const id = positiveId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Producto inválido.',
      })
    }

    const price = parsePrice(
      request.input('salePrice')
    )

    if (!price) {
      return response.unprocessableEntity({
        success: false,
        message:
          'Ingresa un precio mayor a cero, con máximo dos decimales.',
      })
    }

    try {
      const updated = await db
        .from('erp.products')
        .where('id', id)
        .where('active', true)
        .update({
          sale_price: price,
          updated_at: new Date(),
        })

      if (!updated) {
        return response.notFound({
          success: false,
          message: 'Producto no encontrado o inactivo.',
        })
      }

      return response.ok({
        success: true,
        message:
          'Precio de venta actualizado correctamente.',

        data: {
          id,
          salePrice: Number(price),
        },
      })
    } catch (error) {
      console.error('[Inventory] updatePrice:', error)

      return response.internalServerError({
        success: false,
        message:
          'No se pudo actualizar el precio del producto.',
      })
    }
  }

  // =========================================
  // HISTORIAL DE MOVIMIENTOS POR PRODUCTO
  // GET /api/v1/inventory/:id/movements
  // =========================================
  async movements({ params, response }: HttpContext) {
    const id = positiveId(params.id)

    if (!id) {
      return response.badRequest({
        success: false,
        message: 'Producto inválido.',
      })
    }

    try {
      const product = await db
        .from('erp.products')
        .select('id', 'name', 'code', 'stock')
        .where('id', id)
        .first()

      if (!product) {
        return response.notFound({
          success: false,
          message: 'Producto no encontrado.',
        })
      }

      const movements = await db
        .from('erp.stock_movements')
        .select(
          'id',
          'movement_type',
          'quantity_change',
          'stock_before',
          'stock_after',
          'reference_type',
          'reference_id',
          'reason',
          'created_at'
        )
        .where('product_id', id)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(100)

      return response.ok({
        success: true,

        data: {
          product: {
            id: product.id,
            code: product.code,
            name: product.name,
            stock: Number(product.stock),
          },

          movements,
        },
      })
    } catch (error) {
      console.error('[Inventory] movements:', error)

      return response.internalServerError({
        success: false,
        message:
          'No se pudo cargar el historial de movimientos.',
      })
    }
  }
}
