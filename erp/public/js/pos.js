/* =========================================================
   PRODUCTOS DE PRUEBA

   Más adelante estos productos vendrán desde PostgreSQL
   mediante la API de AdonisJS.
   ========================================================= */

const products = [
  {
    id: 1,
    code: 'LAP-001',
    name: 'Laptop Lenovo IdeaPad',
    category: 'Laptops',
    price: 2499.90,
    stock: 8
  },
  {
    id: 2,
    code: 'LAP-002',
    name: 'Laptop ASUS VivoBook',
    category: 'Laptops',
    price: 2899.00,
    stock: 5
  },
  {
    id: 3,
    code: 'PER-001',
    name: 'Mouse Logitech G203',
    category: 'Periféricos',
    price: 89.90,
    stock: 24
  },
  {
    id: 4,
    code: 'PER-002',
    name: 'Teclado Mecánico Redragon',
    category: 'Periféricos',
    price: 179.90,
    stock: 14
  },
  {
    id: 5,
    code: 'COM-001',
    name: 'Memoria RAM 16GB DDR4',
    category: 'Componentes',
    price: 189.00,
    stock: 18
  },
  {
    id: 6,
    code: 'COM-002',
    name: 'SSD Kingston 1TB',
    category: 'Componentes',
    price: 289.90,
    stock: 11
  },
  {
    id: 7,
    code: 'ACC-001',
    name: 'Audífonos HyperX',
    category: 'Accesorios',
    price: 249.90,
    stock: 9
  },
  {
    id: 8,
    code: 'ACC-002',
    name: 'Webcam Logitech C920',
    category: 'Accesorios',
    price: 329.90,
    stock: 7
  }
]


/* =========================================================
   ESTADO DEL POS
   ========================================================= */

let cart = []

let selectedCategory = 'Todos'

let selectedPaymentMethod = 'Efectivo'


/* =========================================================
   ELEMENTOS DEL HTML
   ========================================================= */

const productsGrid =
  document.getElementById('products-grid')

const searchInput =
  document.getElementById('search-product')

const cartItems =
  document.getElementById('cart-items')

const cartCount =
  document.getElementById('cart-count')

const subtotalElement =
  document.getElementById('subtotal')

const igvElement =
  document.getElementById('igv')

const totalElement =
  document.getElementById('total')

const checkoutTotal =
  document.getElementById('checkout-total')

const checkoutButton =
  document.getElementById('checkout-btn')

const productCount =
  document.getElementById('product-count')


/* MODAL */

const paymentModal =
  document.getElementById('payment-modal')

const modalTotal =
  document.getElementById('modal-total')

const cashReceived =
  document.getElementById('cash-received')

const changeElement =
  document.getElementById('change')

const cashContainer =
  document.getElementById('cash-container')


/* =========================================================
   FORMATO DE DINERO
   ========================================================= */

function money(value) {
  return `S/ ${value.toFixed(2)}`
}


/* =========================================================
   MOSTRAR PRODUCTOS
   ========================================================= */

function renderProducts() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase()


  const filtered =
    products.filter((product) => {

      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(search) ||
        product.code
          .toLowerCase()
          .includes(search)


      const matchesCategory =
        selectedCategory === 'Todos' ||
        product.category === selectedCategory


      return matchesSearch && matchesCategory
    })


  productCount.textContent =
    `${filtered.length} productos disponibles`


  productsGrid.innerHTML = ''


  /*
   * Si no encontramos productos mostramos un mensaje.
   */

  if (filtered.length === 0) {

    productsGrid.innerHTML = `
      <div class="no-products">
        No se encontraron productos.
      </div>
    `

    return
  }


  filtered.forEach((product) => {

    const card =
      document.createElement('article')


    card.className =
      'product-card'


    card.innerHTML = `

      <div class="product-top">

        <span class="product-category">
          ${product.category}
        </span>

        <span class="stock">
          Stock: ${product.stock}
        </span>

      </div>


      <div class="product-image">
        ${product.name.charAt(0)}
      </div>


      <div class="product-code">
        ${product.code}
      </div>


      <h4>
        ${product.name}
      </h4>


      <div class="product-bottom">

        <strong>
          ${money(product.price)}
        </strong>


        <button
          type="button"
          onclick="addProduct(${product.id})"
        >
          + Agregar
        </button>

      </div>

    `


    productsGrid.appendChild(card)
  })
}


/* =========================================================
   AGREGAR PRODUCTO
   ========================================================= */

function addProduct(id) {

  const product =
    products.find(
      (item) => item.id === id
    )


  if (!product) {
    return
  }


  const existing =
    cart.find(
      (item) => item.id === id
    )


  /*
   * Si ya existe en el carrito,
   * solamente aumentamos la cantidad.
   */

  if (existing) {

    if (existing.quantity < product.stock) {

      existing.quantity++

    } else {

      alert(
        'No existe más stock disponible de este producto.'
      )

    }

  } else {

    /*
     * Si todavía no existe,
     * lo agregamos con cantidad 1.
     */

    cart.push({
      ...product,
      quantity: 1
    })

  }


  renderCart()
}


