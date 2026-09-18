const API_URL = '/api/v1/erp-users'

const tabla = document.getElementById('usuariosTabla')
const buscarInput = document.getElementById('buscarUsuario')
const modal = document.getElementById('modalUsuario')
const modalTitulo = document.getElementById('modalTitulo')
const form = document.getElementById('formUsuario')
const mensajeFormulario = document.getElementById('mensajeFormulario')

const usuarioId = document.getElementById('usuarioId')
const fullName = document.getElementById('fullName')
const email = document.getElementById('email')
const password = document.getElementById('password')
const accountType = document.getElementById('accountType')
const durationDays = document.getElementById('durationDays')

const btnNuevoUsuario = document.getElementById('btnNuevoUsuario')
const btnCerrarModal = document.getElementById('btnCerrarModal')
const btnCancelar = document.getElementById('btnCancelar')
const btnGuardarUsuario = document.getElementById('btnGuardarUsuario')

let usuarios = []

// ============================================================
// AUTENTICACIÓN
// ============================================================

// El login (public/index.html) guarda el token bajo la clave
// "master_admin_token" en localStorage. Antes esta función buscaba
// otras claves ("accessToken", "token", "authToken") que nunca se
// guardan en ningún lado, así que nunca se mandaba el header
// Authorization y todas las peticiones a /api/v1/erp-users
// devolvían 401 (rutas protegidas con middleware.auth()).
function obtenerToken() {
  return localStorage.getItem('master_admin_token')
}

