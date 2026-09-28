/* =========================================================
   SESIÓN
   ========================================================= */

const token =
  localStorage.getItem('erp_token')

const userRaw =
  localStorage.getItem('erp_user')


/* Si no hay token regresamos al login */

if (!token) {
  window.location.href = '/index.html'
}


/* =========================================================
   INFORMACIÓN DEL USUARIO
   ========================================================= */

if (userRaw) {

  try {

    const user =
      JSON.parse(userRaw)

    document
      .getElementById('user-name')
      .textContent =
        user.fullName || 'Usuario'

    document
      .getElementById('user-email')
      .textContent =
        user.email || ''

  } catch (error) {

    console.error(
      'No se pudo cargar el usuario.',
      error
    )

  }

}


/* =========================================================
   VALIDAR SESIÓN CON ADONIS
   ========================================================= */

fetch(
  window.location.origin +
  '/api/v1/account/profile',
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
)

  .then((response) => {

    if (response.status === 401) {

      localStorage.removeItem(
        'erp_token'
      )

      localStorage.removeItem(
        'erp_user'
      )

      window.location.href =
        '/index.html'

    }

  })

  .catch((error) => {

    console.error(
      'No se pudo verificar la sesión.',
      error
    )

  })


/* =========================================================
   NAVEGACIÓN
   ========================================================= */


/* DASHBOARD */

document
  .getElementById('dashboard-menu')
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/dashboard.html'

    }
  )


/* PUNTO DE VENTA */

document
  .getElementById('pos-menu')
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/pos.html'

    }
  )


/* =========================================================
   HISTORIAL
   Todavía no existe la página.
   ========================================================= */

document
  .getElementById('sales-history-menu')
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/sales-history.html'

    }
  )

/* =========================================================
   CLIENTES
   Todavía no existe la página.
   ========================================================= */

document
  .getElementById('customers-menu')
  .addEventListener(
    'click',
    () => {

      alert(
        'El módulo de clientes será implementado próximamente.'
      )

    }
  )


/* =========================================================
   MENÚS DEL PROYECTO ORIGINAL
   ========================================================= */

const pendingMenus =
  document.querySelectorAll(
    '.pending-menu'
  )


pendingMenus.forEach(
  (item) => {

    item.addEventListener(
      'click',
      () => {

        /*
         * Conservamos el comportamiento
         * visual que tenía el dashboard.
         */

        document
          .querySelectorAll(
            '.menu-item'
          )
          .forEach(
            (menu) => {

              menu.classList.remove(
                'active'
              )

            }
          )

        item.classList.add(
          'active'
        )

      }
    )

  }
)


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

document
  .getElementById('logout-btn')
  .addEventListener(
    'click',
    async () => {

      try {

        await fetch(
          window.location.origin +
          '/api/v1/account/logout',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )

      } catch (error) {

        console.error(
          'Error cerrando sesión.',
          error
        )

      }


      localStorage.removeItem(
        'erp_token'
      )

      localStorage.removeItem(
        'erp_user'
      )


      window.location.href =
        '/index.html'

    }
  )


/* =========================================================
   SIDEBAR COLAPSABLE
   ========================================================= */

const appLayout =
  document.querySelector(
    '.app-layout'
  )

const sidebarToggle =
  document.getElementById(
    'sidebar-toggle'
  )


sidebarToggle.addEventListener(
  'click',
  () => {

    const collapsed =
      appLayout.classList.toggle(
        'sidebar-collapsed'
      )


    if (collapsed) {

      sidebarToggle.textContent =
        '›'

      sidebarToggle.setAttribute(
        'aria-label',
        'Expandir menú'
      )

      sidebarToggle.setAttribute(
        'title',
        'Expandir menú'
      )

    } else {

      sidebarToggle.textContent =
        '‹'

      sidebarToggle.setAttribute(
        'aria-label',
        'Contraer menú'
      )

      sidebarToggle.setAttribute(
        'title',
        'Contraer menú'
      )

    }

  }
)