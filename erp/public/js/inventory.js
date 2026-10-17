
(() => {
  'use strict'

  const API = '/api/v1/inventory'
  const $ = (id) => document.getElementById(id)

  const state = {
    products: [],
    page: 1,
    totalPages: 1,
    total: 0,
    currentProduct: null,
    loading: false,
    requestNumber: 0
  }

  let searchTimer
  let toastTimer

  // =========================================
  // FUNCIONES GENERALES
  // =========================================

  function escapeHtml(value) {
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

  function numberText(value) {
    return Number(value || 0).toLocaleString('es-PE')
  }

  function dateText(value) {
    if (!value) return '—'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function imageSource(value) {
    if (
      typeof value !== 'string' ||
      !(
        /^https?:\/\//i.test(value) ||
        /^\/(?!\/)/.test(value)
      )
    ) {
      return ''
    }

    return escapeHtml(value)
  }

  function productImage(product) {
    const src = imageSource(product.imageUrl)

    if (!src) {
      return '<div class="inv-no-photo">▣</div>'
    }

    return `
      <img
        src="${src}"
        alt="${escapeHtml(product.name)}"
        loading="lazy"
      >
    `
  }

  function notify(message) {
    const toast = $('inventoryToast')

    toast.textContent = message
    toast.classList.remove('inv-hidden')

    clearTimeout(toastTimer)

    toastTimer = setTimeout(() => {
      toast.classList.add('inv-hidden')
    }, 4000)
  }

  function showPriceError(message) {
    const element = $('priceError')

    element.textContent = message
    element.classList.toggle('inv-hidden', !message)
  }

  function getToken() {
    try {
      return localStorage.getItem('erp_token')
    } catch {
      return null
    }
  }

  // =========================================
  // CONEXIÓN CON LA API
  // =========================================

  async function api(url, options = {}) {
    const token = getToken()

    if (!token) {
      throw new Error(
        'No se encontró una sesión activa. Inicia sesión.'
      )
    }

    const response = await fetch(url, {
      ...options,

      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    })

    const result = await response
      .json()
      .catch(() => ({}))

    if (!response.ok || result.success === false) {
      if (response.status === 401) {
        throw new Error(
          'Tu sesión ha vencido. Inicia sesión nuevamente.'
        )
      }

      throw new Error(
        result.message ||
        `Error del servidor: ${response.status}`
      )
    }

    return result
  }

  // =========================================
  // ESTADO DEL STOCK
  // =========================================

  function stockStatus(stock) {
    const quantity = Number(stock)

    if (quantity <= 0) {
      return `
        <span class="inv-stock inv-stock-out">
          Agotado
        </span>
      `
    }

    if (quantity <= 5) {
      return `
        <span class="inv-stock inv-stock-low">
          Stock bajo
        </span>
      `
    }

    return `
      <span class="inv-stock inv-stock-ok">
        Disponible
      </span>
    `
  }

  // =========================================
  // ESTADÍSTICAS
  // =========================================

  async function loadStats() {
    try {
      const result = await api(`${API}/stats`)
      const data = result.data

      $('statProducts').textContent =
        numberText(data.totalProducts)

      $('statUnits').textContent =
        numberText(data.totalUnits)

      $('statLow').textContent =
        numberText(data.lowStock)

      $('statOut').textContent =
        numberText(data.outOfStock)

      $('statValue').textContent =
        money(data.retailValue)
    } catch (error) {
      console.error('[Inventario] Estadísticas:', error)
      notify(error.message)
    }
  }

  // =========================================
  // CATEGORÍAS
  // =========================================

  async function loadCategories() {
    try {
      const result = await api(`${API}/categories`)

      if (!Array.isArray(result.data)) {
        throw new Error(
          'No se recibió una lista válida de categorías.'
        )
      }

      const current = $('inventoryCategory').value

      $('inventoryCategory').innerHTML = `
        <option value="">Todas las categorías</option>

        ${result.data.map((category) => `
          <option value="${escapeHtml(category.id)}">
            ${escapeHtml(category.name)}
          </option>
        `).join('')}
      `

      $('inventoryCategory').value = current
    } catch (error) {
      console.error('[Inventario] Categorías:', error)
      notify(error.message)
    }
  }

  // =========================================
  // TABLA DE PRODUCTOS
  // =========================================

  function renderProducts() {
    const tbody = $('inventoryTable')

    if (!state.products.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="inv-empty">
            No se encontraron productos
            con los filtros seleccionados.
          </td>
        </tr>
      `
      return
    }

    tbody.innerHTML = state.products.map((product) => {
      const stock = Number(product.stock) || 0

      const hasPrice =
        product.salePrice !== null &&
        Number(product.salePrice) > 0

      const price = hasPrice
        ? Number(product.salePrice)
        : 0

      const stockValue = stock * price

      return `
        <tr>
          <td>
            <div class="inv-product-cell">

              ${productImage(product)}

              <div>
                <strong>
                  ${escapeHtml(product.name)}
                </strong>

                <small>
                  Código:
                  ${escapeHtml(product.code || '—')}
                </small>

                <small>
                  ${escapeHtml(product.brand || 'Sin marca')}
                </small>
              </div>

            </div>
          </td>

          <td>
            ${escapeHtml(
              product.categoryName || 'Sin categoría'
            )}
          </td>

          <td>
            <strong>
              ${numberText(stock)}
              ${escapeHtml(product.unit || 'UND')}
            </strong>

            <small>${stockStatus(stock)}</small>
          </td>

          <td>
            ${
              hasPrice
                ? `<strong>${money(price)}</strong>`
                : `<strong class="inv-price-missing">
                     Sin precio
                   </strong>`
            }
          </td>

          <td>
            <strong>${money(stockValue)}</strong>
          </td>

          <td>
            <div class="inv-actions">
              <button
                class="inv-btn inv-btn-primary inv-btn-small"
                data-action="price"
                data-id="${escapeHtml(product.id)}"
                type="button"
              >
                Editar precio
              </button>

              <button
                class="inv-btn inv-btn-outline inv-btn-small"
                data-action="movements"
                data-id="${escapeHtml(product.id)}"
                type="button"
              >
                Movimientos
              </button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  // =========================================
  // PAGINACIÓN
  // =========================================

  function renderPagination() {
    const pages = state.totalPages
    const page = state.page

    const first = state.total === 0
      ? 0
      : (page - 1) * 15 + 1

    const last = Math.min(
      page * 15,
      state.total
    )

    $('inventoryPageInfo').textContent =
      `Mostrando ${first}-${last} de ` +
      `${state.total} productos · ` +
      `Página ${page} de ${pages}`

    $('inventoryPrevious').disabled =
      page <= 1

    $('inventoryNext').disabled =
      page >= pages
  }

  // =========================================
  // CARGAR INVENTARIO
  // =========================================

  async function loadInventory() {
    const requestNumber = ++state.requestNumber

    const params = new URLSearchParams({
      page: String(state.page),
      search: $('inventorySearch').value.trim(),
      categoryId: $('inventoryCategory').value,
      stockFilter: $('inventoryStock').value
    })

    $('inventoryTable').innerHTML = `
      <tr>
        <td colspan="6" class="inv-empty">
          Cargando inventario...
        </td>
      </tr>
    `

    try {
      const result = await api(
        `${API}?${params.toString()}`
      )

      if (requestNumber !== state.requestNumber) {
        return
      }

      if (!Array.isArray(result.data)) {
        throw new Error(
          'La respuesta del inventario no es válida.'
        )
      }

      state.products = result.data
      state.page = Number(result.pagination.page)
      state.total = Number(result.pagination.total)
      state.totalPages = Number(
        result.pagination.totalPages
      )

      renderProducts()
      renderPagination()
    } catch (error) {
      if (requestNumber !== state.requestNumber) {
        return
      }

      $('inventoryTable').innerHTML = `
        <tr>
          <td colspan="6" class="inv-empty">
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `

      notify(error.message)
    }
  }

  // =========================================
  // ABRIR / CERRAR MODALES
  // =========================================

  function toggleModal(id, open) {
    $(id).classList.toggle('inv-hidden', !open)

    const noneOpen =
      $('priceModal').classList.contains('inv-hidden') &&
      $('movementsModal').classList.contains('inv-hidden')

    document.body.style.overflow =
      noneOpen ? '' : 'hidden'
  }

  // =========================================
  // MODAL: EDITAR PRECIO
  // =========================================

  function openPriceModal(id) {
    const product = state.products.find(
      (item) => String(item.id) === String(id)
    )

    if (!product) {
      notify('No se encontró el producto.')
      return
    }

    state.currentProduct = product

    $('priceProductImage').innerHTML =
      productImage(product)

    $('priceProductName').textContent =
      product.name

    $('priceProductCode').textContent =
      `Código: ${product.code || '—'}`

    $('priceProductStock').textContent =
      `Stock actual: ${product.stock} ${
        product.unit || 'UND'
      }`

    $('newSalePrice').value =
      Number(product.salePrice) > 0
        ? Number(product.salePrice).toFixed(2)
        : ''

    showPriceError('')
    toggleModal('priceModal', true)

    $('newSalePrice').focus()
  }

  // =========================================
  // GUARDAR PRECIO
  // =========================================

  async function savePrice(event) {
    event.preventDefault()

    if (state.loading || !state.currentProduct) {
      return
    }

    const rawPrice = $('newSalePrice').value.trim()

    if (
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(
        rawPrice
      ) ||
      Number(rawPrice) <= 0
    ) {
      showPriceError(
        'Ingresa un precio mayor a cero y con máximo dos decimales.'
      )
      return
    }

    const id = state.currentProduct.id

    state.loading = true
    $('savePrice').disabled = true
    showPriceError('')

    try {
      const result = await api(
        `${API}/${encodeURIComponent(id)}/price`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            salePrice: rawPrice
          })
        }
      )

      toggleModal('priceModal', false)
      notify(result.message)

      await Promise.all([
        loadInventory(),
        loadStats()
      ])
    } catch (error) {
      showPriceError(error.message)
    } finally {
      state.loading = false
      $('savePrice').disabled = false
    }
  }

  // =========================================
  // HISTORIAL DE MOVIMIENTOS
  // =========================================

  async function openMovements(id) {
    const product = state.products.find(
      (item) => String(item.id) === String(id)
    )

    if (!product) return

    $('movementsTitle').textContent =
      `Movimientos: ${product.name}`

    $('movementsSubtitle').textContent =
      `Código: ${product.code || '—'} · ` +
      `Stock actual: ${product.stock}`

    $('movementsTable').innerHTML = `
      <tr>
        <td colspan="6" class="inv-empty">
          Cargando movimientos...
        </td>
      </tr>
    `

    toggleModal('movementsModal', true)

    try {
      const result = await api(
        `${API}/${encodeURIComponent(id)}/movements`
      )

      const movements = result.data.movements

      if (!Array.isArray(movements)) {
        throw new Error(
          'No se recibió un historial válido.'
        )
      }

      if (!movements.length) {
        $('movementsTable').innerHTML = `
          <tr>
            <td colspan="6" class="inv-empty">
              Este producto todavía no tiene movimientos registrados.
            </td>
          </tr>
        `
        return
      }

      $('movementsTable').innerHTML =
        movements.map((movement) => {
          const quantity = Number(
            movement.quantity_change
          )

          return `
            <tr>
              <td>
                ${dateText(movement.created_at)}
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    movement.movement_type
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    movement.reference_type || '—'
                  )}
                </small>
              </td>

              <td>
                <strong>
                  ${quantity > 0 ? '+' : ''}
                  ${numberText(quantity)}
                </strong>
              </td>

              <td>
                ${numberText(
                  movement.stock_before
                )}
              </td>

              <td>
                <strong>
                  ${numberText(
                    movement.stock_after
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  movement.reason || 'Sin detalle'
                )}
              </td>
            </tr>
          `
        }).join('')
    } catch (error) {
      $('movementsTable').innerHTML = `
        <tr>
          <td colspan="6" class="inv-empty">
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `
    }
  }

  // =========================================
  // EVENTOS
  // =========================================

  function bindEvents() {

    // Buscar productos
    $('inventorySearch').addEventListener(
      'input',
      () => {
        clearTimeout(searchTimer)

        searchTimer = setTimeout(() => {
          state.page = 1
          loadInventory()
        }, 350)
      }
    )

    // Filtrar categorías
    $('inventoryCategory').addEventListener(
      'change',
      () => {
        state.page = 1
        loadInventory()
      }
    )

    // Filtrar por stock
    $('inventoryStock').addEventListener(
      'change',
      () => {
        state.page = 1
        loadInventory()
      }
    )

    // Actualizar inventario
    $('refreshInventory').addEventListener(
      'click',
      async () => {
        await Promise.all([
          loadInventory(),
          loadStats(),
          loadCategories()
        ])

        notify('Inventario actualizado.')
      }
    )

    // Página anterior
    $('inventoryPrevious').addEventListener(
      'click',
      () => {
        if (state.page <= 1) return

        state.page--
        loadInventory()
      }
    )

    // Página siguiente
    $('inventoryNext').addEventListener(
      'click',
      () => {
        if (state.page >= state.totalPages) return

        state.page++
        loadInventory()
      }
    )

    // Acciones en productos
    $('inventoryTable').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-action]'
        )

        if (!button) return

        const { action, id } = button.dataset

        if (action === 'price') {
          openPriceModal(id)
        }

        if (action === 'movements') {
          openMovements(id)
        }
      }
    )

    // Guardar precio
    $('priceForm').addEventListener(
      'submit',
      savePrice
    )

    // Cerrar modal de precio
    for (const id of [
      'closePriceModal',
      'cancelPrice'
    ]) {
      $(id).addEventListener(
        'click',
        () => {
          if (!state.loading) {
            toggleModal('priceModal', false)
          }
        }
      )
    }

    // Cerrar movimientos
    for (const id of [
      'closeMovements',
      'closeMovementsBottom'
    ]) {
      $(id).addEventListener(
        'click',
        () => toggleModal('movementsModal', false)
      )
    }

    // Tecla Escape
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return

        if (!state.loading) {
          toggleModal('priceModal', false)
        }

        toggleModal('movementsModal', false)
      }
    )
  }

  // =========================================
  // INICIALIZAR MÓDULO
  // =========================================

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      bindEvents()

      Promise.all([
        loadInventory(),
        loadStats(),
        loadCategories()
      ])
    }
  )
})()
