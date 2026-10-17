
'use strict'

// ==========================================
// EZCUDO360 - SIDEBAR COLAPSABLE
// ==========================================

;(function () {

  const SIDEBAR_URL = '/components/sidebar.html'
  const STORAGE_KEY = 'ezcudo_sidebar_collapsed'

  // ========================================
  // GUARDAR ESTADO
  // ========================================

  function isSavedCollapsed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  }

  function saveCollapsed(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // El menú seguirá funcionando.
    }
  }

  // ========================================
  // INICIALIZAR
  // ========================================

  async function initializeSidebar() {

    const container = document.getElementById(
      'sidebar-container'
    )

    if (!container) return

    if (container.dataset.ezSidebarInitialized === 'true') {
      return
    }

    container.dataset.ezSidebarInitialized = 'true'

    // Restaurar ancho desde el inicio
    container.classList.toggle(
      'ez-is-collapsed',
      isSavedCollapsed()
    )

    try {

      const response = await fetch(SIDEBAR_URL, {
        cache: 'no-cache'
      })

      if (!response.ok) {
        throw new Error(
          `No se pudo cargar el sidebar: ${response.status}`
        )
      }

      container.innerHTML = await response.text()

      setupCollapse(container)
      highlightCurrentPage(container)
      loadUserInformation(container)
      setupLogout(container)
      setupMobileMenu(container)

    } catch (error) {

      console.error('Error del sidebar:', error)

      container.textContent =
        'No se pudo cargar el menú lateral.'

    }
  }

  // ========================================
  // CONTRAER Y EXPANDIR
  // ========================================

  function setupCollapse(container) {

    const button = container.querySelector(
      '#ezSidebarToggle'
    )

    if (!button) return

    function updateState(collapsed) {

      container.classList.toggle(
        'ez-is-collapsed',
        collapsed
      )

      const label = collapsed
        ? 'Expandir menú'
        : 'Contraer menú'

      button.setAttribute('title', label)
      button.setAttribute('aria-label', label)

      button.setAttribute(
        'aria-expanded',
        String(!collapsed)
      )
    }

    // Estado inicial
    updateState(isSavedCollapsed())

    button.addEventListener('click', () => {

      const collapsed = !container.classList.contains(
        'ez-is-collapsed'
      )

      updateState(collapsed)
      saveCollapsed(collapsed)

    })
  }

  // ========================================
  // PÁGINA ACTIVA
  // ========================================

  function highlightCurrentPage(container) {

    const currentPage = (
      window.location.pathname.split('/').pop()
      || 'index.html'
    ).toLowerCase()

    // Utilizamos las clases originales
    const links = container.querySelectorAll(
      '.ez-nav-link'
    )

    links.forEach((link) => {

      const page = (
        link.dataset.page || ''
      ).toLowerCase()

      const active = page === currentPage

      link.classList.toggle('active', active)

      if (active) {
        link.setAttribute('aria-current', 'page')
      } else {
        link.removeAttribute('aria-current')
      }

    })
  }

  // ========================================
  // INFORMACIÓN DEL USUARIO
  // ========================================

  function loadUserInformation(container) {

    const nameElement = container.querySelector(
      '#ezUserName'
    )

    const avatarElement = container.querySelector(
      '#ezUserAvatar'
    )

    if (!nameElement || !avatarElement) return

    let userName = 'Usuario ERP'

    for (const key of ['erp_user', 'user']) {

      let stored

      try {
        stored = localStorage.getItem(key)
      } catch {
        continue
      }

      if (!stored) continue

      try {

        const user = JSON.parse(stored)

        const name =
          user?.fullName ||
          user?.full_name ||
          user?.name

        if (
          typeof name === 'string' &&
          name.trim()
        ) {
          userName = name.trim()
          break
        }

      } catch {
        // Ignorar información inválida
      }
    }

    nameElement.textContent = userName

    avatarElement.textContent =
      userName.charAt(0).toUpperCase()

    avatarElement.title = userName

  }

  // ========================================
  // CERRAR SESIÓN
  // ========================================

  function setupLogout(container) {

    const button = container.querySelector(
      '#ezLogoutBtn'
    )

    if (!button) return

    button.addEventListener('click', async () => {

      if (button.disabled) return

      if (!window.confirm(
        '¿Deseas cerrar sesión en EZCUDO360?'
      )) return

      button.disabled = true

      const label = button.querySelector(
        '.ez-logout-text'
      )

      if (label) {
        label.textContent = 'Cerrando...'
      }

      let token = null

      try {
        token = localStorage.getItem('erp_token')
      } catch {
        // Continuar
      }

      try {

        if (token) {

          const response = await fetch(
            '/api/v1/account/logout',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
              }
            }
          )

          if (!response.ok) {
            console.warn(
              'No se pudo revocar el token.'
            )
          }
        }

      } catch (error) {

        console.warn(
          'No se pudo conectar con el servidor:',
          error
        )

      } finally {

        try {

          localStorage.removeItem('erp_token')
          localStorage.removeItem('erp_user')
          localStorage.removeItem('user')

        } catch {
          // Continuar
        }

        window.location.href = '/index.html'
      }

    })
  }

  // ========================================
  // MENÚ MÓVIL
  // ========================================

  function setupMobileMenu(container) {

    const closeButton = container.querySelector(
      '#ezSidebarClose'
    )

    const trigger = document.createElement('button')

    trigger.type = 'button'
    trigger.className = 'ez-mobile-trigger'
    trigger.textContent = '☰'

    trigger.setAttribute(
      'aria-label',
      'Abrir menú principal'
    )

    trigger.setAttribute(
      'aria-expanded',
      'false'
    )

    document.body.appendChild(trigger)

    const overlay = document.createElement('div')

    overlay.className = 'ez-sidebar-overlay'

    document.body.appendChild(overlay)

    function openMenu() {

      container.classList.add('ez-sidebar-open')

      overlay.classList.add('is-visible')

      trigger.setAttribute(
        'aria-expanded',
        'true'
      )

      closeButton?.focus()

    }

    function closeMenu() {

      container.classList.remove('ez-sidebar-open')

      overlay.classList.remove('is-visible')

      trigger.setAttribute(
        'aria-expanded',
        'false'
      )

    }

    trigger.addEventListener('click', openMenu)

    closeButton?.addEventListener(
      'click',
      closeMenu
    )

    overlay.addEventListener('click', closeMenu)

    document.addEventListener('keydown', (event) => {

      if (event.key === 'Escape') {
        closeMenu()
      }

    })

    // Cerrar al seleccionar un módulo
    container.querySelectorAll('.ez-nav-link')
      .forEach((link) => {

        link.addEventListener(
          'click',
          closeMenu
        )

      })

    // Cerrar cuando la pantalla pasa a escritorio
    const media = window.matchMedia(
      '(min-width: 851px)'
    )

    media.addEventListener('change', (event) => {

      if (event.matches) {
        closeMenu()
      }

    })
  }

  // ========================================
  // CARGAR SIDEBAR
  // ========================================

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      initializeSidebar
    )

  } else {

    initializeSidebar()

  }

})()
