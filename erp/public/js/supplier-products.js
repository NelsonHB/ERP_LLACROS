'use strict'

// ============================================
// EZCUDO360 - PRODUCTOS POR PROVEEDOR
// Mantiene el diseño original de Proveedores.
// ============================================

;(function () {
  const API = '/api/v1/supplier-products'
  const SUPPLIERS_API = '/api/v1/suppliers'
  const $ = (id) => document.getElementById(id)
  const CODE_RE = /^[A-Za-z0-9._\/-]+$/
  const COST_RE = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024
  const MAX_IMAGES = 8

  let links = []
  let suppliers = []
  let products = []
  let categories = []
  let editLinkId = null
  let detailLinkId = null
  let busy = false
  let toastTimer

  const fieldIds = {
    supplierId: 'spSupplierId', productId: 'spProductId',
    code: 'spCode', barcode: 'spBarcode', name: 'spName',
    brand: 'spBrand', model: 'spModel', categoryId: 'spCategoryId',
    unit: 'spUnit', supplierSku: 'spSupplierSku',
    referenceCost: 'spReferenceCost', active: 'spLinkActive', image: 'spImages',
  }

  // ========================================
  // HELPERS (nunca insertar datos de API con innerHTML)
  // ========================================

  function node(tag, className = '', label) {
    const item = document.createElement(tag)
    if (className) item.className = className
    if (label !== undefined) item.textContent = String(label)
    return item
  }

  function normalized(value) {
    return String(value ?? '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  function isActive(link) {
    return link.active === true && link.supplierActive === true && link.product.active === true
  }

  function money(value) {
    if (value === null || value === undefined || value === '') return 'Sin definir'
    const amount = Number(value)
    return Number.isFinite(amount) ? `S/ ${amount.toFixed(2)}` : 'Sin definir'
  }

  function toast(message) {
    $('spToast').textContent = message
    $('spToast').classList.remove('sup-hidden')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => $('spToast').classList.add('sup-hidden'), 4200)
  }

  function safeToken() {
    try { return localStorage.getItem('erp_token') } catch { return null }
  }

  async function api(url, options = {}) {
    const token = safeToken()
    if (!token) throw new Error('No hay sesión activa. Inicia sesión otra vez.')
    const result = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const data = await result.json().catch(() => ({}))
    if (!result.ok || data.success === false) {
      const error = new Error(data.message || `Error HTTP ${result.status}`)
      error.details = data.errors || {}
      if (result.status === 401) error.message = 'Tu sesión caducó. Vuelve a iniciar sesión.'
      throw error
    }
    return data
  }

  function option(select, value, label) {
    const el = node('option', '', label)
    el.value = String(value)
    select.appendChild(el)
  }

  function missingRow(label) {
    const tr = node('tr')
    const td = node('td', 'sup-empty', label)
    td.colSpan = 8
    tr.appendChild(td)
    return tr
  }

  // ========================================
  // CARGA INDEPENDIENTE DE PROVEEDORES Y CATÁLOGO
  // La falla de una ruta NO oculta los proveedores.
  // ========================================

  async function fetchSuppliers() {
    // Fuente principal: consulta directa a erp.suppliers desde este módulo.
    // Si aún no se agregó la nueva ruta, usa la API de Proveedores existente.
    let primaryError
    for (const url of [`${API}/suppliers`, SUPPLIERS_API]) {
      try {
        const result = await api(url)
        if (!Array.isArray(result.data)) {
          throw new Error(`La respuesta de ${url} no contiene una lista de proveedores.`)
        }
        return result.data.map((item) => ({
          ...item,
          businessName: item.businessName ?? item.business_name ?? '',
          active: item.active === true || item.active === 'true',
        }))
      } catch (error) {
        if (!primaryError) primaryError = error
        // No ocultar errores de autenticación con una segunda consulta.
        if (/sesión|inicia sesión/i.test(error.message)) throw error
        console.warn(`[Productos por proveedor] ${url}:`, error.message)
      }
    }
    throw new Error(
      `No fue posible consultar los proveedores. ${primaryError?.message || 'Comprueba las rutas de API.'}`
    )
  }

  function showLoadWarnings(messages) {
    const box = $('spLoadWarnings')
    if (!box) return
    box.replaceChildren()
    if (!messages.length) {
      box.classList.add('sup-hidden')
      return
    }
    box.classList.remove('sup-hidden')
    box.textContent = messages.join(' · ')
  }

  async function loadData() {
    $('spRefresh').disabled = true
    $('spTable').replaceChildren(missingRow('Cargando productos por proveedor...'))

    // Cada recurso se solicita de forma independiente.
    const results = await Promise.allSettled([
      fetchSuppliers(),
      api(API),
      api(`${API}/catalog`),
      api(`${API}/categories`),
    ])

    const [supplierResult, linkResult, catalogResult, categoryResult] = results
    const warnings = []

    if (supplierResult.status === 'fulfilled') {
      suppliers = supplierResult.value
      console.info(`[Productos por proveedor] ${suppliers.length} proveedor(es) cargado(s).`)
    } else {
      suppliers = []
      warnings.push('No se pudieron cargar los proveedores: ' + supplierResult.reason.message)
      console.error('[Productos por proveedor] Proveedores:', supplierResult.reason)
    }

    if (linkResult.status === 'fulfilled') {
      links = Array.isArray(linkResult.value.data) ? linkResult.value.data : []
    } else {
      links = []
      warnings.push('No se pudieron cargar las asociaciones: ' + linkResult.reason.message)
      console.error('[Productos por proveedor] Asociaciones:', linkResult.reason)
    }

    if (catalogResult.status === 'fulfilled') {
      products = Array.isArray(catalogResult.value.data) ? catalogResult.value.data : []
    } else {
      products = []
      warnings.push('No se pudo consultar el catálogo de productos: ' + catalogResult.reason.message)
      console.error('[Productos por proveedor] Catálogo:', catalogResult.reason)
    }

    if (categoryResult.status === 'fulfilled') {
      categories = Array.isArray(categoryResult.value.data) ? categoryResult.value.data : []
    } else {
      categories = []
      warnings.push('No se pudieron cargar las categorías: ' + categoryResult.reason.message)
      console.error('[Productos por proveedor] Categorías:', categoryResult.reason)
    }

    fillSuppliers()
    fillCategories()
    fillCatalog()
    renderRows()
    showLoadWarnings(warnings)

    // Aviso visible aunque el proveedor aún no tenga productos asociados.
    const activeSuppliers = suppliers.filter((supplier) => supplier.active).length
    const summary = $('spSuppliersSummary')
    if (summary) {
      summary.textContent = supplierResult.status === 'fulfilled'
        ? `${suppliers.length} proveedores registrados (${activeSuppliers} activos). ` +
          (links.length === 0 ? 'Para mostrar productos aquí, pulsa «+ Asociar producto».' : 'Selecciona un proveedor para ver sus productos.')
        : 'No se pudo consultar la lista de proveedores. Revisa el aviso de conexión.'
    }

    if (linkResult.status === 'rejected') {
      $('spTable').replaceChildren(missingRow('No se pudieron cargar las asociaciones. Revisa el aviso de conexión.'))
    }

    if (warnings.length) toast(warnings[0])
    $('spRefresh').disabled = false
  }

  function fillSuppliers() {
    const filter = $('spSupplierFilter')
    const selectedFilter = filter.value
    filter.replaceChildren()
    option(filter, '', 'Todos los proveedores')
    suppliers.forEach((supplier) => {
      option(filter, supplier.id, `${supplier.businessName}${supplier.active ? '' : ' (inactivo)'}`)
    })
    if ([...filter.options].some((item) => item.value === selectedFilter)) {
      filter.value = selectedFilter
    }

    const select = $('spSupplierId')
    const selectedForm = select.value
    select.replaceChildren()
    option(select, '', suppliers.length ? 'Selecciona un proveedor' : 'No hay proveedores registrados')
    suppliers.filter((supplier) => supplier.active).forEach((supplier) => {
      option(select, supplier.id, supplier.businessName)
    })

    // Permitir seguir editando un vínculo histórico aunque el proveedor esté inactivo.
    if (editLinkId !== null) {
      const editing = links.find((link) => String(link.id) === String(editLinkId))
      if (editing && ![...select.options].some((item) => item.value === String(editing.supplierId))) {
        option(select, editing.supplierId, `${editing.supplierName} (inactivo)`)
      }
    }

    if ([...select.options].some((item) => item.value === selectedForm)) {
      select.value = selectedForm
    } else {
      select.value = ''
    }

    const help = $('spSupplierHelp')
    if (help) {
      const available = suppliers.filter((supplier) => supplier.active).length
      help.textContent = available
        ? `${available} proveedor(es) activo(s) disponible(s) para asociar productos.`
        : 'No hay proveedores activos. Registra o activa uno desde el módulo Proveedores.'
    }
  }

  function fillCategories() {
    const select = $('spCategoryId')
    const selected = select.value
    select.replaceChildren()
    option(select, '', 'Sin categoría')
    categories.forEach((category) => option(select, category.id, category.name))
    if ([...select.options].some((opt) => opt.value === selected)) select.value = selected
  }

  function fillCatalog() {
    const select = $('spProductId')
    const selected = select.value
    const supplierId = $('spSupplierId').value
    const search = normalized($('spCatalogSearch').value)

    select.replaceChildren()
    if (!supplierId) {
      option(select, '', 'Primero selecciona un proveedor activo')
      select.value = ''
      return
    }
    const eligible = products.filter((product) => {
      if (!product.active) return false
      if (!normalized([product.code, product.name, product.brand, product.model].join(' ')).includes(search)) return false
      // No duplicar una asociación preexistente. Una asociación inactiva debe reactivarse.
      return !links.some((link) =>
        String(link.supplierId) === supplierId && String(link.productId) === String(product.id)
      )
    })
    eligible.forEach((product) => option(select, product.id, `${product.code} — ${product.name}`))
    if (!eligible.length) option(select, '', 'Sin productos disponibles; utiliza «Crear producto nuevo»')
    if ([...select.options].some((opt) => opt.value === selected)) select.value = selected
    else select.selectedIndex = -1
  }

  // ========================================
  // TABLA (mismo estilo del listado Proveedores)
  // ========================================

  function tableCell(tr, content) {
    const td = node('td')
    if (typeof content === 'string') td.textContent = content
    else if (content) td.appendChild(content)
    tr.appendChild(td)
    return td
  }

  function action(label, callback, extra = '') {
    const button = node('button', `sup-action-btn ${extra}`.trim(), label)
    button.type = 'button'
    button.addEventListener('click', callback)
    return button
  }

  function renderRows() {
    const term = normalized($('spSearch').value)
    const supplierId = $('spSupplierFilter').value
    const status = $('spStatusFilter').value
    const activeCount = links.filter(isActive).length

    $('spTotal').textContent = String(links.length)
    $('spActive').textContent = String(activeCount)
    $('spInactive').textContent = String(links.length - activeCount)

    const filtered = links.filter((link) => {
      if (supplierId && String(link.supplierId) !== supplierId) return false
      if (status === 'active' && !isActive(link)) return false
      if (status === 'inactive' && isActive(link)) return false
      return normalized([
        link.product.name, link.product.code, link.product.barcode,
        link.product.brand, link.product.model, link.supplierName,
        link.supplierSku, link.product.categoryName,
      ].join(' ')).includes(term)
    })

    $('spCount').textContent = `Mostrando ${filtered.length} de ${links.length} asociaciones`
    const tbody = $('spTable')
    tbody.replaceChildren()
    if (!filtered.length) {
      tbody.appendChild(missingRow('No se encontraron productos por proveedor.'))
      return
    }

    for (const link of filtered) {
      const tr = node('tr')
      const item = node('div', 'sp-product-cell')
      const cover = link.images?.find((img) => img.isPrimary) || link.images?.[0]
      if (cover) {
        const photo = node('img', 'sp-photo')
        photo.src = cover.url
        photo.alt = link.product.name
        photo.loading = 'lazy'
        item.appendChild(photo)
      } else {
        item.appendChild(node('div', 'sp-photo-empty', '▣'))
      }
      const identity = node('div', 'sup-provider-name')
      identity.appendChild(node('strong', '', link.product.name))
      identity.appendChild(node('small', '', [link.product.brand, link.product.model].filter(Boolean).join(' · ') || 'Sin marca / modelo'))
      item.appendChild(identity)
      tableCell(tr, item)

      const codeBox = node('div', 'sup-document')
      codeBox.appendChild(node('strong', '', link.product.code))
      if (link.supplierSku) codeBox.appendChild(node('small', '', `SKU: ${link.supplierSku}`))
      tableCell(tr, codeBox)
      tableCell(tr, link.supplierName)
      tableCell(tr, money(link.referenceCost))
      tableCell(tr, money(link.product.salePrice))
      tableCell(tr, `${link.images?.length || 0} foto(s)`)

      const active = isActive(link)
      const badge = node('span', `sup-status ${active ? 'active' : 'inactive'}`, active ? 'Activo' : 'Inactivo')
      tableCell(tr, badge)

      const actions = node('div', 'sup-actions')
      actions.appendChild(action('Detalles', () => openDetail(link.id)))
      actions.appendChild(action('Editar', () => openForm(link)))
      if (link.active) {
        actions.appendChild(action('Desvincular', () => toggleLink(link), 'danger'))
      } else {
        actions.appendChild(action('Reactivar', () => toggleLink(link), 'success'))
      }
      tableCell(tr, actions)
      tbody.appendChild(tr)
    }
  }

  // ========================================
  // FORMULARIO Y VALIDACIONES
  // ========================================

  function mode() {
    return document.querySelector('input[name="spMode"]:checked')?.value || 'existing'
  }

  function showMode() {
    const newMode = mode() === 'new'
    $('spNewProductBlock').classList.toggle('sup-hidden', !newMode)
    $('spExistingBlock').classList.toggle('sup-hidden', newMode)
    clearErrors()
  }

  function setError(name, value) {
    const control = $(fieldIds[name])
    const element = document.querySelector(`[data-sp-error="${name}"]`)
    if (control) {
      control.classList.toggle('sp-invalid', Boolean(value))
      control.setAttribute('aria-invalid', String(Boolean(value)))
    }
    if (element) element.textContent = value || ''
  }

  function clearErrors() {
    Object.keys(fieldIds).forEach((field) => setError(field, ''))
    $('spFormError').textContent = ''
    $('spFormError').classList.add('sup-hidden')
  }

  function showErrors(errors) {
    clearErrors()
    for (const [key, message] of Object.entries(errors || {})) setError(key, String(message))
    $('spFormError').textContent = 'Revisa los campos señalados antes de guardar.'
    $('spFormError').classList.remove('sup-hidden')
    const first = Object.keys(errors || {}).find((name) => fieldIds[name])
    if (first) $(fieldIds[first]).focus()
  }

  function checkedFiles() {
    const files = [...$('spImages').files]
    const errors = {}
    if (files.length > MAX_IMAGES) errors.image = `Puedes seleccionar hasta ${MAX_IMAGES} imágenes.`
    const invalid = files.find((file) => !ALLOWED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size <= 0)
    if (invalid) errors.image = 'Solo imágenes JPG, PNG o WEBP, máximo 5 MB por archivo.'
    return { files, errors }
  }

  function validateForm(data, images) {
    const errors = { ...images.errors }
    if (!/^\d+$/.test(String(data.supplierId)) || Number(data.supplierId) <= 0) {
      errors.supplierId = 'Selecciona un proveedor activo.'
    }
    if (editLinkId === null && mode() === 'existing') {
      if (!/^\d+$/.test(String(data.productId)) || Number(data.productId) <= 0) {
        errors.productId = 'Selecciona un producto existente.'
      }
    }
    if (editLinkId === null && mode() === 'new') {
      if (!data.code || data.code.length > 50 || !CODE_RE.test(data.code)) {
        errors.code = 'Código obligatorio, máximo 50 caracteres, sin espacios ni símbolos especiales.'
      }
      if (!data.name || data.name.length > 150) errors.name = 'Nombre obligatorio, máximo 150 caracteres.'
      if (data.barcode && (data.barcode.length > 100 || !CODE_RE.test(data.barcode))) {
        errors.barcode = 'Código de barras inválido.'
      }
      if (data.brand?.length > 100) errors.brand = 'Máximo 100 caracteres.'
      if (data.model?.length > 100) errors.model = 'Máximo 100 caracteres.'
    }
    if (data.supplierSku?.length > 100) errors.supplierSku = 'Máximo 100 caracteres.'
    if (data.referenceCost !== '' && !COST_RE.test(data.referenceCost)) {
      errors.referenceCost = 'Costo inválido: utiliza 0 o un número positivo con máximo 2 decimales.'
    }
    return errors
  }

  function formValues() {
    return {
      supplierId: $('spSupplierId').value,
      productId: $('spProductId').value,
      code: $('spCode').value.trim().toUpperCase(),
      barcode: $('spBarcode').value.trim(),
      name: $('spName').value.trim(),
      description: $('spDescription').value.trim(),
      brand: $('spBrand').value.trim(),
      model: $('spModel').value.trim(),
      categoryId: $('spCategoryId').value || null,
      unit: $('spUnit').value,
      supplierSku: $('spSupplierSku').value.trim(),
      referenceCost: $('spReferenceCost').value.trim(),
      active: $('spLinkActive').value === 'true',
    }
  }

  function openForm(link = null) {
    if (busy) return
    editLinkId = link ? String(link.id) : null
    $('spForm').reset()
    $('spImages').value = ''
    clearErrors()
    document.querySelector('input[name="spMode"][value="existing"]').checked = true
    $('spModalTitle').textContent = link ? 'Editar producto por proveedor' : 'Asociar producto a proveedor'
    $('spSave').textContent = link ? 'Guardar cambios' : 'Guardar asociación'
    $('spModeBlock').classList.toggle('sup-hidden', Boolean(link))
    $('spSupplierId').disabled = Boolean(link)
    $('spCatalogSearch').disabled = Boolean(link)
    $('spProductId').disabled = Boolean(link)
    $('spExistingBlock').classList.toggle('sup-hidden', Boolean(link))
    $('spActiveBlock').classList.toggle('sup-hidden', !link)
    $('spNewProductBlock').classList.add('sup-hidden')

    if (link) {
      // La edición solo afecta SKU/costo/estado del proveedor.
      if (![...$('spSupplierId').options].some((item) => item.value === String(link.supplierId))) {
        option($('spSupplierId'), link.supplierId, link.supplierName)
      }
      $('spSupplierId').value = String(link.supplierId)
      $('spSupplierSku').value = link.supplierSku || ''
      $('spReferenceCost').value = link.referenceCost ?? ''
      $('spLinkActive').value = String(link.active)
      const banner = $('spFormError')
      banner.textContent = `${link.product.name} (${link.product.code}) · ${link.supplierName}. Los datos generales del producto y su precio de venta se mantienen en Inventario.`
      banner.classList.remove('sup-hidden')
      banner.classList.add('sp-info-banner')
    } else {
      $('spFormError').classList.remove('sp-info-banner')
      const fromFilter = $('spSupplierFilter').value
      $('spSupplierId').value = fromFilter && suppliers.some((s) => String(s.id) === fromFilter && s.active)
        ? fromFilter : ''
      showMode()
      if (!suppliers.some((supplier) => supplier.active)) {
        const banner = $('spFormError')
        banner.classList.remove('sup-hidden', 'sp-info-banner')
        banner.textContent = 'No hay proveedores activos disponibles. Comprueba que registraste uno en Proveedores y que la API responde correctamente.'
      }
      fillCatalog()
    }

    $('spModal').classList.remove('sup-hidden')
    if (!link) $('spSupplierId').focus()
    else $('spSupplierSku').focus()
  }

  function closeForm() {
    if (busy) return
    $('spModal').classList.add('sup-hidden')
    $('spFormError').classList.remove('sp-info-banner')
    editLinkId = null
    fillSuppliers()
  }

  async function uploadFiles(productId, files) {
    const problems = []
    for (const file of files) {
      const form = new FormData()
      form.append('image', file, file.name)
      try {
        await api(`${API}/products/${productId}/images`, { method: 'POST', body: form })
      } catch (error) {
        problems.push(`${file.name}: ${error.message}`)
      }
    }
    return problems
  }

  async function save(event) {
    event.preventDefault()
    if (busy) return
    const data = formValues()
    const images = checkedFiles()
    const errors = validateForm(data, images)
    if (Object.keys(errors).length) { showErrors(errors); return }

    const link = editLinkId !== null ? links.find((row) => String(row.id) === editLinkId) : null
    if (link) {
      const totalCurrent = link.images?.length || 0
      if (totalCurrent + images.files.length > MAX_IMAGES) {
        showErrors({ image: `Este producto tiene ${totalCurrent} foto(s). No puede superar ${MAX_IMAGES}.` })
        return
      }
    } else if (mode() === 'existing') {
      const product = products.find((p) => String(p.id) === String(data.productId))
      const already = product?.images?.length || 0
      if (already + images.files.length > MAX_IMAGES) {
        showErrors({ image: `El producto ya tiene ${already} foto(s). Máximo ${MAX_IMAGES}.` })
        return
      }
    }

    clearErrors()
    busy = true
    $('spSave').disabled = true
    $('spCancel').disabled = true
    $('spClose').disabled = true
    $('spSave').textContent = 'Guardando...'

    try {
      let result
      let productId
      if (link) {
        productId = link.productId
        result = await api(`${API}/${link.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierSku: data.supplierSku,
            referenceCost: data.referenceCost,
            active: data.active,
          }),
        })
      } else if (mode() === 'new') {
        result = await api(`${API}/new-product`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: data.supplierId,
            code: data.code, barcode: data.barcode,
            name: data.name, brand: data.brand, model: data.model,
            description: data.description, categoryId: data.categoryId,
            unit: data.unit, supplierSku: data.supplierSku,
            referenceCost: data.referenceCost,
          }),
        })
        productId = result.data.productId
      } else {
        result = await api(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: data.supplierId,
            productId: data.productId,
            supplierSku: data.supplierSku,
            referenceCost: data.referenceCost,
            active: true,
          }),
        })
        productId = result.data.productId
      }

      // Si la imagen falla, NO revertir la asociación/producto ya guardados.
      // Así el usuario sabe qué se guardó y qué quedó pendiente.
      const failed = images.files.length ? await uploadFiles(productId, images.files) : []
      $('spModal').classList.add('sup-hidden')
      editLinkId = null
      await loadData()
      if (failed.length) {
        toast(`${result.message} Algunas imágenes no se subieron: ${failed.join(' | ')}`)
      } else {
        toast(result.message)
      }
    } catch (error) {
      if (error.details && Object.keys(error.details).length) {
        showErrors(error.details)
      } else {
        $('spFormError').classList.remove('sp-info-banner', 'sup-hidden')
        $('spFormError').textContent = error.message
      }
      toast(error.message)
    } finally {
      busy = false
      $('spSave').disabled = false
      $('spCancel').disabled = false
      $('spClose').disabled = false
      $('spSave').textContent = editLinkId ? 'Guardar cambios' : 'Guardar asociación'
      fillSuppliers()
    }
  }

  async function toggleLink(link) {
    if (busy) return
    const label = link.active ? 'desvincular' : 'reactivar'
    if (!confirm(`¿Deseas ${label} "${link.product.name}" de "${link.supplierName}"?\n\nEl producto NO se borrará del inventario.`)) return
    busy = true
    try {
      if (link.active) {
        await api(`${API}/${link.id}`, { method: 'DELETE' })
      } else {
        await api(`${API}/${link.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierSku: link.supplierSku || '',
            referenceCost: link.referenceCost ?? '',
            active: true,
          }),
        })
      }
      toast(`Asociación ${link.active ? 'desactivada' : 'reactivada'} correctamente.`)
      await loadData()
    } catch (error) {
      toast(error.message)
    } finally {
      busy = false
    }
  }

  // ========================================
  // DETALLE DEL PRODUCTO Y GALERÍA
  // ========================================

  function detailEntry(parent, label, value) {
    const wrapper = node('div', 'sp-detail-entry')
    wrapper.appendChild(node('small', '', label))
    wrapper.appendChild(node('strong', '', value ?? '—'))
    parent.appendChild(wrapper)
  }

  function detailButton(text, callback) {
    return action(text, callback)
  }

  function openDetail(id) {
    detailLinkId = String(id)
    renderDetail()
    $('spDetailModal').classList.remove('sup-hidden')
  }

  function renderDetail() {
    const link = links.find((row) => String(row.id) === detailLinkId)
    if (!link) { closeDetail(); return }
    const product = link.product
    $('spDetailTitle').textContent = `Detalle: ${product.name}`
    const wrapper = $('spDetailBody')
    wrapper.replaceChildren()
    const summary = node('div', 'sp-detail-main')
    const cover = link.images?.find((img) => img.isPrimary) || link.images?.[0]
    if (cover) {
      const image = node('img', 'sp-detail-cover')
      image.src = cover.url
      image.alt = product.name
      summary.appendChild(image)
    } else summary.appendChild(node('div', 'sp-detail-cover sp-detail-cover-empty', '▣'))

    const header = node('div')
    header.appendChild(node('h3', '', product.name))
    header.appendChild(node('p', '', product.description || 'Sin descripción'))
    header.appendChild(node('p', 'sp-note', `Proveedor: ${link.supplierName}`))
    summary.appendChild(header)
    wrapper.appendChild(summary)

    const grid = node('div', 'sp-detail-grid')
    detailEntry(grid, 'Código', product.code)
    detailEntry(grid, 'Código de barras', product.barcode || '—')
    detailEntry(grid, 'Marca', product.brand || '—')
    detailEntry(grid, 'Modelo', product.model || '—')
    detailEntry(grid, 'Categoría', product.categoryName || 'Sin categoría')
    detailEntry(grid, 'Unidad', product.unit)
    detailEntry(grid, 'SKU del proveedor', link.supplierSku || '—')
    detailEntry(grid, 'Costo referencial', money(link.referenceCost))
    detailEntry(grid, 'Precio de venta (Inventario)', money(product.salePrice))
    detailEntry(grid, 'Stock actual', String(product.stock))
    detailEntry(grid, 'Stock mínimo', String(product.minimumStock))
    detailEntry(grid, 'Vínculo', isActive(link) ? 'Activo' : 'Inactivo')
    wrapper.appendChild(grid)

    wrapper.appendChild(node('h3', 'sp-details-heading', `Imágenes del producto (${link.images.length}/${MAX_IMAGES})`))
    const gallery = node('div', 'sp-gallery')
    if (!link.images.length) gallery.appendChild(node('p', 'sp-missing', 'Este producto aún no tiene imágenes.'))

    for (const photo of link.images) {
      const card = node('div', 'sp-gallery-card')
      const img = node('img')
      img.src = photo.url
      img.alt = photo.altText || product.name
      img.loading = 'lazy'
      card.appendChild(img)
      const caption = node('div', 'sp-gallery-caption')
      caption.appendChild(node('strong', '', photo.isPrimary ? 'Principal' : 'Imagen adicional'))
      const actions = node('div', 'sp-gallery-actions')
      if (!photo.isPrimary) actions.appendChild(detailButton('Hacer principal', () => setPrimary(link, photo)))
      actions.appendChild(detailButton('Eliminar', () => deleteImage(link, photo)))
      caption.appendChild(actions)
      card.appendChild(caption)
      gallery.appendChild(card)
    }
    wrapper.appendChild(gallery)

    const upload = node('div', 'sp-gallery-upload')
    upload.appendChild(node('strong', '', 'Agregar más imágenes'))
    upload.appendChild(node('p', '', `Hasta ${MAX_IMAGES} fotos JPG/PNG/WEBP, máximo 5 MB cada una. Las imágenes se comparten con otros proveedores del mismo producto.`))
    const fileInput = node('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/png,image/jpeg,image/webp'
    fileInput.multiple = true
    upload.appendChild(fileInput)
    const button = node('button', 'sup-btn sup-btn-primary', 'Subir imágenes')
    button.type = 'button'
    button.addEventListener('click', async () => {
      if (busy) return
      const files = [...fileInput.files]
      if (!files.length) { toast('Selecciona al menos una imagen.'); return }
      if (files.length + link.images.length > MAX_IMAGES) {
        toast(`Este producto admite como máximo ${MAX_IMAGES} imágenes.`)
        return
      }
      if (files.some((file) => !ALLOWED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size <= 0)) {
        toast('Solo JPG, PNG o WEBP, máximo 5 MB por archivo.')
        return
      }
      busy = true
      button.disabled = true
      try {
        const failed = await uploadFiles(link.productId, files)
        await loadData()
        renderDetail()
        toast(failed.length ? `Algunas imágenes fallaron: ${failed.join(' | ')}` : 'Imágenes subidas correctamente.')
      } finally { busy = false; button.disabled = false }
    })
    upload.appendChild(button)
    wrapper.appendChild(upload)
  }

  async function setPrimary(link, photo) {
    if (busy) return
    busy = true
    try {
      await api(`${API}/products/${link.productId}/images/${photo.id}/primary`, { method: 'PATCH' })
      await loadData()
      renderDetail()
      toast('Imagen principal actualizada.')
    } catch (error) { toast(error.message) }
    finally { busy = false }
  }

  async function deleteImage(link, photo) {
    if (busy) return
    if (!confirm('¿Eliminar esta imagen? Se quitará de todos los proveedores que compartan el producto.')) return
    busy = true
    try {
      await api(`${API}/products/${link.productId}/images/${photo.id}`, { method: 'DELETE' })
      await loadData()
      renderDetail()
      toast('Imagen eliminada del catálogo.')
    } catch (error) { toast(error.message) }
    finally { busy = false }
  }

  function closeDetail() {
    if (busy) return
    detailLinkId = null
    $('spDetailModal').classList.add('sup-hidden')
  }

  // ========================================
  // INICIALIZACIÓN
  // ========================================

  document.addEventListener('DOMContentLoaded', () => {
    $('spNew').addEventListener('click', () => openForm())
    $('spRefresh').addEventListener('click', loadData)
    $('spSearch').addEventListener('input', renderRows)
    $('spSupplierFilter').addEventListener('change', renderRows)
    $('spStatusFilter').addEventListener('change', renderRows)
    $('spCatalogSearch').addEventListener('input', fillCatalog)
    $('spSupplierId').addEventListener('change', fillCatalog)
    document.querySelectorAll('input[name="spMode"]').forEach((radio) => radio.addEventListener('change', showMode))

    for (const [field, id] of Object.entries(fieldIds)) {
      $(id).addEventListener('input', () => setError(field, ''))
      $(id).addEventListener('change', () => setError(field, ''))
    }

    $('spReferenceCost').addEventListener('input', (event) => {
      const input = event.target
      input.value = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    })
    $('spForm').addEventListener('submit', save)
    $('spCancel').addEventListener('click', closeForm)
    $('spClose').addEventListener('click', closeForm)
    $('spDetailClose').addEventListener('click', closeDetail)
    $('spDetailDone').addEventListener('click', closeDetail)

    $('spModal').addEventListener('click', (event) => {
      if (event.target === $('spModal')) closeForm()
    })
    $('spDetailModal').addEventListener('click', (event) => {
      if (event.target === $('spDetailModal')) closeDetail()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      if (!$('spDetailModal').classList.contains('sup-hidden')) closeDetail()
      else if (!$('spModal').classList.contains('sup-hidden')) closeForm()
    })

    loadData()
  })
})()
