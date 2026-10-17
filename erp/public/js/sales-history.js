
'use strict'

// ==========================================
// EZCUDO360 - HISTORIAL DE VENTAS
// ==========================================

const SALES_API = '/api/v1/sales'
const $ = (id) => document.getElementById(id)

const historyState = {
  sales: [],
  filtered: [],
  page: 1,
  perPage: 10,
  selectedMonth: '',
  todayOnly: false,
  selectedSale: null,
  requestId: 0,
  detailRequestId: 0,
}

let historyToastTimer = null

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

function escapeHtml(value) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => map[character]
  )
}

function validDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function formatDate(value) {
  const date = validDate(value)

  if (!date) return '—'

  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Fecha local AAAA-MM-DD
function localDateKey(value) {
  const date = validDate(value)

  if (!date) return ''

  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// Mes local AAAA-MM
function monthKey(value) {
  return localDateKey(value).slice(0, 7)
}

function monthName(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) {
    return 'Todos los meses'
  }

  const [year, month] = key.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  })
}

function toast(message) {
  const node = $('historyToast')

  node.textContent = String(message)
  node.classList.remove('history-hidden')

  clearTimeout(historyToastTimer)

  historyToastTimer = setTimeout(() => {
    node.classList.add('history-hidden')
  }, 4000)
}

function getToken() {
  try {
    return localStorage.getItem('erp_token')
  } catch {
    return null
  }
}

// ==========================================
// API DE VENTAS
// ==========================================

