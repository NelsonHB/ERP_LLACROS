
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { throttle, throttleLogin } from '#start/limiter'

// ============================================
// CONTROLADORES DEL ERP EZCUDO360
// ============================================

import CustomersController from '#controllers/customers_controller'
import InventoryController from '#controllers/inventory_controller'
import ProductsController from '#controllers/products_controller'
import SuppliersController from '#controllers/suppliers_controller'
import CategoriesController from '#controllers/categories_controller'
import SupplierProductsController from '#controllers/supplier_products_controller'
import PurchasesController from '#controllers/purchases_controller'
import SalesController from '#controllers/sales_controller'
import SalesAnalyticsController from '#controllers/sales_analytics_controller'

// ============================================
// EZCUDO360 - RUTAS PRINCIPALES
// ============================================

// Página de inicio
router.get('/', ({ response }) => {
  return response.redirect('/index.html')
})

// Comprobar funcionamiento del servidor
router.get('/health', () => {
  return {
    status: 'online',
    service: 'EZCUDO360 ERP',
  }
})

// ============================================
// API PRINCIPAL - VERSIÓN 1
// ============================================

router.group(() => {

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================

  router
    .post('/auth/login', [
      controllers.AccessTokens,
      'store',
    ])
    .use(throttleLogin)

  // ==========================================
  // CUENTA DEL USUARIO
  // ==========================================

  router.group(() => {

    // Consultar perfil
    router.get('/profile', [
      controllers.Profile,
      'show',
    ])

    // Cerrar sesión
    router.post('/logout', [
      controllers.AccessTokens,
      'destroy',
    ])

  })
    .prefix('/account')
    .use(middleware.auth())

  // ==========================================
  // PRODUCTOS E INVENTARIO
  // ==========================================

  router.group(() => {

    // Listar productos
    router.get('/', [
      ProductsController,
      'index',
    ])

    // Consultar inventario
    router.get('/inventory', [
      ProductsController,
      'inventory',
    ])

    // Registrar producto
    router.post('/', [
      ProductsController,
      'store',
    ])

    // Actualizar producto
    router.put('/:id', [
      ProductsController,
      'update',
    ])

    // Eliminar producto
    router.delete('/:id', [
      ProductsController,
      'destroy',
    ])

    // Subir imagen del producto
    router.post('/:id/images', [
      ProductsController,
      'uploadImage',
    ])

  })
    .prefix('/products')
    .use(middleware.auth())

  // ==========================================
  // PROVEEDORES
  // ==========================================

  router.group(() => {

    // Listar proveedores
    router.get('/', [
      SuppliersController,
      'index',
    ])

    // Consultar proveedor
    router.get('/:id', [
      SuppliersController,
      'show',
    ])

    // Registrar proveedor
    router.post('/', [
      SuppliersController,
      'store',
    ])

    // Actualizar proveedor
    router.put('/:id', [
      SuppliersController,
      'update',
    ])

    // Eliminar / desactivar proveedor
    router.delete('/:id', [
      SuppliersController,
      'destroy',
    ])

  })
    .prefix('/suppliers')
    .use(middleware.auth())

  // ==========================================
  // CATEGORÍAS
  // ==========================================

  router.group(() => {

    // Listar categorías
    router.get('/', [
      CategoriesController,
      'index',
    ])

    // Consultar una categoría
    router.get('/:id', [
      CategoriesController,
      'show',
    ])

    // Registrar categoría
    router.post('/', [
      CategoriesController,
      'store',
    ])

    // Actualizar categoría
    router.put('/:id', [
      CategoriesController,
      'update',
    ])

    // Desactivar categoría
    router.delete('/:id', [
      CategoriesController,
      'destroy',
    ])

  })
    .prefix('/categories')
    .use(middleware.auth())

  // ==========================================
  // PRODUCTOS POR PROVEEDOR
  // ==========================================

  router.group(() => {

    // Listar productos asociados a proveedores
    router.get('/', [
      SupplierProductsController,
      'index',
    ])

    // Listar proveedores disponibles
    router.get('/suppliers', [
      SupplierProductsController,
      'suppliers',
    ])

    // Consultar catálogo
    router.get('/catalog', [
      SupplierProductsController,
      'catalog',
    ])

    // Listar categorías para productos
    router.get('/categories', [
      SupplierProductsController,
      'categories',
    ])

    // Crear producto y asociarlo al proveedor
    router.post('/new-product', [
      SupplierProductsController,
      'createProductAndLink',
    ])

    // Subir imágenes
    router.post('/products/:productId/images', [
      SupplierProductsController,
      'uploadImage',
    ])

    // Eliminar imagen
    router.delete('/products/:productId/images/:imageId', [
      SupplierProductsController,
      'deleteImage',
    ])

    // Establecer imagen principal
    router.patch(
      '/products/:productId/images/:imageId/primary',
      [
        SupplierProductsController,
        'setPrimaryImage',
      ]
    )

    // Asociar producto existente a proveedor
    router.post('/', [
      SupplierProductsController,
      'store',
    ])

    // Actualizar asociación
    router.put('/:id', [
      SupplierProductsController,
      'update',
    ])

    // Eliminar asociación
    router.delete('/:id', [
      SupplierProductsController,
      'destroy',
    ])

  })
    .prefix('/supplier-products')
    .use(middleware.auth())
  
  // ==========================================
  // INVENTARIO
  // ==========================================

  router.group(() => {

    // Listar productos del inventario
    router.get('/', [
      InventoryController,
      'index',
    ])

    // Estadísticas
    router.get('/stats', [
      InventoryController,
      'stats',
    ])

    // Categorías para los filtros
    router.get('/categories', [
      InventoryController,
      'categories',
    ])

    // Actualizar precio de venta
    router.patch('/:id/price', [
      InventoryController,
      'updatePrice',
    ])

    // Historial de movimientos
    router.get('/:id/movements', [
      InventoryController,
      'movements',
    ])

  })
    .prefix('/inventory')
    .use(middleware.auth())

  // ==========================================
  // COMPRAS
  // ==========================================

  router.group(() => {

    // Listar proveedores activos
    router.get('/suppliers', [
      PurchasesController,
      'suppliers',
    ])

    // Consultar productos del proveedor
    router.get('/catalog', [
      PurchasesController,
      'catalog',
    ])

    // Historial de compras
    router.get('/', [
      PurchasesController,
      'index',
    ])

    // Consultar detalle de compra
    router.get('/:id', [
      PurchasesController,
      'show',
    ])

    // Registrar nueva compra
    router.post('/', [
      PurchasesController,
      'store',
    ])

    // Recibir compra y actualizar inventario
    router.post('/:id/receive', [
      PurchasesController,
      'receive',
    ])

    // Anular borrador de compra
    router.post('/:id/cancel', [
      PurchasesController,
      'cancel',
    ])

  })
    .prefix('/purchases')
    .use(middleware.auth())

  
  
  // ==========================================
  // VENTAS / POS
  // ==========================================

  router.group(() => {

    // Catálogo de productos
    router.get('/pos-products', [
      SalesController,
      'posProducts',
    ])

    // Historial de ventas
    router.get('/', [
      SalesController,
      'index',
    ])

    // Detalle de venta
    router.get('/:id', [
      SalesController,
      'show',
    ])

    // Registrar venta con cliente
    router.post('/', [
      SalesController,
      'store',
    ])

  })
    .prefix('/sales')
    .use(middleware.auth())

  
  
  // ==========================================
  // CLIENTES
  // ==========================================

  router.group(() => {

    // Buscar por DNI o RUC para el POS
    router.get('/lookup', [
      CustomersController,
      'lookup',
    ])

    // Listar clientes
    router.get('/', [
      CustomersController,
      'index',
    ])

    // Ver cliente
    router.get('/:id', [
      CustomersController,
      'show',
    ])

    // Registrar cliente
    router.post('/', [
      CustomersController,
      'store',
    ])

    // Editar cliente
    router.put('/:id', [
      CustomersController,
      'update',
    ])

    // Cambiar estado
    router.patch('/:id/status', [
      CustomersController,
      'changeStatus',
    ])

    // Desactivar cliente
    router.delete('/:id', [
      CustomersController,
      'destroy',
    ])

    })
    .prefix('/customers')
    .use(middleware.auth())


  // ==========================================
  // ANALÍTICA PREDICTIVA
  // ==========================================

  router.get('/sales-analytics/forecast', [
    SalesAnalyticsController,
    'forecast',
  ]).use(middleware.auth())


})

  .prefix('/api/v1')
  .use(throttle)