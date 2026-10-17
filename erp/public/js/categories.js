'use strict'

// ============================================
// EZCUDO360 - CATEGORÍAS DE PRODUCTOS
// Frontend con validación y API protegida.
// ============================================

;(function () {
  const API = '/api/v1/categories'
  const $ = (id) => document.getElementById(id)
  const NAME_REGEX = /^[\p{L}\p{M}\p{N} .,&()'°º\/-]+$/u

  let categories = []
  let editingId = null
  let saving = false
  let loading = false
  let toastTimer = null
  let previousFocus = null

  function element(tag, className = '', text) {
    const item = document.createElement(tag)
    if (className) item.className = className
    if (text !== undefined && text !== null) item.textContent = String(text)
    return item
  }

  function normalized(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
  }

  function toast(message) {
    const messageBox = $('categoryToast')
    messageBox.textContent = String(message)
    messageBox.classList.remove('sup-hidden')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => messageBox.classList.add('sup-hidden'), 4000)
  }

  async function api(path = '', options = {}) {
    let token = null
    try { token = localStorage.getItem('erp_token') } catch { /* no storage */ }
    if (!token) throw new Error('No hay una sesión activa. Inicia sesión nuevamente.')

    let response
    try {
      response = await fetch(API + path, {
        ...options,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      })
    } catch {
      throw new Error('No se pudo conectar al servidor ERP.')
    }

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success === false) {
      const error = new Error(
        response.status === 401
          ? 'Tu sesión expiró. Ingresa nuevamente al ERP.'
          : result.message || `Error del servidor (${response.status}).`
      )
      error.details = result.errors || {}
      throw error
    }
    return result
  }

  function emptyRow(message) {
    const row = document.createElement('tr')
    const cell = element('td', 'sup-empty', message)
    cell.colSpan = 5
    row.appendChild(cell)
    return row
  }

  async function loadCategories() {
    if (loading) return
    loading = true
    $('refreshCategories').disabled = true
    $('categoriesTable').replaceChildren(emptyRow('Cargando categorías...'))

    try {
      const response = await api()
      if (!Array.isArray(response.data)) {
        throw new Error('La API no devolvió una lista válida de categorías.')
      }
      categories = response.data
      updateStats()
      renderCategories()
    } catch (error) {
      categories = []
      updateStats()
      $('categoryCount').textContent = 'No se pudo cargar el listado'
      $('categoriesTable').replaceChildren(emptyRow(error.message))
      toast(error.message)
    } finally {
      loading = false
      $('refreshCategories').disabled = false
    }
  }

  function updateStats() {
    const activeCount = categories.filter((cat) => cat.active === true).length
    $('totalCategories').textContent = categories.length
    $('activeCategories').textContent = activeCount
    $('inactiveCategories').textContent = categories.length - activeCount
  }

  function renderCategories() {
    const search = normalized($('searchCategory').value)
    const filter = $('filterCategoryStatus').value
    const filtered = categories.filter((cat) => {
      const text = normalized(`${cat.name} ${cat.description ?? ''}`)
      const matchesSearch = !search || text.includes(search)
      const matchesStatus = filter === 'all' ||
        (filter === 'active' && cat.active === true) ||
        (filter === 'inactive' && cat.active === false)
      return matchesSearch && matchesStatus
    })

    $('categoryCount').textContent =
      `Mostrando ${filtered.length} de ${categories.length} categorías`

    const tbody = $('categoriesTable')
    tbody.replaceChildren()

    if (!filtered.length) {
      tbody.appendChild(emptyRow('No se encontraron categorías.'))
      return
    }

    for (const category of filtered) {
      const row = document.createElement('tr')

      const nameCell = document.createElement('td')
      nameCell.appendChild(element('span', 'cat-category-name', category.name))
      row.appendChild(nameCell)

      const descriptionCell = element('td', 'cat-table-cell')
      descriptionCell.appendChild(element(
        'span', 'cat-category-description', category.description || '—'
      ))
      row.appendChild(descriptionCell)

      const countCell = document.createElement('td')
      countCell.appendChild(element(
        'span', 'cat-product-count', Number(category.productCount || 0)
      ))
      row.appendChild(countCell)

      const statusCell = document.createElement('td')
      statusCell.appendChild(element(
        'span',
        category.active ? 'sup-status active' : 'sup-status inactive',
        category.active ? 'Activa' : 'Inactiva'
      ))
      row.appendChild(statusCell)

      const actionsCell = document.createElement('td')
      const actions = element('div', 'sup-actions')

      const editButton = element('button', 'sup-action-btn', 'Editar')
      editButton.type = 'button'
      editButton.setAttribute('aria-label', `Editar categoría ${category.name}`)
      editButton.addEventListener('click', () => openModal(category))
      actions.appendChild(editButton)

      const toggleButton = element(
        'button',
        category.active ? 'sup-action-btn danger' : 'sup-action-btn success',
        category.active ? 'Desactivar' : 'Activar'
      )
      toggleButton.type = 'button'
      toggleButton.setAttribute('aria-label',
        `${category.active ? 'Desactivar' : 'Activar'} categoría ${category.name}`
      )
      toggleButton.addEventListener('click', () => toggleCategory(category))
      actions.appendChild(toggleButton)

      actionsCell.appendChild(actions)
      row.appendChild(actionsCell)
      tbody.appendChild(row)
    }
  }

  function formData() {
    return {
      name: $('categoryName').value.trim().replace(/\s+/g, ' '),
      description: $('categoryDescription').value,
      active: $('categoryActive').value === 'true',
    }
  }

  function validate(data) {
    const errors = {}
    if (data.name.length < 2 || data.name.length > 100 ||
        !NAME_REGEX.test(data.name)) {
      errors.name = 'Ingresa un nombre de 2 a 100 caracteres, sin símbolos especiales.'
    }
    if (typeof data.description !== 'string') {
      errors.description = 'La descripción debe ser un texto.'
    }
    return errors
  }

  function clearError(field) {
    const inputId = field === 'name' ? 'categoryName' : 'categoryDescription'
    $(inputId).classList.remove('sup-invalid')
    $(inputId).removeAttribute('aria-invalid')
    const label = document.querySelector(`[data-error-for="${field}"]`)
    if (label) label.textContent = ''
  }

  function clearErrors() {
    clearError('name')
    clearError('description')
    $('categoryFormError').textContent = ''
    $('categoryFormError').classList.add('sup-hidden')
  }

  function showErrors(errors) {
    clearErrors()
    const entries = Object.entries(errors || {})
    if (!entries.length) return

    for (const [field, message] of entries) {
      const id = field === 'name' ? 'categoryName' :
        field === 'description' ? 'categoryDescription' : null
      if (!id) continue
      $(id).classList.add('sup-invalid')
      $(id).setAttribute('aria-invalid', 'true')
      const node = document.querySelector(`[data-error-for="${field}"]`)
      if (node) node.textContent = String(message)
    }
    $('categoryFormError').textContent = 'Corrige los campos indicados.'
    $('categoryFormError').classList.remove('sup-hidden')
    const first = entries.find(([field]) => field === 'name' || field === 'description')
    if (first) $(first[0] === 'name' ? 'categoryName' : 'categoryDescription').focus()
  }

  function openModal(category = null) {
    if (saving) return
    previousFocus = document.activeElement
    editingId = category ? category.id : null
    $('categoryForm').reset()
    clearErrors()
    $('categoryModalTitle').textContent = category ? 'Editar categoría' : 'Nueva categoría'
    $('saveCategory').textContent = category ? 'Guardar cambios' : 'Guardar categoría'
    $('categoryName').value = category?.name || ''
    $('categoryDescription').value = category?.description || ''
    $('categoryActive').value = category ? String(category.active) : 'true'
    $('categoryModal').classList.remove('sup-hidden')
    $('categoryName').focus()
  }

  function closeModal() {
    if (saving) return
    $('categoryModal').classList.add('sup-hidden')
    editingId = null
    clearErrors()
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus()
  }

  async function saveCategory(event) {
    event.preventDefault()
    if (saving) return
    const data = formData()
    const errors = validate(data)
    if (Object.keys(errors).length) {
      showErrors(errors)
      return
    }
    clearErrors()
    saving = true
    const button = $('saveCategory')
    const originalText = button.textContent
    button.disabled = true
    button.textContent = 'Guardando...'
    $('cancelCategory').disabled = true
    $('closeCategoryModal').disabled = true

    try {
      const editing = editingId !== null
      const response = await api(editing ? `/${editingId}` : '', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      $('categoryModal').classList.add('sup-hidden')
      editingId = null
      toast(response.message || 'Categoría guardada correctamente.')
      await loadCategories()
    } catch (error) {
      if (error.details && Object.keys(error.details).length) {
        showErrors(error.details)
      } else {
        $('categoryFormError').textContent = error.message
        $('categoryFormError').classList.remove('sup-hidden')
      }
      toast(error.message)
    } finally {
      saving = false
      button.disabled = false
      button.textContent = originalText
      $('cancelCategory').disabled = false
      $('closeCategoryModal').disabled = false
    }
  }

  async function toggleCategory(category) {
    if (saving) return
    const action = category.active ? 'desactivar' : 'activar'
    const note = category.active && Number(category.productCount) > 0
      ? '\nLos productos existentes conservarán esta categoría.'
      : ''
    if (!window.confirm(`¿Deseas ${action} "${category.name}"?${note}`)) return

    try {
      if (category.active) {
        await api(`/${category.id}`, { method: 'DELETE' })
      } else {
        await api(`/${category.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: category.name,
            description: category.description || '',
            active: true,
          }),
        })
      }
      toast(category.active ? 'Categoría desactivada.' : 'Categoría activada.')
      await loadCategories()
    } catch (error) {
      toast(error.message)
    }
  }

  function initialize() {
    loadCategories()

    $('newCategory').addEventListener('click', () => openModal())
    $('refreshCategories').addEventListener('click', loadCategories)
    $('searchCategory').addEventListener('input', renderCategories)
    $('filterCategoryStatus').addEventListener('change', renderCategories)

    $('categoryName').addEventListener('input', () => clearError('name'))
    $('categoryDescription').addEventListener('input', () => clearError('description'))
    $('categoryName').addEventListener('blur', () => {
      const errors = validate(formData())
      if (errors.name) showErrors({ name: errors.name })
    })

    $('categoryForm').addEventListener('submit', saveCategory)
    $('cancelCategory').addEventListener('click', closeModal)
    $('closeCategoryModal').addEventListener('click', closeModal)
    $('categoryModal').addEventListener('click', (event) => {
      if (event.target === $('categoryModal')) closeModal()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('categoryModal').classList.contains('sup-hidden')) {
        closeModal()
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize)
  } else {
    initialize()
  }
})()