/* =========================================================
   CAMBIAR CANTIDAD
   ========================================================= */

function changeQuantity(id, amount) {

  const item =
    cart.find(
      (product) => product.id === id
    )


  if (!item) {
    return
  }


  item.quantity += amount


  /*
   * Si llega a cero lo eliminamos.
   */

  if (item.quantity <= 0) {

    cart =
      cart.filter(
        (product) => product.id !== id
      )

  }


  /*
   * Evitamos superar el stock.
   */

  if (item.quantity > item.stock) {

    item.quantity =
      item.stock

  }


  renderCart()
}


/* =========================================================
   ELIMINAR PRODUCTO
   ========================================================= */

function removeProduct(id) {

  cart =
    cart.filter(
      (product) => product.id !== id
    )


  renderCart()
}


/* =========================================================
   CALCULAR TOTALES
   ========================================================= */

function calculateTotals() {

  /*
   * Precio final incluyendo IGV.
   */

  const total =
    cart.reduce(
      (sum, item) => {

        return (
          sum +
          item.price * item.quantity
        )

      },
      0
    )


  /*
   * Extraemos el IGV del precio final.
   *
   * Precio = subtotal + IGV
   * IGV = 18%
   */

  const subtotal =
    total / 1.18


  const igv =
    total - subtotal


  return {
    subtotal,
    igv,
    total
  }
}


/* =========================================================
   MOSTRAR CARRITO
   ========================================================= */

function renderCart() {

  /*
   * CARRITO VACÍO
   */

  if (cart.length === 0) {

    cartItems.innerHTML = `

      <div class="empty-cart">

        <div class="empty-cart-icon">

          <svg viewBox="0 0 24 24">

            <path
              d="M3 3h2l2.5 11h10l2-7H7"
            ></path>

            <circle
              cx="10"
              cy="19"
              r="1"
            ></circle>

            <circle
              cx="18"
              cy="19"
              r="1"
            ></circle>

          </svg>

        </div>


        <strong>
          Carrito vacío
        </strong>


        <p>
          Selecciona productos para comenzar una venta.
        </p>

      </div>

    `

  }


  /*
   * CARRITO CON PRODUCTOS
   */

  else {

    cartItems.innerHTML = ''


    cart.forEach((item) => {

      const row =
        document.createElement('div')


      row.className =
        'cart-item'


      row.innerHTML = `

        <div class="cart-item-info">

          <strong>
            ${item.name}
          </strong>

          <span>
            ${money(item.price)} c/u
          </span>

        </div>


        <div class="cart-item-actions">

          <button
            type="button"
            onclick="changeQuantity(${item.id}, -1)"
          >
            −
          </button>


          <span>
            ${item.quantity}
          </span>


          <button
            type="button"
            onclick="changeQuantity(${item.id}, 1)"
          >
            +
          </button>


          <button
            type="button"
            class="remove-item"
            onclick="removeProduct(${item.id})"
          >
            ×
          </button>

        </div>

      `


      cartItems.appendChild(row)
    })
  }


  /*
   * Cantidad total de unidades.
   */

  const quantity =
    cart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    )


  cartCount.textContent =
    `${quantity} ${
      quantity === 1
        ? 'producto'
        : 'productos'
    }`


  /*
   * Actualizamos montos.
   */

  const totals =
    calculateTotals()


  subtotalElement.textContent =
    money(totals.subtotal)


  igvElement.textContent =
    money(totals.igv)


  totalElement.textContent =
    money(totals.total)


  checkoutTotal.textContent =
    money(totals.total)


  /*
   * Solo permitimos cobrar
   * cuando existen productos.
   */

  checkoutButton.disabled =
    cart.length === 0
}


/* =========================================================
   BUSCADOR
   ========================================================= */

searchInput.addEventListener(
  'input',
  renderProducts
)


/* =========================================================
   FILTROS POR CATEGORÍA
   ========================================================= */

document
  .querySelectorAll('.category')
  .forEach((button) => {

    button.addEventListener(
      'click',
      () => {

        /*
         * Quitamos active de todos.
         */

        document
          .querySelectorAll('.category')
          .forEach((item) => {

            item.classList.remove('active')

          })


        /*
         * Activamos el seleccionado.
         */

        button.classList.add('active')


        selectedCategory =
          button.dataset.category


        renderProducts()

      }
    )

  })


/* =========================================================
   LIMPIAR CARRITO
   ========================================================= */

document
  .getElementById('clear-cart')
  .addEventListener(
    'click',
    () => {

      if (cart.length === 0) {
        return
      }


      cart = []


      renderCart()

    }
  )


/* =========================================================
   ABRIR VENTANA DE PAGO
   ========================================================= */

checkoutButton.addEventListener(
  'click',
  () => {

    const totals =
      calculateTotals()


    modalTotal.textContent =
      money(totals.total)


    cashReceived.value = ''


    changeElement.textContent =
      'S/ 0.00'


    paymentModal.classList.add(
      'visible'
    )

  }
)


/* =========================================================
   CERRAR MODAL
   ========================================================= */