async function salesRequest(path = '') {
  const token = getToken()

  if (!token) {
    throw new Error(
      'Inicia sesión para consultar las ventas.'
    )
  }

  const response = await fetch(
    SALES_API + path,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  )

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
// NORMALIZAR REGISTROS
// ==========================================

function normalizeSale(row) {
  return {
    id: Number(row.id),

    saleNumber: String(
      row.saleNumber ??
      row.sale_number ??
      row.id ??
      '—'
    ),

    saleDate:
      row.saleDate ??
      row.sale_date ??
      row.createdAt ??
      row.created_at ??
      null,

    customerId:
      row.customerId ??
      row.customer_id ??
      null,

    customerName: String(
      row.customerName ??
      row.customer_name ??
      'Cliente no especificado'
    ),

    customerDocumentType: String(
      row.customerDocumentType ??
      row.document_type ??
      ''
    ),

    customerDocumentNumber: String(
      row.customerDocumentNumber ??
      row.document_number ??
      ''
    ),

    subtotal: Number(
      row.subtotal ?? 0
    ),

    discountAmount: Number(
      row.discountAmount ??
      row.discount_amount ??
      0
    ),

    taxAmount: Number(
      row.taxAmount ??
      row.tax_amount ??
      0
    ),

    total: Number(
      row.total ?? 0
    ),

    status: String(
      row.status ?? ''
    ).toUpperCase(),
  }
}

// ==========================================
// CARGAR VENTAS
// ==========================================

async function loadSales() {
  const requestId = ++historyState.requestId

  $('refreshSales').disabled = true

  $('salesTable').innerHTML = `
    <tr>
      <td colspan="7" class="history-empty">
        Cargando historial de ventas...
      </td>
    </tr>
  `

  try {
    const list = await salesRequest()

    if (requestId !== historyState.requestId) {
      return
    }

    if (!Array.isArray(list)) {
      throw new Error(
        'El servidor no devolvió una lista válida de ventas.'
      )
    }

    historyState.sales = list
      .map(normalizeSale)
      .filter((sale) =>
        Number.isSafeInteger(sale.id) &&
        sale.id > 0
      )
      .sort((a, b) => {
        const dateA =
          validDate(a.saleDate)?.getTime() ?? 0

        const dateB =
          validDate(b.saleDate)?.getTime() ?? 0

        return dateB - dateA || b.id - a.id
      })

    applyFilters()
  } catch (error) {
    if (requestId !== historyState.requestId) {
      return
    }

    historyState.sales = []
    historyState.filtered = []

    $('salesTable').innerHTML = `
      <tr>
        <td colspan="7" class="history-empty">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `

    resetStatistics()
    renderPagination()

    toast(error.message)
  } finally {
    if (requestId === historyState.requestId) {
      $('refreshSales').disabled = false
    }
  }
}

// ==========================================
// FILTRAR VENTAS
// ==========================================

function applyFilters() {
  const search = $('searchSales')
    .value
    .trim()
    .toLowerCase()

  const status = $('statusFilter').value

  const selectedMonth =
    historyState.selectedMonth

  const today = localDateKey(new Date())

  historyState.filtered = historyState.sales.filter(
    (sale) => {

      // FILTRO DEL DÍA
      if (
        historyState.todayOnly &&
        localDateKey(sale.saleDate) !== today
      ) {
        return false
      }

      // FILTRO DEL MES
      if (
        !historyState.todayOnly &&
        selectedMonth &&
        monthKey(sale.saleDate) !== selectedMonth
      ) {
        return false
      }

      // FILTRO POR ESTADO
      if (
        status !== 'all' &&
        sale.status !== status
      ) {
        return false
      }

      // BÚSQUEDA
      if (search) {
        const content = [
          sale.saleNumber,
          sale.customerName,
          sale.customerDocumentType,
          sale.customerDocumentNumber,
          sale.id,
        ].join(' ').toLowerCase()

        if (!content.includes(search)) {
          return false
        }
      }

      return true
    }
  )

  historyState.page = 1

  if (historyState.todayOnly) {
    const todayDate = new Date()

    $('historyPeriodTitle').textContent =
      `Ventas de hoy · ${
        todayDate.toLocaleDateString('es-PE')
      }`
  } else {
    $('historyPeriodTitle').textContent =
      selectedMonth
        ? `Ventas de ${monthName(selectedMonth)}`
        : 'Ventas de todos los meses disponibles'
  }

  $('filterToday').classList.toggle(
    'active',
    historyState.todayOnly
  )

  renderStatistics()
  renderSales()
  renderPagination()
}

// ==========================================
// REINICIAR ESTADÍSTICAS
// ==========================================

function resetStatistics() {
  // GENERALES
  $('statTotalSales').textContent = '0'
  $('statRevenue').textContent = 'S/ 0.00'
  $('statDiscounts').textContent = 'S/ 0.00'
  $('statAverage').textContent = 'S/ 0.00'

  // DE HOY
  $('statTodaySales').textContent = '0'
  $('statTodayRevenue').textContent = 'S/ 0.00'
  $('statTodayDiscounts').textContent = 'S/ 0.00'
  $('statTodayAverage').textContent = 'S/ 0.00'
}

// ==========================================
// CALCULAR LAS 8 ESTADÍSTICAS
// ==========================================

function renderStatistics() {

  // ========================================
  // PRIMERA FILA: ESTADÍSTICAS GENERALES
  // ========================================

  const completed = historyState.filtered.filter(
    (sale) => sale.status === 'COMPLETADA'
  )

  const totalSales = completed.length

  const revenueCents = completed.reduce(
    (sum, sale) =>
      sum + Math.round(sale.total * 100),
    0
  )

  const discountCents = completed.reduce(
    (sum, sale) =>
      sum + Math.round(sale.discountAmount * 100),
    0
  )

  const averageCents = totalSales > 0
    ? revenueCents / totalSales
    : 0

  $('statTotalSales').textContent =
    totalSales.toLocaleString('es-PE')

  $('statRevenue').textContent =
    money(revenueCents / 100)

  $('statDiscounts').textContent =
    money(discountCents / 100)

  $('statAverage').textContent =
    money(averageCents / 100)

  // ========================================
  // SEGUNDA FILA: ESTADÍSTICAS DE HOY
  // ========================================

  const today = localDateKey(new Date())

  const todaySales = historyState.sales.filter(
    (sale) =>
      sale.status === 'COMPLETADA' &&
      localDateKey(sale.saleDate) === today
  )

  // CANTIDAD DE VENTAS DE HOY
  const todayCount = todaySales.length

  // SUMA DE LOS INGRESOS DE HOY
  const todayRevenueCents = todaySales.reduce(
    (sum, sale) =>
      sum + Math.round(sale.total * 100),
    0
  )

  // SUMA DE LOS DESCUENTOS DE HOY
  const todayDiscountCents = todaySales.reduce(
    (sum, sale) =>
      sum + Math.round(sale.discountAmount * 100),
    0
  )

  // TICKET PROMEDIO DE HOY
  const todayAverageCents = todayCount > 0
    ? todayRevenueCents / todayCount
    : 0

  // MOSTRAR LAS CUATRO ESTADÍSTICAS
  $('statTodaySales').textContent =
    todayCount.toLocaleString('es-PE')

  $('statTodayRevenue').textContent =
    money(todayRevenueCents / 100)

  $('statTodayDiscounts').textContent =
    money(todayDiscountCents / 100)

  $('statTodayAverage').textContent =
    money(todayAverageCents / 100)
}

// ==========================================
// ESTADO DE CADA VENTA
// ==========================================

function statusBadge(status) {
  if (status === 'COMPLETADA') {
    return `
      <span class="history-status history-status-completed">
        Completada
      </span>
    `
  }

  if (status === 'ANULADA') {
    return `
      <span class="history-status history-status-cancelled">
        Anulada
      </span>
    `
  }

  return `
    <span class="history-status history-status-other">
      ${escapeHtml(status || 'Sin estado')}
    </span>
  `
}

// ==========================================
// MOSTRAR TABLA
// ==========================================

function renderSales() {
  const tbody = $('salesTable')

  if (!historyState.filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="history-empty">
          No se encontraron ventas con los filtros seleccionados.
        </td>
      </tr>
    `
    return
  }

  const start =
    (historyState.page - 1) *
    historyState.perPage

  const rows = historyState.filtered.slice(
    start,
    start + historyState.perPage
  )

  tbody.innerHTML = rows.map((sale) => {
    const document = [
      sale.customerDocumentType,
      sale.customerDocumentNumber,
    ].filter(Boolean).join(': ')

    return `
      <tr>
        <td>
          <strong class="history-sale-number">
            ${escapeHtml(sale.saleNumber)}
          </strong>

          <small>
            ID: ${escapeHtml(sale.id)}
          </small>
        </td>

        <td>
          ${escapeHtml(formatDate(sale.saleDate))}
        </td>

        <td>
          <div class="history-client">

            <strong>
              ${escapeHtml(sale.customerName)}
            </strong>

            <small>
              ${escapeHtml(document || 'Sin documento')}
            </small>

          </div>
        </td>

        <td>
          <span class="history-discount">
            ${
              sale.discountAmount > 0
                ? `- ${money(sale.discountAmount)}`
                : '—'
            }
          </span>
        </td>

        <td>
          <span class="history-amount">
            ${money(sale.total)}
          </span>
        </td>

        <td>
          ${statusBadge(sale.status)}
        </td>

        <td>
          <div class="history-actions">
            <button
              type="button"
              class="history-btn history-btn-primary history-btn-small"
              data-action="detail"
              data-id="${sale.id}"
            >
              Ver detalle
            </button>
          </div>
        </td>
      </tr>
    `
  }).join('')
}

// ==========================================
// PAGINACIÓN
// ==========================================

function renderPagination() {
  const total = historyState.filtered.length

  const pages = Math.max(
    1,
    Math.ceil(total / historyState.perPage)
  )

  historyState.page = Math.min(
    historyState.page,
    pages
  )

  const first = total === 0
    ? 0
    : (historyState.page - 1) *
      historyState.perPage + 1

  const last = Math.min(
    historyState.page * historyState.perPage,
    total
  )

  $('salesPageInfo').textContent =
    `Mostrando ${first}-${last} de ${total} ventas · ` +
    `Página ${historyState.page} de ${pages}`

  $('previousPage').disabled =
    historyState.page <= 1

  $('nextPage').disabled =
    historyState.page >= pages
}

// ==========================================
// MODAL DE DETALLE
// ==========================================

function openModal() {
  $('saleDetailModal').classList.remove(
    'history-hidden'
  )

  document.body.style.overflow = 'hidden'
}

function closeModal() {
  historyState.detailRequestId++
  historyState.selectedSale = null

  $('saleDetailModal').classList.add(
    'history-hidden'
  )

  $('printSale').disabled = true
  document.body.style.overflow = ''
}

// ==========================================
// CARGAR DETALLE DE LA VENTA
// ==========================================

async function openSaleDetail(saleId) {
  if (
    !Number.isSafeInteger(saleId) ||
    saleId <= 0
  ) {
    return
  }

  const requestId =
    ++historyState.detailRequestId

  historyState.selectedSale = null
  $('printSale').disabled = true

  $('saleDetailContent').innerHTML = `
    <p class="history-empty">
      Cargando detalle de venta...
    </p>
  `

  openModal()

  try {
    const sale = await salesRequest(
      `/${encodeURIComponent(saleId)}`
    )

    if (
      requestId !==
      historyState.detailRequestId
    ) {
      return
    }

    if (!sale || !sale.id) {
      throw new Error(
        'No se recibió el detalle de la venta.'
      )
    }

    historyState.selectedSale = sale

    renderSaleDetail(sale)

    $('printSale').disabled = false
  } catch (error) {
    if (
      requestId !==
      historyState.detailRequestId
    ) {
      return
    }

    $('saleDetailContent').innerHTML = `
      <p class="history-empty">
        ${escapeHtml(error.message)}
      </p>
    `

    toast(error.message)
  }
}

// ==========================================
// INFORMACIÓN DE PAGOS
// ==========================================

function renderPayments(payments) {
  if (
    !Array.isArray(payments) ||
    !payments.length
  ) {
    return `
      <p class="history-empty">
        No hay información de pago disponible.
      </p>
    `
  }

  return payments.map((payment) => {
    const method = String(
      payment.method ??
      payment.payment_method ??
      '—'
    )

    const amount =
      payment.amount ?? 0

    const received =
      payment.amountReceived ??
      payment.amount_received ??
      null

    const change =
      payment.changeAmount ??
      payment.change_amount ??
      null

    const cashDetails =
      method === 'EFECTIVO'
        ? `
          <div class="history-receipt-line">
            <span>Monto recibido</span>
            <strong>
              ${money(received ?? 0)}
            </strong>
          </div>

          <div class="history-receipt-line">
            <span>Vuelto</span>
            <strong>
              ${money(change ?? 0)}
            </strong>
          </div>
        `
        : ''

    return `
      <div class="history-receipt-line">
        <span>Método: ${escapeHtml(method)}</span>
        <strong>${money(amount)}</strong>
      </div>

      ${cashDetails}
    `
  }).join('')
}

// ==========================================
// COMPROBANTE DE VENTA
// ==========================================

function renderSaleDetail(sale) {
  const customerName =
    sale.customerName ??
    sale.customer_name ??
    'Cliente no especificado'

  const documentType =
    sale.customerDocumentType ??
    sale.document_type ??
    'Documento'

  const documentNumber =
    sale.customerDocumentNumber ??
    sale.document_number ??
    '—'

  const saleNumber =
    sale.saleNumber ??
    sale.sale_number ??
    sale.id

  const saleDate =
    sale.saleDate ??
    sale.sale_date ??
    null

  const status = String(
    sale.status ?? ''
  ).toUpperCase()

  const subtotal = Number(
    sale.subtotal ?? 0
  )

  const discount = Number(
    sale.discountAmount ??
    sale.discount_amount ??
    0
  )

  const tax = Number(
    sale.taxAmount ??
    sale.tax_amount ??
    0
  )

  const total = Number(
    sale.total ?? 0
  )

  const items = Array.isArray(sale.items)
    ? sale.items
    : []

  const payments = Array.isArray(sale.payments)
    ? sale.payments
    : []

  const rows = items.length
    ? items.map((item) => {
        const name =
          item.name ??
          item.product_name ??
          'Producto'

        const code =
          item.code ??
          item.product_code ??
          ''

        const quantity = Number(
          item.quantity ?? 0
        )

        const unitPrice = Number(
          item.unitPrice ??
          item.unit_price ??
          0
        )

        const lineTotal = Number(
          item.subtotal ??
          quantity * unitPrice
        )

        return `
          <tr>
            <td>
              <strong>
                ${escapeHtml(name)}
              </strong>

              <small>
                ${escapeHtml(code)}
              </small>
            </td>

            <td>${quantity}</td>

            <td>${money(unitPrice)}</td>

            <td>
              <strong>
                ${money(lineTotal)}
              </strong>
            </td>
          </tr>
        `
      }).join('')
    : `
      <tr>
        <td colspan="4" class="history-empty">
          Esta venta no tiene detalles disponibles.
        </td>
      </tr>
    `

  $('saleDetailContent').innerHTML = `
    <div class="history-receipt">

      <!-- ENCABEZADO -->
      <div class="history-receipt-heading">
        <h3>EZCUDO360</h3>

        <p>Comprobante interno de venta</p>

        <p>
          Venta: ${escapeHtml(saleNumber)}
        </p>

        <p>
          Fecha: ${escapeHtml(formatDate(saleDate))}
        </p>
      </div>

      <!-- DATOS DE LA VENTA -->
      <section class="history-receipt-section">
        <h4>Información de la venta</h4>

        <div class="history-receipt-info">

          <div>
            <small>Número de venta</small>
            <strong>
              ${escapeHtml(saleNumber)}
            </strong>
          </div>

          <div>
            <small>Estado</small>
            ${statusBadge(status)}
          </div>

          <div>
            <small>Fecha</small>
            <strong>
              ${escapeHtml(formatDate(saleDate))}
            </strong>
          </div>

          <div>
            <small>ID de venta</small>
            <strong>
              ${escapeHtml(sale.id)}
            </strong>
          </div>

        </div>
      </section>

      <!-- DATOS DEL CLIENTE -->
      <section class="history-receipt-section">
        <h4>Datos del cliente</h4>

        <div class="history-receipt-info">

          <div>
            <small>Nombre / Razón social</small>
            <strong>
              ${escapeHtml(customerName)}
            </strong>
          </div>

          <div>
            <small>
              ${escapeHtml(documentType)}
            </small>

            <strong>
              ${escapeHtml(documentNumber)}
            </strong>
          </div>

        </div>
      </section>

      <!-- PRODUCTOS VENDIDOS -->
      <section class="history-receipt-section">
        <h4>Productos vendidos</h4>

        <div class="history-table-scroll">
          <table class="history-receipt-table">

            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Importe</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>

          </table>
        </div>
      </section>

      <!-- TOTALES -->
      <div class="history-receipt-totals">

        <div class="history-receipt-line">
          <span>Productos</span>
          <strong>
            ${money(subtotal)}
          </strong>
        </div>

        <div class="history-receipt-line">
          <span>Descuento</span>
          <strong>
            - ${money(discount)}
          </strong>
        </div>

        <div class="history-receipt-line">
          <span>IGV incluido (18 %)</span>
          <strong>
            ${money(tax)}
          </strong>
        </div>

        <div class="history-receipt-line history-receipt-total">
          <span>TOTAL</span>
          <strong>
            ${money(total)}
          </strong>
        </div>

      </div>

      <!-- INFORMACIÓN DEL PAGO -->
      <section class="history-receipt-section">
        <h4>Información del pago</h4>

        ${renderPayments(payments)}
      </section>

      <p class="history-receipt-note">
        Comprobante interno de EZCUDO360.
        No reemplaza una boleta o factura
        electrónica emitida mediante SUNAT.
      </p>

    </div>
  `
}

// ==========================================
// EXPORTAR CSV
// ==========================================

function csvCell(value, preserveText = false) {
  let text = String(value ?? '')

  // Proteger frente a fórmulas de Excel.
  // Preservar DNI/RUC como texto.
  if (
    preserveText ||
    /^\s*[=+\-@]/.test(text)
  ) {
    text = "'" + text
  }

  return `"${text.replace(/"/g, '""')}"`
}