function obtenerHeaders(incluirJson = false) {
  const headers = {}
  const token = obtenerToken()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (incluirJson) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

// ============================================================
// CARGAR USUARIOS
// ============================================================

async function cargarUsuarios() {
  try {
    tabla.innerHTML = `
      <tr>
        <td colspan="8">Cargando usuarios...</td>
      </tr>
    `

    const response = await fetch(API_URL, {
      method: 'GET',
      headers: obtenerHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesión no válida. Inicia sesión nuevamente.')
      }

      throw new Error('No se pudieron obtener los usuarios.')
    }

    const data = await response.json()

    usuarios = Array.isArray(data) ? data : data.data ?? data.users ?? []

    mostrarUsuarios(usuarios)
  } catch (error) {
    console.error('Error al cargar usuarios:', error)

    tabla.innerHTML = `
      <tr>
        <td colspan="8">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `
  }
}

// ============================================================
// MOSTRAR USUARIOS
// ============================================================

function mostrarUsuarios(lista) {
  if (!lista.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="8">
          No hay usuarios registrados.
        </td>
      </tr>
    `

    return
  }

  tabla.innerHTML = lista
    .map((usuario) => {
      const fechaCreacion = usuario.createdAt ?? usuario.created_at

      const fechaExpiracion = usuario.expiresAt ?? usuario.expires_at

      const id = usuario.id

      const nombre = usuario.fullName ?? usuario.full_name ?? '-'

      const correo = usuario.email ?? '-'

      const tipoCuenta = usuario.accountType ?? usuario.account_type ?? 'trial'

      const esExpirada = usuario.isExpired === true || usuario.is_expired === true

      const tipoCuentaTexto = tipoCuenta === 'rental' ? 'Alquiler' : 'Prueba'

      const estadoTexto = esExpirada ? 'Expirada' : 'Activa'

      return `
        <tr>
          <td>${escapeHtml(id)}</td>

          <td>
            ${escapeHtml(nombre)}
          </td>

          <td>
            ${escapeHtml(correo)}
          </td>

          <td>
            ${escapeHtml(tipoCuentaTexto)}
          </td>

          <td>
            ${formatearFecha(fechaExpiracion)}
          </td>

          <td>
            <span class="estado ${esExpirada ? 'estado-expirado' : 'estado-activo'}">
              ${estadoTexto}
            </span>
          </td>

          <td>
            ${formatearFecha(fechaCreacion)}
          </td>

          <td>
            <button
              type="button"
              class="btn-editar"
              data-id="${escapeHtml(id)}"
            >
              Editar
            </button>

            <button
              type="button"
              class="btn-reset-password"
              data-id="${escapeHtml(id)}"
            >
              Cambiar contraseña
            </button>

            <button
              type="button"
              class="btn-eliminar"
              data-id="${escapeHtml(id)}"
            >
              Eliminar
            </button>
          </td>
        </tr>
      `
    })
    .join('')

  // ==========================================================
  // EVENTOS DE LOS BOTONES
  // ==========================================================

  document.querySelectorAll('.btn-editar').forEach((button) => {
    button.addEventListener('click', () => {
      editarUsuario(button.dataset.id)
    })
  })

  document.querySelectorAll('.btn-reset-password').forEach((button) => {
    button.addEventListener('click', () => {
      resetearPassword(button.dataset.id)
    })
  })

  document.querySelectorAll('.btn-eliminar').forEach((button) => {
    button.addEventListener('click', () => {
      eliminarUsuario(button.dataset.id)
    })
  })
}

// ============================================================
// BÚSQUEDA
// ============================================================

buscarInput.addEventListener('input', () => {
  const texto = buscarInput.value.trim().toLowerCase()

  const resultado = usuarios.filter((usuario) => {
    const nombre = (usuario.fullName ?? usuario.full_name ?? '').toLowerCase()

    const correo = (usuario.email ?? '').toLowerCase()

    return nombre.includes(texto) || correo.includes(texto)
  })

  mostrarUsuarios(resultado)
})

// ============================================================
// ABRIR MODAL PARA NUEVO USUARIO
// ============================================================

btnNuevoUsuario.addEventListener('click', abrirModalNuevo)

function abrirModalNuevo() {
  form.reset()

  usuarioId.value = ''

  modalTitulo.textContent = 'Nuevo usuario'

  password.required = true

  accountType.value = 'trial'
  durationDays.value = '30'

  ocultarMensaje()

  modal.hidden = false

  fullName.focus()
}

// ============================================================
// CERRAR MODAL
// ============================================================

btnCerrarModal.addEventListener('click', cerrarModal)

btnCancelar.addEventListener('click', cerrarModal)

function cerrarModal() {
  modal.hidden = true

  form.reset()

  usuarioId.value = ''

  ocultarMensaje()
}

// ============================================================
// EDITAR USUARIO
// ============================================================

async function editarUsuario(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'GET',
      headers: obtenerHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesión no válida. Inicia sesión nuevamente.')
      }

      if (response.status === 404) {
        throw new Error('Usuario no encontrado.')
      }

      throw new Error('No se pudo obtener el usuario.')
    }

    const data = await response.json()

    const usuario = data.data ?? data.user ?? data

    usuarioId.value = usuario.id

    fullName.value = usuario.fullName ?? usuario.full_name ?? ''

    email.value = usuario.email ?? ''

    password.value = ''

    password.required = false

    accountType.value = usuario.accountType ?? usuario.account_type ?? 'trial'

    /*
     * No convertimos expiresAt a durationDays.
     *
     * expiresAt es la fecha real almacenada en la base de datos.
     *
     * Si el administrador quiere renovar la cuenta, puede
     * introducir una nueva cantidad de días.
     *
     * Si lo deja vacío, expiresAt no cambia.
     */
    durationDays.value = ''

    modalTitulo.textContent = 'Editar usuario'

    ocultarMensaje()

    modal.hidden = false

    fullName.focus()
  } catch (error) {
    console.error('Error al obtener usuario:', error)

    alert(error.message)
  }
}

// ============================================================
// GUARDAR USUARIO
// ============================================================

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const id = usuarioId.value

  const datos = {
    fullName: fullName.value.trim(),
    email: email.value.trim(),
    accountType: accountType.value,
  }

  /*
   * durationDays es opcional al editar.
   *
   * Si tiene un valor: el backend actualizará expiresAt.
   * Si está vacío: el backend conservará expiresAt.
   */
  const duracionTexto = durationDays.value.trim()

  if (duracionTexto !== '') {
    const dias = Number(duracionTexto)

    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) {
      mostrarMensaje('La duración debe estar entre 1 y 3650 días.', 'error')

      return
    }

    datos.durationDays = dias
  }

  /*
   * La contraseña solamente se envía cuando se ha introducido una nueva.
   */
  if (password.value.trim() !== '') {
    datos.password = password.value
  }

  /*
   * Al crear un usuario la contraseña es obligatoria.
   */
  if (!id && password.value.trim() === '') {
    mostrarMensaje('La contraseña es obligatoria para crear un usuario.', 'error')

    return
  }

  try {
    btnGuardarUsuario.disabled = true

    btnGuardarUsuario.textContent = 'Guardando...'

    const response = await fetch(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? 'PUT' : 'POST',
      headers: obtenerHeaders(true),
      body: JSON.stringify(datos),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const mensaje =
        data?.message || data?.errors?.[0]?.message || 'No se pudo guardar el usuario.'

      throw new Error(mensaje)
    }

    mostrarMensaje(
      id ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.',
      'success'
    )

    await cargarUsuarios()

    setTimeout(() => {
      cerrarModal()
    }, 700)
  } catch (error) {
    console.error('Error al guardar usuario:', error)

    mostrarMensaje(error.message, 'error')
  } finally {
    btnGuardarUsuario.disabled = false

    btnGuardarUsuario.textContent = 'Guardar usuario'
  }
})

// ============================================================
// RESTABLECER CONTRASEÑA
// ============================================================

async function resetearPassword(id) {
  const usuario = usuarios.find((item) => String(item.id) === String(id))

  const nombre = usuario?.fullName ?? usuario?.full_name ?? usuario?.email ?? `ID ${id}`

  const nuevaPassword = prompt(`Ingresa la nueva contraseña para "${nombre}":`)

  if (nuevaPassword === null) {
    return
  }

  if (nuevaPassword.length < 8) {
    alert('La contraseña debe tener al menos 8 caracteres.')

    return
  }

  if (nuevaPassword.length > 32) {
    alert('La contraseña no puede superar los 32 caracteres.')

    return
  }

  try {
    const response = await fetch(`${API_URL}/${id}/reset-password`, {
      method: 'PATCH',
      headers: obtenerHeaders(true),
      body: JSON.stringify({
        password: nuevaPassword,
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesión no válida. Inicia sesión nuevamente.')
      }

      if (response.status === 404) {
        throw new Error('Usuario no encontrado.')
      }

      throw new Error(
        data?.message || data?.errors?.[0]?.message || 'No se pudo cambiar la contraseña.'
      )
    }

    alert('Contraseña actualizada correctamente.')
  } catch (error) {
    console.error('Error al cambiar contraseña:', error)

    alert(error.message)
  }
}

// ============================================================
// ELIMINAR USUARIO
// ============================================================

async function eliminarUsuario(id) {
  const usuario = usuarios.find((item) => String(item.id) === String(id))

  const nombre = usuario?.fullName ?? usuario?.full_name ?? usuario?.email ?? `ID ${id}`

  const confirmar = confirm(`¿Deseas eliminar al usuario "${nombre}"?`)

  if (!confirmar) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: obtenerHeaders(),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesión no válida. Inicia sesión nuevamente.')
      }

      if (response.status === 404) {
        throw new Error('Usuario no encontrado.')
      }

      throw new Error(data?.message || 'No se pudo eliminar el usuario.')
    }

    await cargarUsuarios()
  } catch (error) {
    console.error('Error al eliminar usuario:', error)

    alert(error.message)
  }
}

// ============================================================
// MENSAJES DEL FORMULARIO
// ============================================================

function mostrarMensaje(mensaje, tipo) {
  mensajeFormulario.hidden = false

  mensajeFormulario.textContent = mensaje

  mensajeFormulario.dataset.type = tipo
}

function ocultarMensaje() {
  mensajeFormulario.hidden = true

  mensajeFormulario.textContent = ''

  delete mensajeFormulario.dataset.type
}

// ============================================================
// UTILIDADES
// ============================================================

function formatearFecha(fecha) {
  if (!fecha) {
    return '-'
  }

  const resultado = new Date(fecha)

  if (Number.isNaN(resultado.getTime())) {
    return '-'
  }

  return resultado.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function escapeHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// ============================================================
// INICIO
// ============================================================

cargarUsuarios()