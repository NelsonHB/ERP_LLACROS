
'use strict'

// ==========================================
// EZCUDO360 - PUNTO DE VENTA
// ==========================================

const API_BASE = '/api/v1'

const $ = (id) => document.getElementById(id)

// Productos y carrito
let products = []
let cart = []
let savingSale = false
let catalogReady = false
let catalogRequestId = 0

// Cliente seleccionado
let selectedCustomer = null
let customerLoading = false
let customerLookupId = 0
let customerTimer = null

// Notificaciones
let toastTimer = null

// ==========================================
// UTILIDADES
// ==========================================

function money(value) {
  const amount = Number(value)

  return `S/ ${(
    Number.isFinite(amount) ? amount : 0
  ).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function toCents(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null
  }

  const raw = String(value).trim()

  if (
    !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(raw)
  ) {
    return null
  }

  const [integer, fraction = ''] = raw.split('.')

  const cents =
    Number(integer) * 100 +
    Number(fraction.padEnd(2, '0'))

  if (
    !Number.isSafeInteger(cents) ||
    cents > 999999999999
  ) {
    return null
  }

  return cents
}

function centsText(cents) {
  return (cents / 100).toFixed(2)
}

function element(tag, className = '', text) {
  const node = document.createElement(tag)

  if (className) {
    node.className = className
  }

  if (text !== undefined) {
    node.textContent = String(text)
  }

  return node
}

function toast(message) {
  const node = $('posToast')

  node.textContent = String(message)
  node.classList.remove('pos-hidden')

  clearTimeout(toastTimer)

  toastTimer = setTimeout(() => {
    node.classList.add('pos-hidden')
  }, 4000)
}

function validImageUrl(value) {
  if (typeof value !== 'string') {
    return null
  }

  const url = value.trim()

  if (
    url.startsWith('/') &&
    !url.startsWith('//')
  ) {
    return url
  }

  try {
    const parsed = new URL(url)

    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    ) {
      return parsed.href
    }
  } catch {
    return null
  }

  return null
}

function getToken() {
  try {
    return localStorage.getItem('erp_token')
  } catch {
    return null
  }
}

// ==========================================
// API
// ==========================================

async function apiRequest(path, options = {}) {
  const token = getToken()

  if (!token) {
    throw new Error(
      'Inicia sesión para utilizar el Punto de Venta.'
    )
  }

  const response = await fetch(API_BASE + path, {
    ...options,

    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const result = await response
    .json()
    .catch(() => ({}))

  if (
    !response.ok ||
    result.success === false
  ) {
    if (response.status === 401) {
      throw new Error(
        'Tu sesión ha vencido. Inicia sesión nuevamente.'
      )
    }

    throw new Error(
      result.message ||
      `Error HTTP ${response.status}`
    )
  }

  return result.data
}

// ==========================================
// CARGAR PRODUCTOS DEL INVENTARIO
// ==========================================

async function loadProducts() {
  const grid = $('productGrid')
  const requestId = ++catalogRequestId

  catalogReady = false

  $('refreshProducts').disabled = true

  grid.replaceChildren(
    element(
      'p',
      'pos-empty',
      'Cargando productos...'
    )
  )

  updatePayment()

  try {
    const list = await apiRequest(
      '/sales/pos-products'
    )

    if (requestId !== catalogRequestId) {
      return
    }

    if (!Array.isArray(list)) {
      throw new Error(
        'La API no devolvió una lista válida de productos.'
      )
    }

    products = list.map((product) => ({
      id: Number(product.id),
      code: String(product.code || ''),
      name: String(product.name || ''),
      brand: String(product.brand || ''),
      category: String(product.category || ''),
      unit: String(product.unit || 'UND'),

      stock: Number(product.stock ?? 0),

      // PRECIO DEL INVENTARIO
      priceCents: toCents(
        product.salePrice
      ),

      // IMAGEN DEL PRODUCTO
      imageUrl: validImageUrl(
        product.imageUrl
      ),
    }))
      .filter((product) =>
        Number.isSafeInteger(product.id) &&
        product.id > 0 &&
        Number.isSafeInteger(product.stock) &&
        product.stock >= 0
      )

    // Mantener precios y existencias actualizados
    cart = cart.map((oldItem) => {
      const updated = products.find(
        (product) => product.id === oldItem.id
      )

      if (
        !updated ||
        updated.priceCents === null ||
        updated.priceCents <= 0 ||
        updated.stock <= 0
      ) {
        return null
      }

      return {
        ...updated,
        quantity: Math.min(
          oldItem.quantity,
          updated.stock
        ),
      }
    }).filter(Boolean)

    catalogReady = true

    renderProducts()
    renderCart()
  } catch (error) {
    if (requestId !== catalogRequestId) {
      return
    }

    grid.replaceChildren(
      element('p', 'pos-empty', error.message)
    )

    toast(error.message)
  } finally {
    if (requestId === catalogRequestId) {
      $('refreshProducts').disabled = savingSale
      updatePayment()
    }
  }
}

// ==========================================
// MOSTRAR PRODUCTOS
// ==========================================

function renderProducts() {
  const grid = $('productGrid')

  const search = $('searchProducts')
    .value
    .toLowerCase()
    .trim()

  const filtered = products.filter((product) => {
    const content = [
      product.name,
      product.code,
      product.brand,
      product.category,
    ].join(' ').toLowerCase()

    return content.includes(search)
  })

  grid.replaceChildren()

  if (!filtered.length) {
    grid.appendChild(
      element(
        'p',
        'pos-empty',
        'No se encontraron productos.'
      )
    )

    return
  }

  for (const product of filtered) {
    const card = element(
      'article',
      'product-card'
    )

    // FOTO
    const imageContainer = element(
      'div',
      'product-icon'
    )

    if (product.imageUrl) {
      const image = document.createElement('img')

      image.src = product.imageUrl
      image.alt = product.name
      image.loading = 'lazy'
      image.className = 'product-image'

      image.onerror = () => {
        imageContainer.replaceChildren(
          document.createTextNode('▣')
        )
      }

      imageContainer.appendChild(image)
    } else {
      imageContainer.textContent = '▣'
    }

    card.appendChild(imageContainer)

    // CÓDIGO
    card.appendChild(
      element(
        'span',
        'product-code',
        product.code || 'SIN CÓDIGO'
      )
    )

    // NOMBRE
    card.appendChild(
      element(
        'div',
        'product-name',
        product.name
      )
    )

    // MARCA
    if (product.brand) {
      card.appendChild(
        element(
          'span',
          'product-brand',
          product.brand
        )
      )
    }

    // STOCK
    card.appendChild(
      element(
        'span',
        'product-stock',
        `Stock disponible: ${product.stock} ${product.unit}`
      )
    )

    // PRECIO
    const hasPrice =
      product.priceCents !== null &&
      product.priceCents > 0

    card.appendChild(
      element(
        'strong',
        'product-price',
        hasPrice
          ? money(product.priceCents / 100)
          : 'Sin precio'
      )
    )

    // BOTÓN
    const selected = cart.find(
      (item) => item.id === product.id
    )?.quantity || 0

    let buttonText = '+ Agregar'

    if (!hasPrice) {
      buttonText = 'Configurar precio'
    } else if (product.stock <= 0) {
      buttonText = 'Sin stock'
    } else if (selected >= product.stock) {
      buttonText = 'Stock máximo'
    }

    const button = element(
      'button',
      'product-add',
      buttonText
    )

    button.type = 'button'

    button.disabled =
      savingSale ||
      !catalogReady ||
      !hasPrice ||
      selected >= product.stock

    button.addEventListener('click', () => {
      addToCart(product.id)
    })

    card.appendChild(button)
    grid.appendChild(card)
  }
}

// ==========================================
// AGREGAR PRODUCTO
// ==========================================

function addToCart(productId) {
  if (savingSale || !catalogReady) {
    return
  }

  const product = products.find(
    (item) => item.id === productId
  )

  if (
    !product ||
    product.priceCents === null ||
    product.priceCents <= 0
  ) {
    toast(
      'Configura primero el precio de venta en Inventario.'
    )
    return
  }

  const existing = cart.find(
    (item) => item.id === productId
  )

  const quantity = existing
    ? existing.quantity
    : 0

  if (quantity >= product.stock) {
    toast('No hay suficiente stock disponible.')
    return
  }

  if (existing) {
    existing.quantity++
  } else {
    cart.push({
      ...product,
      quantity: 1,
    })
  }

  renderCart()
}

// ==========================================
// CAMBIAR CANTIDAD
// ==========================================

function changeQuantity(productId, difference) {
  if (savingSale) return

  const item = cart.find(
    (product) => product.id === productId
  )

  if (!item) return

  const next = item.quantity + difference

  if (next > item.stock) {
    toast('No hay suficiente stock disponible.')
    return
  }

  if (next <= 0) {
    cart = cart.filter(
      (product) => product.id !== productId
    )
  } else {
    item.quantity = next
  }

  renderCart()
}

// ==========================================
// QUITAR PRODUCTO
// ==========================================

function removeFromCart(productId) {
  if (savingSale) return

  cart = cart.filter(
    (product) => product.id !== productId
  )

  renderCart()
}

// ==========================================
// VACIAR CARRITO
// ==========================================

function clearCart() {
  if (savingSale) return

  cart = []

  $('cashReceived').value = ''
  $('enableDiscount').checked = false
  $('discountAmount').value = '0'

  $('discountSection').classList.add(
    'pos-hidden'
  )

  renderCart()
}

// ==========================================
// CALCULAR TOTALES
// ==========================================

function calculateTotals() {
  let grossCents = 0

  for (const item of cart) {
    if (
      item.priceCents === null ||
      item.priceCents <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > item.stock
    ) {
      return { valid: false }
    }

    const lineCents =
      item.priceCents * item.quantity

    if (
      !Number.isSafeInteger(lineCents) ||
      grossCents + lineCents > 999999999999
    ) {
      return { valid: false }
    }

    grossCents += lineCents
  }

  const discountCents = $('enableDiscount').checked
    ? toCents($('discountAmount').value)
    : 0

  if (
    discountCents === null ||
    discountCents > grossCents
  ) {
    return { valid: false }
  }

  const totalCents =
    grossCents - discountCents

  const igvCents = Math.round(
    totalCents * 18 / 118
  )

  return {
    valid: true,
    grossCents,
    discountCents,
    totalCents,
    igvCents,
  }
}

// ==========================================
// RENDERIZAR CARRITO
// ==========================================

function renderCart() {
  const container = $('cartItems')

  container.replaceChildren()

  const quantity = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  $('cartCount').textContent =
    `${quantity} unidad${quantity === 1 ? '' : 'es'}`

  if (!cart.length) {
    container.appendChild(
      element(
        'p',
        'pos-empty',
        'El carrito está vacío.'
      )
    )
  }

  for (const item of cart) {
    const row = element('div', 'cart-item')
    const info = element('div', 'cart-item-info')

    info.appendChild(
      element('strong', '', item.name)
    )

    info.appendChild(
      element(
        'small',
        '',
        `${money(item.priceCents / 100)} c/u`
      )
    )

    const actions = element(
      'div',
      'cart-item-actions'
    )

    // RESTAR
    const minus = element(
      'button',
      'cart-qty-btn',
      '−'
    )

    minus.type = 'button'
    minus.disabled = savingSale

    minus.addEventListener('click', () => {
      changeQuantity(item.id, -1)
    })

    // CANTIDAD
    const count = element(
      'span',
      'cart-qty',
      String(item.quantity)
    )

    // SUMAR
    const plus = element(
      'button',
      'cart-qty-btn',
      '+'
    )

    plus.type = 'button'

    plus.disabled =
      savingSale ||
      item.quantity >= item.stock

    plus.addEventListener('click', () => {
      changeQuantity(item.id, 1)
    })

    // QUITAR
    const remove = element(
      'button',
      'cart-remove',
      'Quitar'
    )

    remove.type = 'button'
    remove.disabled = savingSale

    remove.addEventListener('click', () => {
      removeFromCart(item.id)
    })

    actions.append(
      minus,
      count,
      plus,
      remove
    )

    info.appendChild(actions)
    row.appendChild(info)

    row.appendChild(
      element(
        'strong',
        'cart-item-price',
        money(
          item.priceCents * item.quantity / 100
        )
      )
    )

    container.appendChild(row)
  }

  renderProducts()
  updatePayment()
}

// ==========================================
// DATOS DEL CLIENTE
// ==========================================

function showCustomerStatus(message, status = '') {
  const node = $('customerLookupResult')

  node.textContent = message

  node.classList.remove(
    'found',
    'not-found'
  )

  if (status) {
    node.classList.add(status)
  }
}

// ==========================================
// MOSTRAR NOMBRE AUTOMÁTICO
// ==========================================

function showCustomerFound(customer) {
  // Este campo aparece debajo del DNI/RUC.
  const nameInput = $('customerName')

  nameInput.value = String(customer.name || '')

  nameInput.classList.add(
    'customer-found'
  )

  // Estado separado, sin repetir el nombre.
  showCustomerStatus(
    '✓ Cliente encontrado correctamente.',
    'found'
  )
}

// ==========================================
// LIMPIAR NOMBRE
// ==========================================

function clearCustomerName() {
  $('customerName').value = ''

  $('customerName').classList.remove(
    'customer-found'
  )
}

// ==========================================
// VERIFICAR CLIENTE SELECCIONADO
// ==========================================

function currentCustomerIsValid() {
  if (
    !selectedCustomer ||
    customerLoading
  ) {
    return false
  }

  const type =
    $('customerDocumentType').value

  const number =
    $('customerDocumentNumber').value.trim()

  return (
    String(selectedCustomer.documentType) === type &&
    String(selectedCustomer.documentNumber) === number &&
    String(selectedCustomer.name || '') !== '' &&
    $('customerName').value === selectedCustomer.name
  )
}

// ==========================================
// REINICIAR CLIENTE
// ==========================================

function resetCustomer() {
  clearTimeout(customerTimer)

  customerLookupId++
  customerLoading = false
  selectedCustomer = null

  $('customerDocumentType').value = 'DNI'
  $('customerDocumentNumber').value = ''

  $('customerDocumentNumber').maxLength = 8

  $('customerDocumentNumber').placeholder =
    'Ingresa los 8 dígitos'

  clearCustomerName()

  showCustomerStatus(
    'Ingresa el documento para buscar al cliente.'
  )

  updatePayment()
}

// ==========================================
// CONFIGURAR DNI / RUC
// ==========================================

function configureCustomerDocument() {
  const type =
    $('customerDocumentType').value

  const input =
    $('customerDocumentNumber')

  const digits = type === 'RUC' ? 11 : 8

  input.maxLength = digits

  input.placeholder =
    `Ingresa los ${digits} dígitos`

  input.value = input.value
    .replace(/\D/g, '')
    .slice(0, digits)

  lookupCustomer()
}

// ==========================================
// BUSCAR CLIENTE EN POSTGRESQL
// ==========================================

function lookupCustomer() {
  clearTimeout(customerTimer)

  const lookupId = ++customerLookupId

  selectedCustomer = null
  customerLoading = false

  // Si se cambia el documento, se elimina
  // inmediatamente el nombre anterior.
  clearCustomerName()

  const documentType =
    $('customerDocumentType').value

  const documentNumber =
    $('customerDocumentNumber').value.trim()

  const requiredDigits =
    documentType === 'RUC' ? 11 : 8

  if (documentNumber.length !== requiredDigits) {
    showCustomerStatus(
      `Ingresa los ${requiredDigits} dígitos del ${documentType}.`
    )

    updatePayment()
    return
  }

  customerLoading = true

  showCustomerStatus(
    'Buscando cliente...'
  )

  updatePayment()

  customerTimer = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        documentType,
        documentNumber,
      })

      const customer = await apiRequest(
        `/customers/lookup?${params.toString()}`
      )

      // Ignorar resultados de búsquedas antiguas.
      if (lookupId !== customerLookupId) {
        return
      }

      if (
        $('customerDocumentType').value !== documentType ||
        $('customerDocumentNumber').value !== documentNumber
      ) {
        return
      }

      if (
        !customer ||
        !customer.id ||
        !customer.name ||
        customer.documentType !== documentType ||
        String(customer.documentNumber) !== documentNumber
      ) {
        throw new Error(
          'No se pudo validar la identidad del cliente.'
        )
      }

      selectedCustomer = {
        id: Number(customer.id),
        name: String(customer.name),
        documentType:
          String(customer.documentType),
        documentNumber:
          String(customer.documentNumber),
      }

      // MOSTRAR NOMBRE DEBAJO DEL DOCUMENTO
      showCustomerFound(selectedCustomer)

    } catch (error) {
      if (lookupId !== customerLookupId) {
        return
      }

      selectedCustomer = null

      clearCustomerName()

      showCustomerStatus(
        error.message,
        'not-found'
      )
    } finally {
      if (lookupId === customerLookupId) {
        customerLoading = false
        updatePayment()
      }
    }
  }, 350)
}

// ==========================================
// MÉTODO DE PAGO Y VUELTO
// ==========================================

function updatePayment() {
  const values = calculateTotals()

  $('cartSubtotal').textContent =
    values.valid
      ? money(values.grossCents / 100)
      : 'Revisar'

  $('cartDiscount').textContent =
    values.valid
      ? `- ${money(values.discountCents / 100)}`
      : 'Revisar'

  $('cartIgv').textContent =
    values.valid
      ? money(values.igvCents / 100)
      : '—'

  $('cartTotal').textContent =
    values.valid
      ? money(values.totalCents / 100)
      : 'Importe inválido'

  const method =
    $('paymentMethod').value

  const isCash =
    method === 'EFECTIVO'

  $('cashSection').classList.toggle(
    'pos-hidden',
    !isCash
  )

  $('changeSection').classList.toggle(
    'pos-hidden',
    !isCash
  )

  const receivedCents =
    toCents($('cashReceived').value)

  const validCash =
    !isCash ||
    (
      values.valid &&
      receivedCents !== null &&
      receivedCents >= values.totalCents
    )

  const changeCents =
    isCash &&
    values.valid &&
    receivedCents !== null
      ? Math.max(
          0,
          receivedCents - values.totalCents
        )
      : 0

  $('cashChange').textContent =
    money(changeCents / 100)

  // No permitir ventas sin cliente válido.
  $('completeSale').disabled =
    savingSale ||
    !catalogReady ||
    cart.length === 0 ||
    !values.valid ||
    !validCash ||
    !currentCustomerIsValid()
}

// ==========================================
// CONFIRMAR VENTA
// ==========================================

async function completeSale() {
  if (
    savingSale ||
    !catalogReady ||
    !cart.length
  ) {
    return
  }

  updatePayment()

  if (!currentCustomerIsValid()) {
    toast(
      'Ingresa un DNI o RUC de un cliente registrado.'
    )
    return
  }

  const values = calculateTotals()

  if (
    !values.valid ||
    $('completeSale').disabled
  ) {
    toast(
      'Revisa los productos, descuento y forma de pago.'
    )
    return
  }

  const customerSnapshot = {
    ...selectedCustomer,
  }

  const snapshot = cart.map((item) => ({
    ...item,
  }))

  const method =
    $('paymentMethod').value

  const received =
    method === 'EFECTIVO'
      ? $('cashReceived').value.trim()
      : centsText(values.totalCents)

  const confirmation = window.confirm(
    `¿Confirmar venta a ${customerSnapshot.name} por ${money(values.totalCents / 100)}?`
  )

  if (!confirmation) {
    return
  }

  savingSale = true

  // Bloquear controles durante el registro.
  const lockedControls = [
    'completeSale',
    'clearCart',
    'refreshProducts',
    'paymentMethod',
    'cashReceived',
    'enableDiscount',
    'discountAmount',
    'customerDocumentType',
    'customerDocumentNumber',
  ]

  for (const id of lockedControls) {
    $(id).disabled = true
  }

  try {
    const sale = await apiRequest('/sales', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        customerId: customerSnapshot.id,

        customerDocumentType:
          customerSnapshot.documentType,

        customerDocumentNumber:
          customerSnapshot.documentNumber,

        items: snapshot.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),

        discountAmount:
          centsText(values.discountCents),

        expectedTotal:
          centsText(values.totalCents),

        paymentMethod: method,
        amountReceived: received,
      }),
    })

    // Datos del comprobante provenientes
    // del servidor, no del formulario.
    if (!sale || !sale.id) {
      throw new Error(
        'El servidor no devolvió el comprobante. Revisa el historial antes de repetir la venta.'
      )
    }

    // Solo limpiar tras confirmación del servidor.
    cart = []

    $('cashReceived').value = ''
    $('enableDiscount').checked = false
    $('discountAmount').value = '0'

    $('discountSection').classList.add(
      'pos-hidden'
    )

    showReceipt(sale)

    resetCustomer()

    toast(
      'Venta registrada correctamente.'
    )
  } catch (error) {
    toast(error.message)
  } finally {
    savingSale = false

    for (const id of lockedControls) {
      $(id).disabled = false
    }

    // Reconsultar las existencias.
    await loadProducts()
    renderCart()
  }
}

// ==========================================
// LÍNEAS DEL COMPROBANTE
// ==========================================

function receiptLine(container, label, value) {
  const line = element(
    'div',
    'receipt-line'
  )

  line.appendChild(
    element('span', '', label)
  )

  line.appendChild(
    element('strong', '', value)
  )

  container.appendChild(line)
}

// ==========================================
// COMPROBANTE CON NOMBRE Y DNI / RUC
// ==========================================

function showReceipt(sale) {
  const container = $('receiptContent')

  container.replaceChildren()

  const saleNumber =
    sale.saleNumber ||
    sale.sale_number ||
    sale.id ||
    '—'

  const date =
    new Date(sale.saleDate || Date.now())

  container.appendChild(
    element(
      'p',
      '',
      `Venta: ${saleNumber}`
    )
  )

  container.appendChild(
    element(
      'p',
      '',
      `Fecha: ${date.toLocaleString('es-PE')}`
    )
  )

  // ======================================
  // DATOS DEL CLIENTE EN LA BOLETA
  // ======================================

  const customerBox = element(
    'div',
    'receipt-customer'
  )

  const customerName =
    sale.customerName || '—'

  const documentType =
    sale.customerDocumentType || 'Documento'

  const documentNumber =
    sale.customerDocumentNumber || '—'

  customerBox.appendChild(
    element(
      'strong',
      '',
      `Cliente: ${customerName}`
    )
  )

  customerBox.appendChild(
    element(
      'small',
      '',
      `${documentType}: ${documentNumber}`
    )
  )

  container.appendChild(customerBox)

  // ======================================
  // MÉTODO DE PAGO
  // ======================================

  receiptLine(
    container,
    'Método de pago',
    sale.paymentMethod || '—'
  )

  // ======================================
  // PRODUCTOS VENDIDOS
  // ======================================

  for (const item of sale.items || []) {
    receiptLine(
      container,
      `${item.name} × ${item.quantity}`,
      money(item.subtotal)
    )
  }

  // ======================================
  // IMPORTES CONFIRMADOS
  // ======================================

  receiptLine(
    container,
    'Productos',
    money(sale.subtotal)
  )

  receiptLine(
    container,
    'Descuento',
    `- ${money(sale.discountAmount)}`
  )

  receiptLine(
    container,
    'IGV incluido',
    money(sale.taxAmount)
  )

  receiptLine(
    container,
    'TOTAL',
    money(sale.total)
  )

  // ======================================
  // EFECTIVO Y VUELTO
  // ======================================

  if (sale.paymentMethod === 'EFECTIVO') {
    receiptLine(
      container,
      'Monto recibido',
      money(sale.amountReceived)
    )

    receiptLine(
      container,
      'Vuelto',
      money(sale.changeAmount)
    )
  }

  $('receiptModal').classList.remove(
    'pos-hidden'
  )
}

// ==========================================
// CERRAR COMPROBANTE
// ==========================================

function closeReceipt() {
  $('receiptModal').classList.add(
    'pos-hidden'
  )
}

// ==========================================
// EVENTOS DEL POS
// ==========================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    // BUSCAR PRODUCTOS
    $('searchProducts').addEventListener(
      'input',
      renderProducts
    )

    // ACTUALIZAR PRODUCTOS
    $('refreshProducts').addEventListener(
      'click',
      loadProducts
    )

    // VACIAR CARRITO
    $('clearCart').addEventListener(
      'click',
      () => {
        if (!cart.length) return

        if (
          window.confirm('¿Vaciar el carrito?')
        ) {
          clearCart()
        }
      }
    )

    // ACTIVAR DESCUENTO
    $('enableDiscount').addEventListener(
      'change',
      () => {
        const enabled =
          $('enableDiscount').checked

        $('discountSection').classList.toggle(
          'pos-hidden',
          !enabled
        )

        if (!enabled) {
          $('discountAmount').value = '0'
        }

        updatePayment()
      }
    )

    // CAMBIAR DESCUENTO
    $('discountAmount').addEventListener(
      'input',
      updatePayment
    )

    // CAMBIAR MÉTODO DE PAGO
    $('paymentMethod').addEventListener(
      'change',
      updatePayment
    )

    // CALCULAR VUELTO
    $('cashReceived').addEventListener(
      'input',
      updatePayment
    )

    // ======================================
    // TIPO DE DOCUMENTO DEL CLIENTE
    // ======================================

    $('customerDocumentType').addEventListener(
      'change',
      () => {
        $('customerDocumentNumber').value = ''
        configureCustomerDocument()
      }
    )

    // ======================================
    // BUSCAR CLIENTE AL ESCRIBIR DNI / RUC
    // ======================================

    $('customerDocumentNumber').addEventListener(
      'input',
      configureCustomerDocument
    )

    // CONFIRMAR VENTA
    $('completeSale').addEventListener(
      'click',
      completeSale
    )

    // CERRAR COMPROBANTE
    $('closeReceipt').addEventListener(
      'click',
      closeReceipt
    )

    $('finishReceipt').addEventListener(
      'click',
      closeReceipt
    )

    // IMPRIMIR
    $('printReceipt').addEventListener(
      'click',
      () => window.print()
    )

    // ======================================
    // INICIALIZAR POS
    // ======================================

    resetCustomer()
    loadProducts()
    renderCart()
  }
)