function exportSales() {
  const rows = historyState.filtered

  if (!rows.length) {
    toast('No hay ventas para exportar.')
    return
  }

  const headers = [
    'Número de venta',
    'Fecha',
    'Cliente',
    'Tipo de documento',
    'Documento',
    'Subtotal',
    'Descuento',
    'IGV',
    'Total',
    'Estado',
  ]

  const lines = [
    headers.map((value) => csvCell(value)).join(';'),
  ]

  for (const sale of rows) {
    const fields = [
      csvCell(sale.saleNumber, true),
      csvCell(formatDate(sale.saleDate)),
      csvCell(sale.customerName),
      csvCell(sale.customerDocumentType),
      csvCell(sale.customerDocumentNumber, true),
      csvCell(sale.subtotal.toFixed(2)),
      csvCell(sale.discountAmount.toFixed(2)),
      csvCell(sale.taxAmount.toFixed(2)),
      csvCell(sale.total.toFixed(2)),
      csvCell(sale.status),
    ]

    lines.push(fields.join(';'))
  }

  const content =
    '\uFEFF' + lines.join('\r\n')

  const blob = new Blob(
    [content],
    {
      type: 'text/csv;charset=utf-8;',
    }
  )

  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  let period = 'todos'

  if (historyState.todayOnly) {
    period = `hoy-${localDateKey(new Date())}`
  } else if (historyState.selectedMonth) {
    period = historyState.selectedMonth
  }

  link.href = url

  link.download =
    `ezcudo360-ventas-${period}.csv`

  document.body.appendChild(link)

  link.click()
  link.remove()

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)

  toast('Archivo CSV generado correctamente.')
}

