
'use strict'

// =========================================
// EZCUDO360 - CLIENTES
// =========================================

const CUSTOMERS_API = '/api/v1/customers'

const $ = (id) => document.getElementById(id)

const customerState = {
  rows: [],
  page: 1,
  perPage: 10,
  total: 0,
  totalPages: 1,
  editingId: null,
  saving: false,
  changingStatus: false,
  requestId: 0,
}

let customerSearchTimer
let customerToastTimer

// =========================================
// UTILIDADES
// =========================================

function safeText(value) {
  const chars = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => chars[char]
  )
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function toastCustomer(message) {
  const element = $('customersToast')

  element.textContent = String(message)
  element.classList.remove('cus-hidden')

  clearTimeout(customerToastTimer)

  customerToastTimer = setTimeout(() => {
    element.classList.add('cus-hidden')
  }, 4000)
}

function formError(message) {
  const element = $('customerFormError')

  element.textContent = message
  element.classList.toggle(
    'cus-hidden',
    !message
  )
}

function getCustomerToken() {
  try {
    return localStorage.getItem('erp_token')
  } catch {
    return null
  }
}

// =========================================
// API
// =========================================

async function customersRequest(url, options = {}) {
  const token = getCustomerToken()

  if (!token) {
    throw new Error(
      'No hay sesión activa. Inicia sesión nuevamente.'
    )
  }

  const response = await fetch(url, {
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
        'La sesión ha vencido. Inicia sesión nuevamente.'
      )
    }

    throw new Error(
      result.message ||
      `Error HTTP ${response.status}`
    )
  }

  return result
}

// =========================================
// ESTADÍSTICAS
// =========================================

function renderCustomerStats(stats) {
  $('statTotal').textContent =
    Number(stats.total || 0).toLocaleString('es-PE')

  $('statActive').textContent =
    Number(stats.active || 0).toLocaleString('es-PE')

  $('statInactive').textContent =
    Number(stats.inactive || 0).toLocaleString('es-PE')

  $('statCompanies').textContent =
    Number(stats.companies || 0).toLocaleString('es-PE')
}

// =========================================
// TABLA
// =========================================

