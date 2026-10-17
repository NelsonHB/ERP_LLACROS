
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export default class ProductsController {
  private async images(productId: number) {
    return db.from('product_images')
      .where('product_id', productId)
      .orderBy('is_primary', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
  }

  private async serialize(product: Product) {
    const images = await this.images(product.id)

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      price: Number(product.price),
      cost: Number(product.cost),
      stock: product.stock,
      active: product.active,
      description: product.description,
      brand: product.brand,
      unit: product.unit,
      minimumStock: product.minimumStock,
      imageUrl: images[0]?.image_path || null,
      images: images.map((image) => ({
        id: image.id,
        url: image.image_path,
        isPrimary: image.is_primary,
      })),
    }
  }

  // Catálogo para POS: solo productos activos
  async index({ response }: HttpContext) {
    const products = await Product.query()
      .where('active', true)
      .orderBy('id', 'asc')

    const data = await Promise.all(
      products.map(async (product) => {
        const images = await this.images(product.id)

        return {
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          price: Number(product.price),
          stock: product.stock,
          imageUrl: images[0]?.image_path || null,
        }
      })
    )

    return response.ok({ success: true, data })
  }

  // Inventario: incluye productos inactivos
  async inventory({ response }: HttpContext) {
    const products = await Product.query().orderBy('id', 'desc')

    const data = await Promise.all(
      products.map((product) => this.serialize(product))
    )

    return response.ok({ success: true, data })
  }

  // Registrar producto
  async store({ request, response }: HttpContext) {
    const data = request.only([
      'code', 'name', 'category', 'price', 'cost',
      'description', 'brand', 'unit', 'minimumStock',
    ])

    const code = String(data.code || '').trim()
    const name = String(data.name || '').trim()
    const category = String(data.category || '').trim()
    const price = Number(data.price)
    const cost = Number(data.cost)
    const minimumStock = Number(data.minimumStock ?? 0)

    if (!code || !name || !category) {
      return response.badRequest({
        success: false,
        message: 'Código, nombre y categoría son obligatorios',
      })
    }

    if (
      !Number.isFinite(price) || price < 0 ||
      !Number.isFinite(cost) || cost < 0 ||
      !Number.isInteger(minimumStock) || minimumStock < 0
    ) {
      return response.badRequest({
        success: false,
        message: 'Precio, costo o stock mínimo inválido',
      })
    }

    const exists = await Product.query().where('code', code).first()

    if (exists) {
      return response.conflict({
        success: false,
        message: 'Ya existe un producto con ese código',
      })
    }

    const product = await Product.create({
      code,
      name,
      category,
      price,
      cost,
      stock: 0,
      active: true,
      description: data.description || null,
      brand: data.brand || null,
      unit: data.unit || 'unidad',
      minimumStock,
    })

    return response.created({
      success: true,
      message: 'Producto registrado correctamente',
      data: await this.serialize(product),
    })
  }

  // Editar producto
  async update({ params, request, response }: HttpContext) {
    const product = await Product.find(params.id)

    if (!product) {
      return response.notFound({
        success: false,
        message: 'Producto no encontrado',
      })
    }

    const data = request.only([
      'code', 'name', 'category', 'price', 'cost',
      'description', 'brand', 'unit', 'minimumStock', 'active',
    ])

    if (data.code !== undefined) {
      const code = String(data.code).trim()

      if (!code) {
        return response.badRequest({
          success: false,
          message: 'El código es obligatorio',
        })
      }

      const exists = await Product.query()
        .where('code', code)
        .whereNot('id', product.id)
        .first()

      if (exists) {
        return response.conflict({
          success: false,
          message: 'Otro producto utiliza ese código',
        })
      }

      product.code = code
    }

    if (data.name !== undefined) {
      if (!String(data.name).trim()) {
        return response.badRequest({
          message: 'El nombre es obligatorio',
        })
      }
      product.name = String(data.name).trim()
    }

    if (data.category !== undefined) {
      if (!String(data.category).trim()) {
        return response.badRequest({
          message: 'La categoría es obligatoria',
        })
      }
      product.category = String(data.category).trim()
    }

    if (data.price !== undefined) {
      const price = Number(data.price)
      if (!Number.isFinite(price) || price < 0) {
        return response.badRequest({ message: 'Precio inválido' })
      }
      product.price = price
    }

    if (data.cost !== undefined) {
      const cost = Number(data.cost)
      if (!Number.isFinite(cost) || cost < 0) {
        return response.badRequest({ message: 'Costo inválido' })
      }
      product.cost = cost
    }

    if (data.minimumStock !== undefined) {
      const minimum = Number(data.minimumStock)
      if (!Number.isInteger(minimum) || minimum < 0) {
        return response.badRequest({ message: 'Stock mínimo inválido' })
      }
      product.minimumStock = minimum
    }

    if (data.description !== undefined) {
      product.description = data.description || null
    }

    if (data.brand !== undefined) {
      product.brand = data.brand || null
    }

    if (data.unit !== undefined) {
      product.unit = data.unit || 'unidad'
    }

    if (data.active !== undefined) {
      if (typeof data.active !== 'boolean') {
        return response.badRequest({ message: 'Estado inválido' })
      }
      product.active = data.active
    }

    // El stock NO se modifica desde esta operación.
    await product.save()

    return response.ok({
      success: true,
      message: 'Producto actualizado correctamente',
      data: await this.serialize(product),
    })
  }

  // Desactivar producto sin eliminar su historial
  async destroy({ params, response }: HttpContext) {
    const product = await Product.find(params.id)

    if (!product) {
      return response.notFound({ message: 'Producto no encontrado' })
    }

    product.active = false
    await product.save()

    return response.ok({
      success: true,
      message: 'Producto desactivado correctamente',
    })
  }

  // Subir imagen
  async uploadImage({ params, request, response }: HttpContext) {
    const product = await Product.find(params.id)

    if (!product) {
      return response.notFound({ message: 'Producto no encontrado' })
    }

    const file = request.file('image', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!file) {
      return response.badRequest({
        message: 'Selecciona una imagen válida',
      })
    }

    if (!file.isValid) {
      return response.badRequest({
        message: file.errors.map((error) => error.message).join(', '),
      })
    }

    const extensions: Record<string, string> = {
      jpg: 'jpg',
      jpeg: 'jpg',
      png: 'png',
      webp: 'webp',
    }

    const extension = extensions[file.extname?.toLowerCase() || '']

    if (!extension) {
      return response.badRequest({ message: 'Formato no permitido' })
    }

    const directory = app.makePath('public/uploads/products')
    await mkdir(directory, { recursive: true })

    const filename = `${randomUUID()}.${extension}`

    await file.move(directory, { name: filename })

    if (!file.isValid) {
      return response.internalServerError({
        message: 'No se pudo guardar la imagen',
      })
    }

    const path = `/uploads/products/${filename}`

    const existing = await db.from('product_images')
      .where('product_id', product.id)
      .first()

    await db.table('product_images').insert({
      product_id: product.id,
      image_path: path,
      alt_text: product.name,
      is_primary: !existing,
      sort_order: 0,
      created_at: new Date(),
    })

    return response.created({
      success: true,
      message: 'Imagen guardada correctamente',
      data: { url: path },
    })
  }
}