// ==========================================
// EVENTOS
// ==========================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    // MES ACTUAL AL INGRESAR
    const currentMonth =
      monthKey(new Date())

    $('monthFilter').value = currentMonth

    historyState.selectedMonth = currentMonth

    // ACTUALIZAR HISTORIAL
    $('refreshSales').addEventListener(
      'click',
      loadSales
    )

    // BUSCAR
    $('searchSales').addEventListener(
      'input',
      applyFilters
    )

    // FILTRAR POR MES
    $('monthFilter').addEventListener(
      'change',
      () => {
        historyState.todayOnly = false

        historyState.selectedMonth =
          $('monthFilter').value

        applyFilters()
      }
    )

    // FILTRAR VENTAS DE HOY
    $('filterToday').addEventListener(
      'click',
      () => {
        historyState.todayOnly = true
        historyState.selectedMonth = ''

        $('monthFilter').value = ''

        applyFilters()
      }
    )

    // TODOS LOS MESES
    $('showAllMonths').addEventListener(
      'click',
      () => {
        historyState.todayOnly = false
        historyState.selectedMonth = ''

        $('monthFilter').value = ''

        applyFilters()
      }
    )

    // FILTRAR POR ESTADO
    $('statusFilter').addEventListener(
      'change',
      applyFilters
    )

    // PÁGINA ANTERIOR
    $('previousPage').addEventListener(
      'click',
      () => {
        if (historyState.page <= 1) return

        historyState.page--

        renderSales()
        renderPagination()
      }
    )

    // PÁGINA SIGUIENTE
    $('nextPage').addEventListener(
      'click',
      () => {
        const pages = Math.ceil(
          historyState.filtered.length /
          historyState.perPage
        )

        if (historyState.page >= pages) {
          return
        }

        historyState.page++

        renderSales()
        renderPagination()
      }
    )

    // VER DETALLE DE VENTA
    $('salesTable').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-action="detail"]'
        )

        if (!button) return

        const saleId = Number(
          button.dataset.id
        )

        openSaleDetail(saleId)
      }
    )

    // CERRAR DETALLE
    $('closeSaleDetail').addEventListener(
      'click',
      closeModal
    )

    $('closeDetailBottom').addEventListener(
      'click',
      closeModal
    )

    // CERRAR CON ESCAPE
    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key === 'Escape' &&
          !$('saleDetailModal').classList.contains(
            'history-hidden'
          )
        ) {
          closeModal()
        }
      }
    )

    // IMPRIMIR COMPROBANTE
    $('printSale').addEventListener(
      'click',
      () => {
        if (historyState.selectedSale) {
          window.print()
        }
      }
    )

    // EXPORTAR CSV
    $('exportSales').addEventListener(
      'click',
      exportSales
    )

    // INICIAR MÓDULO
    loadSales()
  }
)
