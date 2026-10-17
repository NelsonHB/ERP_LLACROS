'use strict'

// ============================================
// EZCUDO360 - PROVEEDORES (FRONTEND)
// Mantiene el HTML/CSS del diseño original.
// ============================================

;(function () {
  const API = '/api/v1/suppliers'
  const $ = (id) => document.getElementById(id)

  const BUSINESS_REGEX = /^[\p{L}\p{M}\p{N} .,&()'°º\/-]+$/u
  const CONTACT_REGEX = /^[\p{L}\p{M} .'-]+$/u
  const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

  const fields = {
    businessName: 'supplierBusinessName',
    tradeName: 'supplierTradeName',
    documentType: 'supplierDocumentType',
    documentNumber: 'supplierDocumentNumber',
    contactName: 'supplierContactName',
    phone: 'supplierPhone',
    email: 'supplierEmail',
  }

  let suppliers = []
  let editingId = null
  let saving = false
  let loading = false
  let toastTimer = null

  function element(tag, className = '', value) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (value !== undefined) node.textContent = String(value)
    return node
  }

  function normalize(value) {
    return String(value ?? '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  function toast(message) {
    $('supplierToast').textContent = message
    $('supplierToast').classList.remove('sup-hidden')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => $('supplierToast').classList.add('sup-hidden'), 3500)
  }

  async function api(path = '', options = {}) {
    const token = localStorage.getItem('erp_token')
    if (!token) throw new Error('No hay sesión activa. Inicia sesión otra vez.')

    const response = await fetch(API + path, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success === false) {
      const error = new Error(result.message || `Error HTTP ${response.status}`)
      error.details = result.errors || {}
      throw error
    }
    return result
  }

  function rowMessage(message) {
    const tr = document.createElement('tr')
    const td = element('td', 'sup-empty', message)
    td.colSpan = 7
    tr.appendChild(td)
    return tr
  }

  async function loadSuppliers() {
    if (loading) return
    loading = true
    $('refreshSuppliers').disabled = true
    $('suppliersTable').replaceChildren(rowMessage('Cargando proveedores...'))

    try {
      const result = await api()
      suppliers = Array.isArray(result.data) ? result.data : []
      updateStats()
      renderSuppliers()
    } catch (error) {
      suppliers = []
      updateStats()
      $('suppliersTable').replaceChildren(rowMessage(error.message))
      $('supplierCount').textContent = 'Mostrando 0 proveedores'
      toast(error.message)
    } finally {
      loading = false
      $('refreshSuppliers').disabled = false
    }
  }

  function updateStats() {
    const active = suppliers.filter((supplier) => supplier.active === true).length
    $('totalSuppliers').textContent = String(suppliers.length)
    $('activeSuppliers').textContent = String(active)
    $('inactiveSuppliers').textContent = String(suppliers.length - active)
  }

  function cell(tr, value) {
    const td = element('td', '', value ?? '—')
    tr.appendChild(td)
    return td
  }

  function renderSuppliers() {
    const query = normalize($('searchSupplier').value)
    const status = $('filterStatus').value

    const visible = suppliers.filter((supplier) => {
      const content = normalize([
        supplier.businessName, supplier.tradeName, supplier.documentType,
        supplier.documentNumber, supplier.contactName, supplier.phone,
        supplier.email, supplier.address,
      ].join(' '))
      return (!query || content.includes(query)) &&
        (status === 'all' ||
          (status === 'active' && supplier.active === true) ||
          (status === 'inactive' && supplier.active === false))
    })

    const tbody = $('suppliersTable')
    tbody.replaceChildren()
    $('supplierCount').textContent = `Mostrando ${visible.length} de ${suppliers.length} proveedores`

    if (!visible.length) {
      tbody.appendChild(rowMessage('No se encontraron proveedores.'))
      return
    }

    for (const supplier of visible) {
      const tr = document.createElement('tr')

      // PROVEEDOR
      const providerCell = element('td')
      const provider = element('div', 'sup-provider-name')
      provider.appendChild(element('strong', '', supplier.businessName || 'Sin nombre'))
      if (supplier.tradeName) provider.appendChild(element('small', '', supplier.tradeName))
      providerCell.appendChild(provider)
      tr.appendChild(providerCell)

      // DOCUMENTO
      const documentCell = element('td')
      const documentBox = element('div', 'sup-document')
      documentBox.appendChild(element('strong', '', supplier.documentNumber || '—'))
      documentBox.appendChild(element('small', '', supplier.documentType || '—'))
      documentCell.appendChild(documentBox)
      tr.appendChild(documentCell)

      cell(tr, supplier.contactName)
      cell(tr, supplier.phone)
      cell(tr, supplier.email)

      // ESTADO
      const statusCell = element('td')
      statusCell.appendChild(element(
        'span',
        `sup-status ${supplier.active ? 'active' : 'inactive'}`,
        supplier.active ? 'Activo' : 'Inactivo'
      ))
      tr.appendChild(statusCell)

      // ACCIONES
      const actionsCell = element('td')
      const actions = element('div', 'sup-actions')
      const edit = element('button', 'sup-action-btn', 'Editar')
      edit.type = 'button'
      edit.addEventListener('click', () => openModal(supplier))
      actions.appendChild(edit)

      const toggle = element('button',
        `sup-action-btn ${supplier.active ? 'danger' : 'success'}`,
        supplier.active ? 'Desactivar' : 'Activar')
      toggle.type = 'button'
      toggle.addEventListener('click', () => toggleSupplier(supplier))
      actions.appendChild(toggle)

      actionsCell.appendChild(actions)
      tr.appendChild(actionsCell)
      tbody.appendChild(tr)
    }
  }

  function numbersOnly(input, length) {
    input.value = input.value.replace(/\D/g, '').slice(0, length)
  }

  function configureDocument() {
    const type = $('supplierDocumentType').value
    const length = type === 'DNI' ? 8 : 11
    const input = $('supplierDocumentNumber')
    input.maxLength = length
    input.placeholder = `${length} dígitos`
    $('documentHelp').textContent = `El ${type} debe tener exactamente ${length} números.`
    numbersOnly(input, length)
    clearError('documentNumber')
  }

  function readForm() {
    return {
      businessName: $('supplierBusinessName').value.trim(),
      tradeName: $('supplierTradeName').value.trim(),
      documentType: $('supplierDocumentType').value,
      documentNumber: $('supplierDocumentNumber').value.trim(),
      contactName: $('supplierContactName').value.trim(),
      phone: $('supplierPhone').value.trim(),
      email: $('supplierEmail').value.trim().toLowerCase(),
      address: $('supplierAddress').value,
      notes: $('supplierNotes').value,
      active: $('supplierActive').value === 'true',
    }
  }

  function validate(data) {
    const errors = {}

    if (data.businessName.length < 2 || data.businessName.length > 150 ||
        !BUSINESS_REGEX.test(data.businessName)) {
      errors.businessName = 'La razón social o nombre debe tener de 2 a 150 caracteres, sin símbolos especiales.'
    }
    if (data.tradeName && (data.tradeName.length > 150 || !BUSINESS_REGEX.test(data.tradeName))) {
      errors.tradeName = 'El nombre comercial tiene símbolos no permitidos o supera 150 caracteres.'
    }
    if (!['RUC', 'DNI'].includes(data.documentType)) {
      errors.documentType = 'Selecciona RUC o DNI.'
    } else if (data.documentType === 'RUC' && !/^\d{11}$/.test(data.documentNumber)) {
      errors.documentNumber = 'El RUC debe tener exactamente 11 números.'
    } else if (data.documentType === 'DNI' && !/^\d{8}$/.test(data.documentNumber)) {
      errors.documentNumber = 'El DNI debe tener exactamente 8 números.'
    }
    if (data.contactName && (data.contactName.length > 120 || !CONTACT_REGEX.test(data.contactName))) {
      errors.contactName = 'El contacto solo permite letras y puntuación básica.'
    }
    if (data.phone && !/^\d{1,9}$/.test(data.phone)) {
      errors.phone = 'El teléfono admite únicamente números y como máximo 9 dígitos.'
    }
    if (data.email && (data.email.length > 150 || !EMAIL_REGEX.test(data.email))) {
      errors.email = 'Ingresa un correo válido. Ejemplo: ventas@empresa.com.'
    }
    return errors
  }

  function clearError(name) {
    const id = fields[name]
    if (id) {
      $(id).classList.remove('sup-invalid')
      $(id).removeAttribute('aria-invalid')
    }
    const message = document.querySelector(`[data-error-for="${name}"]`)
    if (message) message.textContent = ''
  }

  function clearErrors() {
    Object.keys(fields).forEach(clearError)
    $('supplierFormError').textContent = ''
    $('supplierFormError').classList.add('sup-hidden')
  }

  function showErrors(errors) {
    clearErrors()
    const entries = Object.entries(errors)
    if (!entries.length) return
    for (const [name, message] of entries) {
      const id = fields[name]
      if (id) {
        $(id).classList.add('sup-invalid')
        $(id).setAttribute('aria-invalid', 'true')
      }
      const target = document.querySelector(`[data-error-for="${name}"]`)
      if (target) target.textContent = String(message)
    }
    $('supplierFormError').textContent = 'Corrige los campos señalados antes de guardar.'
    $('supplierFormError').classList.remove('sup-hidden')
    const first = entries.find(([name]) => fields[name])
    if (first) $(fields[first[0]]).focus()
  }

  function validateField(name) {
    clearError(name)
    const errors = validate(readForm())
    if (!errors[name]) return
    const id = fields[name]
    if (id) {
      $(id).classList.add('sup-invalid')
      $(id).setAttribute('aria-invalid', 'true')
    }
    const target = document.querySelector(`[data-error-for="${name}"]`)
    if (target) target.textContent = errors[name]
  }

  function openModal(supplier = null) {
    if (saving) return
    editingId = supplier ? supplier.id : null
    $('supplierForm').reset()
    clearErrors()
    $('supplierModalTitle').textContent = supplier ? 'Editar proveedor' : 'Nuevo proveedor'
    $('saveSupplier').textContent = supplier ? 'Guardar cambios' : 'Guardar proveedor'

    if (supplier) {
      $('supplierBusinessName').value = supplier.businessName || ''
      $('supplierTradeName').value = supplier.tradeName || ''
      $('supplierDocumentType').value = supplier.documentType || 'RUC'
      $('supplierDocumentNumber').value = supplier.documentNumber || ''
      $('supplierContactName').value = supplier.contactName || ''
      $('supplierPhone').value = supplier.phone || ''
      $('supplierEmail').value = supplier.email || ''
      $('supplierAddress').value = supplier.address || ''
      $('supplierNotes').value = supplier.notes || ''
      $('supplierActive').value = String(supplier.active)
    } else {
      $('supplierDocumentType').value = 'RUC'
      $('supplierActive').value = 'true'
    }

    configureDocument()
    $('supplierModal').classList.remove('sup-hidden')
    $('supplierBusinessName').focus()
  }

  function closeModal() {
    if (saving) return
    $('supplierModal').classList.add('sup-hidden')
    editingId = null
    clearErrors()
  }

  async function saveSupplier(event) {
    event.preventDefault()
    if (saving) return

    const data = readForm()
    const errors = validate(data)
    if (Object.keys(errors).length) return showErrors(errors)
    clearErrors()

    saving = true
    const button = $('saveSupplier')
    const editing = editingId !== null
    const path = editing ? `/${editingId}` : ''
    const originalLabel = button.textContent
    button.disabled = true
    $('cancelSupplier').disabled = true
    $('closeSupplierModal').disabled = true
    button.textContent = 'Guardando...'

    try {
      const result = await api(path, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      $('supplierModal').classList.add('sup-hidden')
      editingId = null
      toast(result.message || 'Proveedor guardado correctamente.')
      await loadSuppliers()
    } catch (error) {
      if (error.details && Object.keys(error.details).length) {
        showErrors(error.details)
      } else {
        $('supplierFormError').textContent = error.message
        $('supplierFormError').classList.remove('sup-hidden')
      }
      toast(error.message)
    } finally {
      saving = false
      button.disabled = false
      $('cancelSupplier').disabled = false
      $('closeSupplierModal').disabled = false
      button.textContent = originalLabel
    }
  }

  async function toggleSupplier(supplier) {
    const action = supplier.active ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Deseas ${action} a "${supplier.businessName}"?`)) return

    try {
      if (supplier.active) {
        await api(`/${supplier.id}`, { method: 'DELETE' })
      } else {
        await api(`/${supplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: supplier.businessName,
            tradeName: supplier.tradeName || '',
            documentType: supplier.documentType,
            documentNumber: supplier.documentNumber,
            contactName: supplier.contactName || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            notes: supplier.notes || '',
            active: true,
          }),
        })
      }
      toast(supplier.active ? 'Proveedor desactivado.' : 'Proveedor activado.')
      await loadSuppliers()
    } catch (error) {
      toast(error.message)
    }
  }

  function initialize() {
    loadSuppliers()
    $('newSupplier').addEventListener('click', () => openModal())
    $('refreshSuppliers').addEventListener('click', loadSuppliers)
    $('searchSupplier').addEventListener('input', renderSuppliers)
    $('filterStatus').addEventListener('change', renderSuppliers)
    $('supplierDocumentType').addEventListener('change', () => {
      configureDocument()
      validateField('documentNumber')
    })
    $('supplierDocumentNumber').addEventListener('input', () => {
      const max = $('supplierDocumentType').value === 'DNI' ? 8 : 11
      numbersOnly($('supplierDocumentNumber'), max)
      clearError('documentNumber')
    })
    $('supplierPhone').addEventListener('input', () => {
      numbersOnly($('supplierPhone'), 9)
      clearError('phone')
    })
    for (const [name, id] of Object.entries(fields)) {
      $(id).addEventListener('blur', () => validateField(name))
      if (!['documentType', 'documentNumber', 'phone'].includes(name)) {
        $(id).addEventListener('input', () => clearError(name))
      }
    }
    $('supplierForm').addEventListener('submit', saveSupplier)
    $('cancelSupplier').addEventListener('click', closeModal)
    $('closeSupplierModal').addEventListener('click', closeModal)
    $('supplierModal').addEventListener('click', (event) => {
      if (event.target === $('supplierModal')) closeModal()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('supplierModal').classList.contains('sup-hidden')) {
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