function closePaymentModal() {

  paymentModal.classList.remove(
    'visible'
  )

}


document
  .getElementById('close-modal')
  .addEventListener(
    'click',
    closePaymentModal
  )


document
  .getElementById('cancel-payment')
  .addEventListener(
    'click',
    closePaymentModal
  )


/*
 * También permitimos cerrar haciendo clic
 * fuera de la ventana.
 */

paymentModal.addEventListener(
  'click',
  (event) => {

    if (event.target === paymentModal) {

      closePaymentModal()

    }

  }
)


/* =========================================================
   MÉTODOS DE PAGO
   ========================================================= */

document
  .querySelectorAll('.payment-method')
  .forEach((button) => {

    button.addEventListener(
      'click',
      () => {

        document
          .querySelectorAll('.payment-method')
          .forEach((item) => {

            item.classList.remove('active')

          })


        button.classList.add('active')


        selectedPaymentMethod =
          button.dataset.method


        /*
         * Solo pedimos monto recibido
         * cuando se paga en efectivo.
         */

        if (
          selectedPaymentMethod ===
          'Efectivo'
        ) {

          cashContainer.style.display =
            'flex'

        } else {

          cashContainer.style.display =
            'none'


          changeElement.textContent =
            'S/ 0.00'

        }

      }
    )

  })


/* =========================================================
   CALCULAR VUELTO
   ========================================================= */

cashReceived.addEventListener(
  'input',
  () => {

    const received =
      Number(
        cashReceived.value
      ) || 0


    const total =
      calculateTotals().total


    const change =
      Math.max(
        0,
        received - total
      )


    changeElement.textContent =
      money(change)

  }
)


/* =========================================================
   CONFIRMAR VENTA
   ========================================================= */

document
  .getElementById('confirm-payment')
  .addEventListener(
    'click',
    () => {

      /*
       * No debería ocurrir,
       * pero comprobamos que exista una venta.
       */

      if (cart.length === 0) {

        alert(
          'No existen productos en la venta.'
        )

        return
      }


      const totals =
        calculateTotals()


      /*
       * Validamos efectivo.
       */

      if (
        selectedPaymentMethod ===
        'Efectivo'
      ) {

        const received =
          Number(
            cashReceived.value
          ) || 0


        if (received < totals.total) {

          alert(
            'El monto recibido es menor al total de la venta.'
          )

          return
        }

      }


      /*
       * Por ahora simulamos el registro.
       *
       * Más adelante aquí enviaremos:
       *
       * POST /api/v1/sales
       *
       * hacia AdonisJS.
       */

      console.log({

        customer:
          document.getElementById(
            'customer'
          ).value,

        documentType:
          document.getElementById(
            'document-type'
          ).value,

        paymentMethod:
          selectedPaymentMethod,

        products:
          cart,

        subtotal:
          totals.subtotal,

        igv:
          totals.igv,

        total:
          totals.total

      })


      /*
       * Cerramos modal.
       */

      closePaymentModal()


      /*
       * Limpiamos venta.
       */

      cart = []


      renderCart()


      /*
       * Mostramos notificación.
       */

      showToast(
        'Venta registrada correctamente'
      )

    }
  )


/* =========================================================
   NOTIFICACIÓN
   ========================================================= */

function showToast(message) {

  const toast =
    document.getElementById('toast')


  toast.textContent =
    message


  toast.classList.add(
    'visible'
  )


  setTimeout(
    () => {

      toast.classList.remove(
        'visible'
      )

    },
    3000
  )

}


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


    sidebarToggle.textContent =
      collapsed
        ? '›'
        : '‹'


    sidebarToggle.setAttribute(
      'title',
      collapsed
        ? 'Expandir menú'
        : 'Contraer menú'
    )

  }
)


/* =========================================================
   DASHBOARD
   ========================================================= */

document
  .getElementById('dashboard-button')
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/dashboard.html'

    }
  )


/* =========================================================
   HISTORIAL DE VENTAS
   ========================================================= */

document
  .getElementById(
    'sales-history-button'
  )
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/sales-history.html'

    }
  )


/* =========================================================
   CLIENTES
   ========================================================= */

document
  .getElementById(
    'customers-button'
  )
  .addEventListener(
    'click',
    () => {

      showToast(
        'El módulo de clientes estará disponible próximamente.'
      )

    }
  )


/* =========================================================
   INFORMACIÓN DEL USUARIO
   ========================================================= */

const userRaw =
  localStorage.getItem(
    'erp_user'
  )


if (userRaw) {

  try {

    const user =
      JSON.parse(userRaw)


    document
      .getElementById(
        'user-name'
      )
      .textContent =
        user.fullName ||
        'Usuario'


    document
      .getElementById(
        'user-email'
      )
      .textContent =
        user.email ||
        'Sesión activa'

  }

  catch (error) {

    console.error(
      'No se pudo leer el usuario:',
      error
    )

  }

}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

document
  .getElementById(
    'logout-btn'
  )
  .addEventListener(
    'click',
    () => {

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
   INICIALIZACIÓN
   ========================================================= */

renderProducts()

renderCart()