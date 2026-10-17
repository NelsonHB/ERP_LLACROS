
(() => {
  'use strict'

  const API = '/api/v1/purchases'
  const $ = (id) => document.getElementById(id)

  const state = {
    purchases: [],
    suppliers: [],
    catalog: [],
    items: new Map(),
    supplierId: '',
    loading: false,
    catalogRequest: 0
  }

  let toastTimer

  function safe(value) {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }

    return String(value ?? '').replace(
      /[&<>"']/g,
      (char) => chars[char]
    )
  }

  function money(value) {
    const number = Number(value)
    return `S/ ${
      Number.isFinite(number)
        ? number.toFixed(2)
        : '0.00'
    }`
  }

  function dateText(value) {
    if (!value) return '—'

    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
  }

  function status(value) {
    return `<span class="buy-status buy-status-${safe(value)}">
      ${safe(value)}
    </span>`
  }

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function monthOf(value) {
    const d = new Date(value)

    if (Number.isNaN(d.getTime())) return ''

    return `${d.getFullYear()}-${
      String(d.getMonth() + 1).padStart(2, '0')
    }`
  }

  function imageSrc(value) {
    return typeof value === 'string' &&
      (/^https?:\/\//i.test(value) ||
       /^\/(?!\/)/.test(value))
      ? safe(value)
      : ''
  }

  function notify(message) {
    $('purchaseToast').textContent = message
    $('purchaseToast').classList.remove('buy-hidden')

    clearTimeout(toastTimer)

    toastTimer = setTimeout(() => {
      $('purchaseToast').classList.add('buy-hidden')
    }, 4200)
  }

  function errorBox(message) {
    $('purchaseFormError').textContent = message
    $('purchaseFormError').classList.toggle(
      'buy-hidden',
      !message
    )
  }

  function token() {
    try {
      return localStorage.getItem('erp_token')
    } catch {
      return null
    }
  }

  async function api(url, options = {}) {
    const accessToken = token()

    if (!accessToken) {
      throw new Error(
        'No hay sesión activa. Vuelve a iniciar sesión.'
      )
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {})
      }
    })

    const result = await response
      .json()
      .catch(() => ({}))

    if (!response.ok || result.success === false) {
      if (response.status === 401) {
        throw new Error(
          'Tu sesión venció. Inicia sesión nuevamente.'
        )
      }

      throw new Error(
        result.message || `Error HTTP ${response.status}`
      )
    }

    return result
  }

  function setBusy(value) {
    state.loading = value

    for (const id of [
      'saveDraft',
      'saveReceived',
      'cancelPurchaseForm',
      'purchaseSupplier'
    ]) {
      $(id).disabled = value
    }
  }

  function setOpen(id, open) {
    $(id).classList.toggle('buy-hidden', !open)

    const bothClosed =
      $('purchaseModal').classList.contains('buy-hidden') &&
      $('detailModal').classList.contains('buy-hidden')

    document.body.style.overflow = bothClosed
      ? ''
      : 'hidden'
  }

  // RESUMEN DE COMPRAS

  function renderStats() {
    const received = state.purchases.filter(
      (p) => p.status === 'RECIBIDA'
    )

    $('totalPurchases').textContent =
      state.purchases.length

    $('receivedPurchases').textContent =
      received.length

    $('draftPurchases').textContent =
      state.purchases.filter(
        (p) => p.status === 'BORRADOR'
      ).length

    $('receivedAmount').textContent = money(
      received.reduce(
        (acc, p) => acc + Number(p.total),
        0
      )
    )
  }

  // HISTORIAL

  function renderHistory() {
    const search = normalize(
      $('searchPurchases').value
    )

    const stat =
      $('filterPurchaseStatus').value

    const month =
      $('filterPurchaseMonth').value

    const filtered = state.purchases.filter((p) => {
      if (stat !== 'all' && p.status !== stat) {
        return false
      }

      if (month && monthOf(p.purchaseDate) !== month) {
        return false
      }

      const content = normalize(
        `${p.purchaseNumber} ${p.supplierName} ` +
        `${p.documentNumber} ${p.documentType}`
      )

      return content.includes(search)
    })

    $('purchaseCount').textContent =
      `Mostrando ${filtered.length} de ` +
      `${state.purchases.length} compras (últimas 500)`

    if (!filtered.length) {
      $('purchasesTable').innerHTML = `
        <tr>
          <td colspan="7" class="buy-empty">
            No se encontraron compras con estos filtros.
          </td>
        </tr>
      `
      return
    }

    $('purchasesTable').innerHTML =
      filtered.map((p) => `
        <tr>
          <td>
            <strong>${safe(p.purchaseNumber)}</strong>
            <small>ID: ${safe(p.id)}</small>
          </td>

          <td>${dateText(p.purchaseDate)}</td>

          <td>
            <strong>${safe(p.supplierName)}</strong>
          </td>

          <td>
            ${
              p.documentNumber
                ? `${safe(p.documentType || 'Documento')}
                   <small>${safe(p.documentNumber)}</small>`
                : '—'
            }
          </td>

          <td>
            <strong>${money(p.total)}</strong>
          </td>

          <td>${status(p.status)}</td>

          <td>
            <div class="buy-cell-actions">
              <button
                class="buy-btn buy-btn-small buy-btn-outline"
                type="button"
                data-action="detail"
                data-id="${safe(p.id)}"
              >
                Ver detalle
              </button>

              ${
                p.status === 'BORRADOR'
                  ? `
                    <button
                      class="buy-btn buy-btn-small buy-btn-primary"
                      type="button"
                      data-action="receive"
                      data-id="${safe(p.id)}"
                    >
                      Recibir
                    </button>

                    <button
                      class="buy-btn buy-btn-small buy-btn-danger"
                      type="button"
                      data-action="cancel"
                      data-id="${safe(p.id)}"
                    >
                      Anular
                    </button>
                  `
                  : ''
              }
            </div>
          </td>
        </tr>
      `).join('')
  }

  async function loadHistory() {
    $('refreshPurchases').disabled = true

    try {
      const result = await api(API)

      if (!Array.isArray(result.data)) {
        throw new Error(
          'Respuesta de compras inválida.'
        )
      }

      state.purchases = result.data

      renderStats()
      renderHistory()
    } catch (error) {
      console.error('[Compras] historial:', error)

      $('purchasesTable').innerHTML = `
        <tr>
          <td class="buy-empty" colspan="7">
            ${safe(error.message)}
          </td>
        </tr>
      `

      notify(error.message)
    } finally {
      $('refreshPurchases').disabled = false
    }
  }

  // PROVEEDORES

  async function loadSuppliers() {
    const result = await api(`${API}/suppliers`)

    if (!Array.isArray(result.data)) {
      throw new Error(
        'Respuesta de proveedores inválida.'
      )
    }

    state.suppliers = result.data

    $('purchaseSupplier').innerHTML =
      '<option value="">Selecciona un proveedor...</option>' +
      result.data.map((s) => `
        <option value="${safe(s.id)}">
          ${safe(s.name)}
          ${
            s.documentNumber
              ? ` · ${safe(s.documentNumber)}`
              : ''
          }
        </option>
      `).join('')
  }

  // CATALOGO DEL PROVEEDOR

  async function loadCatalog(supplierId) {
    const requestId = ++state.catalogRequest

    state.catalog = []

    $('purchaseCatalog').innerHTML = `
      <div class="buy-empty">
        Cargando productos...
      </div>
    `

    if (!supplierId) {
      $('purchaseCatalog').innerHTML = `
        <div class="buy-empty">
          Selecciona un proveedor para ver su catálogo.
        </div>
      `
      return
    }

    try {
      const result = await api(
        `${API}/catalog?supplierId=${
          encodeURIComponent(supplierId)
        }`
      )

      if (requestId !== state.catalogRequest) return

      if (!Array.isArray(result.data)) {
        throw new Error(
          'Respuesta de catálogo inválida.'
        )
      }

      state.catalog = result.data
      renderCatalog()
    } catch (error) {
      if (requestId !== state.catalogRequest) return

      $('purchaseCatalog').innerHTML = `
        <div class="buy-empty">
          ${safe(error.message)}
        </div>
      `

      notify(error.message)
    }
  }

  function renderCatalog() {
    const search = normalize(
      $('catalogSearch').value
    )

    const list = state.catalog.filter((p) =>
      normalize(
        `${p.name} ${p.code} ${p.brand} ${p.category}`
      ).includes(search)
    )

    if (!list.length) {
      $('purchaseCatalog').innerHTML = `
        <div class="buy-empty">
          Este proveedor no tiene productos activos asociados
          o no hay coincidencias.
        </div>
      `
      return
    }

    $('purchaseCatalog').innerHTML =
      list.map((p) => {
        const added = state.items.has(
          String(p.supplierProductId)
        )

        const src = imageSrc(p.imageUrl)

        return `
          <article class="buy-product">
            ${
              src
                ? `<img
                    src="${src}"
                    alt="${safe(p.name)}"
                    loading="lazy"
                   >`
                : '<div class="buy-no-image">▣</div>'
            }

            <div class="buy-product-details">
              <strong>${safe(p.name)}</strong>

              <small>
                ${safe(p.code)} ·
                ${safe(
                  p.category ||
                  p.brand ||
                  'Sin categoría'
                )}
              </small>

              <small>
                Stock: ${safe(p.stock)}
                · Ref.:
                ${
                  p.referenceCost == null
                    ? 'Sin costo'
                    : money(p.referenceCost)
                }
              </small>
            </div>

            <button
              class="buy-btn buy-btn-small ${
                added
                  ? 'buy-btn-outline'
                  : 'buy-btn-primary'
              }"
              data-add="${safe(p.supplierProductId)}"
              type="button"
              ${added ? 'disabled' : ''}
            >
              ${added ? 'Añadido' : '+ Añadir'}
            </button>
          </article>
        `
      }).join('')
  }

  // PRODUCTOS SELECCIONADOS

  function renderLines() {
    $('itemsCount').textContent =
      `${state.items.size} producto${
        state.items.size === 1 ? '' : 's'
      }`

    if (!state.items.size) {
      $('purchaseLines').innerHTML = `
        <tr>
          <td colspan="5" class="buy-empty">
            Aún no hay productos seleccionados.
          </td>
        </tr>
      `

      updateTotals()
      return
    }

    $('purchaseLines').innerHTML =
      [...state.items.entries()].map(([key, item]) => `
        <tr data-line="${safe(key)}">
          <td>
            <strong>${safe(item.product.name)}</strong>
            <small>
              ${safe(item.product.code)}
              ·
              ${safe(item.product.unit || 'UNIDAD')}
            </small>
          </td>

          <td>
            <input
              class="buy-line-input"
              data-field="quantity"
              data-id="${safe(key)}"
              type="number"
              min="1"
              max="1000000"
              step="1"
              value="${safe(item.quantity)}"
            >
          </td>

          <td>
            <input
              class="buy-line-input"
              data-field="unitCost"
              data-id="${safe(key)}"
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              value="${safe(item.unitCost)}"
            >
          </td>

          <td>
            <strong data-subtotal="${safe(key)}">
              ${
                money(
                  Number(item.quantity) *
                  Number(item.unitCost)
                )
              }
            </strong>
          </td>

          <td>
            <button
              class="buy-btn buy-btn-small buy-btn-danger"
              type="button"
              data-remove="${safe(key)}"
            >
              ×
            </button>
          </td>
        </tr>
      `).join('')

    updateTotals()
  }

  // CALCULO DE PRECIOS

  function parseCost(value) {
    const input = String(value).trim()

    if (
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(input)
    ) {
      return null
    }

    const [whole, decimals = ''] = input.split('.')

    const cents =
      Number(whole) * 100 +
      Number(decimals.padEnd(2, '0'))

    return Number.isSafeInteger(cents) &&
      cents <= 999999999999
      ? cents
      : null
  }

  function calculate() {
    let total = 0

    for (const item of state.items.values()) {
      const qty = Number(item.quantity)
      const cost = parseCost(item.unitCost)

      if (
        !Number.isSafeInteger(qty) ||
        qty < 1 ||
        qty > 1000000 ||
        cost === null
      ) {
        return null
      }

      const line = qty * cost

      if (
        !Number.isSafeInteger(line) ||
        total + line > 999999999999
      ) {
        return null
      }

      total += line
    }

    return total
  }

  function updateTotals() {
    const cents = calculate()

    $('purchaseSubtotal').textContent =
      cents === null
        ? 'Revisa importes'
        : money(cents / 100)

    $('purchaseTotal').textContent =
      cents === null
        ? 'Revisa importes'
        : money(cents / 100)
  }

  // ABRIR NUEVA COMPRA

  async function openNewPurchase() {
    state.catalogRequest++
    state.catalog = []
    state.items.clear()
    state.supplierId = ''

    $('purchaseForm').reset()
    $('catalogSearch').value = ''

    $('purchaseCatalog').innerHTML = `
      <div class="buy-empty">
        Selecciona un proveedor para ver su catálogo.
      </div>
    `

    $('purchaseSupplier').innerHTML =
      '<option value="">Cargando proveedores...</option>'

    renderLines()
    errorBox('')
    setOpen('purchaseModal', true)

    try {
      await loadSuppliers()

      if (!state.suppliers.length) {
        errorBox(
          'No hay proveedores activos. Registra o activa uno primero.'
        )
      }
    } catch (error) {
      errorBox(error.message)
    }
  }

  // CREAR COMPRA

  function collectPurchase(receiveNow) {
    if (!state.supplierId) {
      throw new Error(
        'Selecciona un proveedor.'
      )
    }

    if (!state.items.size) {
      throw new Error(
        'Añade al menos un producto de este proveedor.'
      )
    }

    if (calculate() === null) {
      throw new Error(
        'Corrige cantidades y costos. Solo se permiten hasta 2 decimales.'
      )
    }

    return {
      supplierId: Number(state.supplierId),
      documentType:
        $('purchaseDocType').value || null,
      documentNumber:
        $('purchaseDocNumber').value.trim() || null,
      notes:
        $('purchaseNotes').value.trim() || null,
      receiveNow,
      items: [...state.items.values()].map((item) => ({
        supplierProductId:
          Number(item.product.supplierProductId),
        quantity: Number(item.quantity),
        unitCost: String(item.unitCost)
      }))
    }
  }

  async function savePurchase(receiveNow) {
    if (state.loading) return

    errorBox('')

    let payload

    try {
      payload = collectPurchase(receiveNow)
    } catch (error) {
      errorBox(error.message)
      return
    }

    const confirmation = receiveNow
      ? '¿Confirmas que esta mercadería llegó? Al recibir, las cantidades se sumarán al inventario.'
      : '¿Guardar la compra como borrador? No se actualizará el inventario.'

    if (!window.confirm(confirmation)) return

    setBusy(true)

    try {
      const response = await api(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      setOpen('purchaseModal', false)

      notify(
        response.message ||
        'Compra registrada correctamente.'
      )

      await loadHistory()
    } catch (error) {
      errorBox(error.message)
    } finally {
      setBusy(false)
    }
  }

  // DETALLES

  async function openDetail(id) {
    $('detailTitle').textContent =
      'Detalle de compra'

    $('detailSubtitle').textContent =
      'Consultando datos...'

    $('detailBody').innerHTML = `
      <div class="buy-empty">
        Cargando detalle...
      </div>
    `

    setOpen('detailModal', true)

    try {
      const { data } = await api(
        `${API}/${encodeURIComponent(id)}`
      )

      $('detailTitle').textContent =
        `Compra ${data.purchaseNumber}`

      $('detailSubtitle').textContent =
        `${dateText(data.purchaseDate)} · ${data.supplierName}`

      $('detailBody').innerHTML = `
        <div class="buy-detail-grid">
          <div>
            <small>Proveedor</small>
            <strong>${safe(data.supplierName)}</strong>
          </div>

          <div>
            <small>Estado</small>
            ${status(data.status)}
          </div>

          <div>
            <small>Documento</small>
            <strong>
              ${
                safe(
                  [
                    data.documentType,
                    data.documentNumber
                  ].filter(Boolean).join(' · ') ||
                  'No indicado'
                )
              }
            </strong>
          </div>

          <div>
            <small>Fecha de recepción</small>
            <strong>
              ${dateText(data.receivedAt)}
            </strong>
          </div>
        </div>

        <h3 class="buy-detail-heading">
          Productos comprados
        </h3>

        <div class="buy-table-wrap">
          <table class="buy-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>

            <tbody>
              ${
                data.items.map((i) => `
                  <tr>
                    <td>
                      <strong>${safe(i.name)}</strong>
                      <small>${safe(i.code)}</small>
                    </td>
                    <td>
                      ${safe(i.quantity)}
                      ${safe(i.unit || '')}
                    </td>
                    <td>${money(i.unitCost)}</td>
                    <td>
                      <strong>${money(i.subtotal)}</strong>
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>

        <div class="buy-bottom-grid">
          <div class="buy-field">
            <label>Observaciones</label>
            <p>
              ${safe(data.notes || 'Sin observaciones')}
            </p>
          </div>

          <div class="buy-totals">
            <div class="buy-grand-total">
              <span>Total</span>
              <strong>
                ${money(data.total)}
              </strong>
            </div>

            <small>
              No altera los precios de venta.
            </small>
          </div>
        </div>
      `
    } catch (error) {
      $('detailBody').innerHTML = `
        <div class="buy-banner">
          ${safe(error.message)}
        </div>
      `
    }
  }

  // RECIBIR O ANULAR BORRADOR

  async function changeStatus(id, action) {
    const received = action === 'receive'

    if (!window.confirm(
      received
        ? '¿Confirmas la recepción? Se sumará el stock de todos los productos de la compra.'
        : '¿Anular este borrador? No afectará el inventario.'
    )) {
      return
    }

    try {
      const result = await api(
        `${API}/${encodeURIComponent(id)}/${
          received ? 'receive' : 'cancel'
        }`,
        { method: 'POST' }
      )

      notify(result.message)
      await loadHistory()
    } catch (error) {
      notify(error.message)
    }
  }

  // EVENTOS

  function bindEvents() {
    $('newPurchase').addEventListener(
      'click',
      openNewPurchase
    )

    $('refreshPurchases').addEventListener(
      'click',
      loadHistory
    )

    for (const id of [
      'searchPurchases',
      'filterPurchaseStatus',
      'filterPurchaseMonth'
    ]) {
      $(id).addEventListener(
        'input',
        renderHistory
      )

      $(id).addEventListener(
        'change',
        renderHistory
      )
    }

    $('purchaseSupplier').addEventListener(
      'change',
      (event) => {
        const next = event.target.value

        if (
          state.items.size &&
          !window.confirm(
            'Cambiar proveedor eliminará los productos seleccionados. ¿Continuar?'
          )
        ) {
          event.target.value = state.supplierId
          return
        }

        state.supplierId = next
        state.items.clear()

        renderLines()
        errorBox('')
        loadCatalog(next)
      }
    )

    $('catalogSearch').addEventListener(
      'input',
      renderCatalog
    )

    $('purchaseCatalog').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-add]'
        )

        if (!button) return

        const key = button.dataset.add

        const product = state.catalog.find(
          (p) =>
            String(p.supplierProductId) === key
        )

        if (!product || state.items.has(key)) {
          return
        }

        state.items.set(key, {
          product,
          quantity: '1',
          unitCost:
            product.referenceCost == null
              ? '0.00'
              : String(product.referenceCost)
        })

        renderLines()
        renderCatalog()
      }
    )

    $('purchaseLines').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-remove]'
        )

        if (!button) return

        state.items.delete(
          button.dataset.remove
        )

        renderLines()
        renderCatalog()
      }
    )

    $('purchaseLines').addEventListener(
      'input',
      (event) => {
        const field = event.target.dataset.field

        if (
          !['quantity', 'unitCost'].includes(field)
        ) {
          return
        }

        const key = event.target.dataset.id
        const item = state.items.get(key)

        if (!item) return

        item[field] = event.target.value

        const cell = $('purchaseLines').querySelector(
          `[data-subtotal="${key}"]`
        )

        if (cell) {
          const cost = parseCost(item.unitCost)
          const qty = Number(item.quantity)

          cell.textContent =
            cost === null ||
            !Number.isSafeInteger(qty) ||
            qty < 1 ||
            qty > 1000000
              ? 'Revisa importe'
              : money((cost * qty) / 100)
        }

        updateTotals()
      }
    )

    $('purchaseForm').addEventListener(
      'submit',
      (event) => {
        event.preventDefault()
        savePurchase(true)
      }
    )

    $('saveDraft').addEventListener(
      'click',
      () => savePurchase(false)
    )

    for (const id of [
      'closePurchase',
      'cancelPurchaseForm'
    ]) {
      $(id).addEventListener(
        'click',
        () => {
          if (!state.loading) {
            setOpen('purchaseModal', false)
          }
        }
      )
    }

    for (const id of [
      'closeDetail',
      'closeDetailBottom'
    ]) {
      $(id).addEventListener(
        'click',
        () => setOpen('detailModal', false)
      )
    }

    $('purchasesTable').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-action]'
        )

        if (!button) return

        const { action, id } = button.dataset

        if (action === 'detail') {
          openDetail(id)
        }

        if (
          action === 'receive' ||
          action === 'cancel'
        ) {
          changeStatus(id, action)
        }
      }
    )

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return

        if (!state.loading) {
          setOpen('purchaseModal', false)
        }

        setOpen('detailModal', false)
      }
    )
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      bindEvents()
      loadHistory()
    }
  )
})()