function renderCustomers() {
  const tbody = $('customersTable')

  if (!customerState.rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="cus-empty">
          No se encontraron clientes.
        </td>
      </tr>
    `
    return
  }

  tbody.innerHTML = customerState.rows.map(
    (customer) => {
      const letter = String(
        customer.name || 'C'
      ).charAt(0).toUpperCase()

      const active = customer.active === true

      return `
        <tr>
          <td>
            <div class="cus-client-cell">
              <div class="cus-avatar">
                ${safeText(letter)}
              </div>

              <div>
                <strong>
                  ${safeText(customer.name)}
                </strong>

                <small>
                  Registrado:
                  ${formatDate(customer.createdAt)}
                </small>
              </div>
            </div>
          </td>

          <td>
            <strong>
              ${safeText(customer.documentType)}
            </strong>

            <small>
              ${safeText(customer.documentNumber)}
            </small>
          </td>

          <td>
            <strong>
              ${safeText(customer.phone || 'Sin teléfono')}
            </strong>

            <small>
              ${safeText(customer.email || 'Sin correo')}
            </small>
          </td>

          <td>
            ${safeText(customer.address || 'Sin dirección')}
          </td>

          <td>
            <span class="cus-status ${
              active
                ? 'cus-status-active'
                : 'cus-status-inactive'
            }">
              ${active ? 'Activo' : 'Inactivo'}
            </span>
          </td>

          <td>
            <div class="cus-actions">
              <button
                type="button"
                class="cus-btn cus-btn-small cus-btn-outline"
                data-action="edit"
                data-id="${safeText(customer.id)}"
              >
                Editar
              </button>

              <button
                type="button"
                class="cus-btn cus-btn-small ${
                  active
                    ? 'cus-btn-danger'
                    : 'cus-btn-success'
                }"
                data-action="status"
                data-id="${safeText(customer.id)}"
              >
                ${active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </td>
        </tr>
      `
    }
  ).join('')
}

// =========================================
// PAGINACIÓN
// =========================================

function renderCustomerPagination() {
  const page = customerState.page
  const total = customerState.total
  const perPage = customerState.perPage

  const first =
    total === 0
      ? 0
      : (page - 1) * perPage + 1

  const last = Math.min(
    page * perPage,
    total
  )

  $('customersPageInfo').textContent =
    `Mostrando ${first}-${last} de ${total} clientes`

  $('previousCustomers').disabled =
    page <= 1

  $('nextCustomers').disabled =
    page >= customerState.totalPages
}

// =========================================
// CARGAR CLIENTES
// =========================================

async function loadCustomers() {
  const requestId = ++customerState.requestId

  const params = new URLSearchParams({
    page: String(customerState.page),
    search: $('searchCustomers').value.trim(),
    status: $('statusFilter').value,
  })

  $('customersTable').innerHTML = `
    <tr>
      <td colspan="6" class="cus-empty">
        Cargando clientes...
      </td>
    </tr>
  `

  try {
    const result = await customersRequest(
      `${CUSTOMERS_API}?${params.toString()}`
    )

    if (requestId !== customerState.requestId) {
      return
    }

    if (!Array.isArray(result.data)) {
      throw new Error(
        'El servidor no devolvió una lista válida.'
      )
    }

    customerState.rows = result.data
    customerState.page =
      Number(result.pagination.page)

    customerState.perPage =
      Number(result.pagination.perPage)

    customerState.total =
      Number(result.pagination.total)

    customerState.totalPages =
      Number(result.pagination.totalPages)

    renderCustomers()
    renderCustomerPagination()

    if (result.stats) {
      renderCustomerStats(result.stats)
    }
  } catch (error) {
    if (requestId !== customerState.requestId) {
      return
    }

    $('customersTable').innerHTML = `
      <tr>
        <td colspan="6" class="cus-empty">
          ${safeText(error.message)}
        </td>
      </tr>
    `

    toastCustomer(error.message)
  }
}

// =========================================
// CONFIGURAR DOCUMENTO
// =========================================

function configureDocument() {
  const type = $('customerDocumentType').value
  const input = $('customerDocumentNumber')

  if (type === 'RUC') {
    input.maxLength = 11
    input.placeholder = '11 dígitos del RUC'
  } else {
    input.maxLength = 8
    input.placeholder = '8 dígitos del DNI'
  }

  input.value = input.value
    .replace(/\D/g, '')
    .slice(0, input.maxLength)
}

// =========================================
// ABRIR FORMULARIO
// =========================================

function openCustomerModal(customer = null) {
  customerState.editingId = customer
    ? Number(customer.id)
    : null

  $('customerForm').reset()
  formError('')

  if (customer) {
    $('customerModalTitle').textContent =
      'Editar cliente'

    $('customerModalSubtitle').textContent =
      'Actualiza los datos del cliente seleccionado.'

    $('saveCustomer').textContent =
      'Guardar cambios'

    $('customerDocumentType').value =
      customer.documentType

    $('customerDocumentNumber').value =
      customer.documentNumber

    $('customerName').value =
      customer.name || ''

    $('customerPhone').value =
      customer.phone || ''

    $('customerEmail').value =
      customer.email || ''

    $('customerAddress').value =
      customer.address || ''
  } else {
    $('customerModalTitle').textContent =
      'Nuevo cliente'

    $('customerModalSubtitle').textContent =
      'Completa los datos para registrar un cliente.'

    $('saveCustomer').textContent =
      'Registrar cliente'
  }

  configureDocument()

  $('customerModal').classList.remove(
    'cus-hidden'
  )

  document.body.style.overflow = 'hidden'

  $('customerName').focus()
}

// =========================================
// CERRAR FORMULARIO
// =========================================

function closeCustomerModal() {
  if (customerState.saving) return

  $('customerModal').classList.add(
    'cus-hidden'
  )

  document.body.style.overflow = ''

  customerState.editingId = null
  formError('')
}

// =========================================
// VALIDAR FORMULARIO
// =========================================

function collectCustomerData() {
  const documentType =
    $('customerDocumentType').value

  const documentNumber =
    $('customerDocumentNumber').value.trim()

  const name =
    $('customerName').value.trim()

  const phone =
    $('customerPhone').value.trim()

  const email =
    $('customerEmail').value.trim()

  const address =
    $('customerAddress').value.trim()

  if (documentType === 'DNI') {
    if (!/^\d{8}$/.test(documentNumber)) {
      throw new Error(
        'El DNI debe tener exactamente 8 números.'
      )
    }
  } else if (documentType === 'RUC') {
    if (!/^\d{11}$/.test(documentNumber)) {
      throw new Error(
        'El RUC debe tener exactamente 11 números.'
      )
    }
  } else {
    throw new Error(
      'Selecciona un tipo de documento válido.'
    )
  }

  if (
    name.length < 2 ||
    name.length > 160
  ) {
    throw new Error(
      'Ingresa un nombre o razón social válido.'
    )
  }

  if (
    phone &&
    !/^\d{7,9}$/.test(phone)
  ) {
    throw new Error(
      'El teléfono debe tener entre 7 y 9 números.'
    )
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(
      'Ingresa un correo electrónico válido.'
    )
  }

  return {
    documentType,
    documentNumber,
    name,
    phone,
    email,
    address,
  }
}

// =========================================
// GUARDAR CLIENTE
// =========================================

async function saveCustomer(event) {
  event.preventDefault()

  if (customerState.saving) return

  formError('')

  let payload

  try {
    payload = collectCustomerData()
  } catch (error) {
    formError(error.message)
    return
  }

  customerState.saving = true
  $('saveCustomer').disabled = true

  const editingId = customerState.editingId

  try {
    const editing = editingId !== null

    const url = editing
      ? `${CUSTOMERS_API}/${editingId}`
      : CUSTOMERS_API

    const result = await customersRequest(
      url,
      {
        method: editing ? 'PUT' : 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(payload),
      }
    )

    toastCustomer(
      result.message || 'Cliente guardado.'
    )

    if (!editing) {
      customerState.page = 1
    }

    // Se permite cerrar tras finalizar la solicitud.
    customerState.saving = false
    closeCustomerModal()

    await loadCustomers()
  } catch (error) {
    formError(error.message)
  } finally {
    customerState.saving = false
    $('saveCustomer').disabled = false
  }
}

// =========================================
// ACTIVAR / DESACTIVAR
// =========================================

async function toggleCustomerStatus(id) {
  if (customerState.changingStatus) return

  const customer = customerState.rows.find(
    (row) => Number(row.id) === Number(id)
  )

  if (!customer) {
    toastCustomer('No se encontró el cliente.')
    return
  }

  const nextActive = !customer.active

  const action = nextActive
    ? 'activar'
    : 'desactivar'

  if (!window.confirm(
    `¿Deseas ${action} a ${customer.name}?`
  )) {
    return
  }

  customerState.changingStatus = true

  try {
    const result = await customersRequest(
      `${CUSTOMERS_API}/${id}/status`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          active: nextActive,
        }),
      }
    )

    toastCustomer(result.message)
    await loadCustomers()
  } catch (error) {
    toastCustomer(error.message)
  } finally {
    customerState.changingStatus = false
  }
}

// =========================================
// EVENTOS
// =========================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    // Nuevo cliente
    $('newCustomer').addEventListener(
      'click',
      () => openCustomerModal()
    )

    // Actualizar
    $('refreshCustomers').addEventListener(
      'click',
      loadCustomers
    )

    // Búsqueda
    $('searchCustomers').addEventListener(
      'input',
      () => {
        clearTimeout(customerSearchTimer)

        customerSearchTimer = setTimeout(() => {
          customerState.page = 1
          loadCustomers()
        }, 300)
      }
    )

    // Estado
    $('statusFilter').addEventListener(
      'change',
      () => {
        customerState.page = 1
        loadCustomers()
      }
    )

    // Anterior
    $('previousCustomers').addEventListener(
      'click',
      () => {
        if (customerState.page <= 1) return

        customerState.page--
        loadCustomers()
      }
    )

    // Siguiente
    $('nextCustomers').addEventListener(
      'click',
      () => {
        if (
          customerState.page >=
          customerState.totalPages
        ) {
          return
        }

        customerState.page++
        loadCustomers()
      }
    )

    // Editar o cambiar estado
    $('customersTable').addEventListener(
      'click',
      (event) => {
        const button = event.target.closest(
          '[data-action]'
        )

        if (!button) return

        const id = Number(button.dataset.id)

        if (!Number.isSafeInteger(id) || id < 1) {
          return
        }

        if (button.dataset.action === 'edit') {
          const customer = customerState.rows.find(
            (row) => Number(row.id) === id
          )

          if (customer) {
            openCustomerModal(customer)
          }
        }

        if (button.dataset.action === 'status') {
          toggleCustomerStatus(id)
        }
      }
    )

    // Documento
    $('customerDocumentType').addEventListener(
      'change',
      () => {
        $('customerDocumentNumber').value = ''
        configureDocument()
      }
    )

    $('customerDocumentNumber').addEventListener(
      'input',
      configureDocument
    )

    // Solo dígitos en teléfono
    $('customerPhone').addEventListener(
      'input',
      () => {
        $('customerPhone').value =
          $('customerPhone').value
            .replace(/\D/g, '')
            .slice(0, 9)
      }
    )

    // Guardar
    $('customerForm').addEventListener(
      'submit',
      saveCustomer
    )

    // Cerrar
    $('closeCustomerModal').addEventListener(
      'click',
      closeCustomerModal
    )

    $('cancelCustomer').addEventListener(
      'click',
      closeCustomerModal
    )

    // Escape
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          closeCustomerModal()
        }
      }
    )

    // Iniciar módulo
    loadCustomers()
  }
)
