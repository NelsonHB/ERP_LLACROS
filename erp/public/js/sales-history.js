/* =========================================================
   DATOS SIMULADOS

   Pensados para futuras tablas:

   sales
   sale_details
   products
   customers
   users
   ========================================================= */

const sales = [

  {
    id: 1,
    number: 'V-000001',

    createdAt: '2026-09-28T08:15:00',

    userId: 1,

    customerId: null,

    customer: {
      name: 'Cliente general',
      documentType: null,
      documentNumber: null
    },

    documentType: 'Boleta',

    paymentMethod: 'Efectivo',

    items: [

      {
        productId: 3,
        code: 'PER-001',
        name: 'Mouse Logitech G203',
        category: 'Periféricos',
        quantity: 2,
        unitPrice: 89.90
      },

      {
        productId: 5,
        code: 'COM-001',
        name: 'Memoria RAM 16GB DDR4',
        category: 'Componentes',
        quantity: 1,
        unitPrice: 189.00
      }

    ]

  },


  {
    id: 2,
    number: 'V-000002',

    createdAt: '2026-09-25T15:40:00',

    userId: 1,

    customerId: 1,

    customer: {
      name: 'Juan Pérez',
      documentType: 'DNI',
      documentNumber: '76543210'
    },

    documentType: 'Boleta',

    paymentMethod: 'Yape',

    items: [

      {
        productId: 1,
        code: 'LAP-001',
        name: 'Laptop Lenovo IdeaPad',
        category: 'Laptops',
        quantity: 1,
        unitPrice: 2499.90
      },

      {
        productId: 7,
        code: 'ACC-001',
        name: 'Audífonos HyperX',
        category: 'Accesorios',
        quantity: 1,
        unitPrice: 249.90
      }

    ]

  },


  {
    id: 3,
    number: 'V-000003',

    createdAt: '2026-09-18T11:20:00',

    userId: 1,

    customerId: 2,

    customer: {
      name: 'María Torres',
      documentType: 'DNI',
      documentNumber: '71234567'
    },

    documentType: 'Boleta',

    paymentMethod: 'Tarjeta',

    items: [

      {
        productId: 4,
        code: 'PER-002',
        name: 'Teclado Mecánico Redragon',
        category: 'Periféricos',
        quantity: 1,
        unitPrice: 179.90
      },

      {
        productId: 8,
        code: 'ACC-002',
        name: 'Webcam Logitech C920',
        category: 'Accesorios',
        quantity: 1,
        unitPrice: 329.90
      }

    ]

  },


  {
    id: 4,
    number: 'V-000004',

    createdAt: '2026-08-29T17:30:00',

    userId: 1,

    customerId: 3,

    customer: {
      name: 'Empresa Demo S.A.C.',
      documentType: 'RUC',
      documentNumber: '20601234567'
    },

    documentType: 'Factura',

    paymentMethod: 'Transferencia',

    items: [

      {
        productId: 2,
        code: 'LAP-002',
        name: 'Laptop ASUS VivoBook',
        category: 'Laptops',
        quantity: 2,
        unitPrice: 2899.00
      },

      {
        productId: 6,
        code: 'COM-002',
        name: 'SSD Kingston 1TB',
        category: 'Componentes',
        quantity: 2,
        unitPrice: 289.90
      }

    ]

  },


  {
    id: 5,
    number: 'V-000005',

    createdAt: '2026-08-15T09:10:00',

    userId: 1,

    customerId: null,

    customer: {
      name: 'Cliente general',
      documentType: null,
      documentNumber: null
    },

    documentType: 'Boleta',

    paymentMethod: 'Plin',

    items: [

      {
        productId: 6,
        code: 'COM-002',
        name: 'SSD Kingston 1TB',
        category: 'Componentes',
        quantity: 1,
        unitPrice: 289.90
      },

      {
        productId: 3,
        code: 'PER-001',
        name: 'Mouse Logitech G203',
        category: 'Periféricos',
        quantity: 1,
        unitPrice: 89.90
      }

    ]

  },


  {
    id: 6,
    number: 'V-000006',

    createdAt: '2026-07-22T13:45:00',

    userId: 1,

    customerId: 1,

    customer: {
      name: 'Juan Pérez',
      documentType: 'DNI',
      documentNumber: '76543210'
    },

    documentType: 'Boleta',

    paymentMethod: 'Efectivo',

    items: [

      {
        productId: 7,
        code: 'ACC-001',
        name: 'Audífonos HyperX',
        category: 'Accesorios',
        quantity: 2,
        unitPrice: 249.90
      },

      {
        productId: 3,
        code: 'PER-001',
        name: 'Mouse Logitech G203',
        category: 'Periféricos',
        quantity: 1,
        unitPrice: 89.90
      }

    ]

  },


  {
    id: 7,
    number: 'V-000007',

    createdAt: '2026-07-05T18:25:00',

    userId: 1,

    customerId: 2,

    customer: {
      name: 'María Torres',
      documentType: 'DNI',
      documentNumber: '71234567'
    },

    documentType: 'Boleta',

    paymentMethod: 'Tarjeta',

    items: [

      {
        productId: 5,
        code: 'COM-001',
        name: 'Memoria RAM 16GB DDR4',
        category: 'Componentes',
        quantity: 2,
        unitPrice: 189.00
      }

    ]

  },


  {
    id: 8,
    number: 'V-000008',

    createdAt: '2026-06-12T10:05:00',

    userId: 1,

    customerId: 3,

    customer: {
      name: 'Empresa Demo S.A.C.',
      documentType: 'RUC',
      documentNumber: '20601234567'
    },

    documentType: 'Factura',

    paymentMethod: 'Tarjeta',

    items: [

      {
        productId: 1,
        code: 'LAP-001',
        name: 'Laptop Lenovo IdeaPad',
        category: 'Laptops',
        quantity: 3,
        unitPrice: 2499.90
      },

      {
        productId: 8,
        code: 'ACC-002',
        name: 'Webcam Logitech C920',
        category: 'Accesorios',
        quantity: 3,
        unitPrice: 329.90
      }

    ]

  }

]


/* =========================================================
   CALCULAR TOTALES DE CADA VENTA
   ========================================================= */

sales.forEach((sale) => {

  sale.total =
    sale.items.reduce(
      (sum, item) =>
        sum +
        item.unitPrice *
        item.quantity,
      0
    )

  sale.subtotal =
    sale.total / 1.18

  sale.igv =
    sale.total -
    sale.subtotal

})


/* =========================================================
   ELEMENTOS HTML
   ========================================================= */

const tableBody =
  document.getElementById(
    'sales-table-body'
  )

const searchInput =
  document.getElementById(
    'search-sale'
  )

const monthFilter =
  document.getElementById(
    'month-filter'
  )

const categoryFilter =
  document.getElementById(
    'category-filter'
  )

const documentFilter =
  document.getElementById(
    'document-filter'
  )

const paymentFilter =
  document.getElementById(
    'payment-filter'
  )

const sortSales =
  document.getElementById(
    'sort-sales'
  )

const noSales =
  document.getElementById(
    'no-sales'
  )

const categoryAnalysis =
  document.getElementById(
    'category-analysis'
  )


/* =========================================================
   UTILIDADES
   ========================================================= */

function money(value) {

  return new Intl.NumberFormat(
    'es-PE',
    {
      style: 'currency',
      currency: 'PEN'
    }
  ).format(value)

}


function formatDate(value) {

  const date =
    new Date(value)

  return new Intl.DateTimeFormat(
    'es-PE',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)

}


function getMonthKey(value) {

  const date =
    new Date(value)

  return (
    date.getFullYear() +
    '-' +
    String(
      date.getMonth() + 1
    ).padStart(2, '0')
  )

}


function getMonthName(key) {

  const [year, month] =
    key.split('-')

  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    )

  const name =
    new Intl.DateTimeFormat(
      'es-PE',
      {
        month: 'long',
        year: 'numeric'
      }
    ).format(date)

  return (
    name.charAt(0).toUpperCase() +
    name.slice(1)
  )

}


/* =========================================================
   CREAR FILTRO DE MESES
   ========================================================= */

function loadMonths() {

  const months =
    [
      ...new Set(
        sales.map(
          (sale) =>
            getMonthKey(
              sale.createdAt
            )
        )
      )
    ]

  months.sort().reverse()


  months.forEach((month) => {

    const option =
      document.createElement(
        'option'
      )

    option.value =
      month

    option.textContent =
      getMonthName(month)

    monthFilter.appendChild(
      option
    )

  })

}


/* =========================================================
   FILTRAR VENTAS
   ========================================================= */

function getFilteredSales() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase()

  let filtered =
    sales.filter((sale) => {

      /*
       * BÚSQUEDA
       */

      const searchableProducts =
        sale.items
          .map(
            (item) =>
              `${item.name} ${item.code}`
          )
          .join(' ')
          .toLowerCase()


      const matchesSearch =

        sale.number
          .toLowerCase()
          .includes(search)

        ||

        sale.customer.name
          .toLowerCase()
          .includes(search)

        ||

        searchableProducts
          .includes(search)


      /*
       * MES
       */

      const matchesMonth =

        monthFilter.value ===
        'all'

        ||

        getMonthKey(
          sale.createdAt
        ) ===
        monthFilter.value


      /*
       * CATEGORÍA
       */

      const matchesCategory =

        categoryFilter.value ===
        'all'

        ||

        sale.items.some(
          (item) =>
            item.category ===
            categoryFilter.value
        )


      /*
       * COMPROBANTE
       */

      const matchesDocument =

        documentFilter.value ===
        'all'

        ||

        sale.documentType ===
        documentFilter.value


      /*
       * PAGO
       */

      const matchesPayment =

        paymentFilter.value ===
        'all'

        ||

        sale.paymentMethod ===
        paymentFilter.value


      return (
        matchesSearch &&
        matchesMonth &&
        matchesCategory &&
        matchesDocument &&
        matchesPayment
      )

    })


  /*
   * ORDENAMIENTO
   */

  switch (
    sortSales.value
  ) {

    case 'oldest':

      filtered.sort(
        (a, b) =>
          new Date(a.createdAt) -
          new Date(b.createdAt)
      )

      break


    case 'highest':

      filtered.sort(
        (a, b) =>
          b.total - a.total
      )

      break


    case 'lowest':

      filtered.sort(
        (a, b) =>
          a.total - b.total
      )

      break


    default:

      filtered.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )

  }


  return filtered

}


/* =========================================================
   RESUMEN GENERAL
   ========================================================= */

function renderSummary(filtered) {

  const revenue =
    filtered.reduce(
      (sum, sale) =>
        sum + sale.total,
      0
    )


  const units =
    filtered.reduce(
      (saleSum, sale) => {

        return (
          saleSum +
          sale.items.reduce(
            (itemSum, item) =>
              itemSum +
              item.quantity,
            0
          )
        )

      },
      0
    )


  const average =
    filtered.length
      ? revenue /
        filtered.length
      : 0


  const unitAverage =
    filtered.length
      ? units /
        filtered.length
      : 0


  document
    .getElementById(
      'summary-sales'
    )
    .textContent =
      filtered.length


  document
    .getElementById(
      'summary-revenue'
    )
    .textContent =
      money(revenue)


  document
    .getElementById(
      'summary-average'
    )
    .textContent =
      money(average)


  document
    .getElementById(
      'summary-units'
    )
    .textContent =
      units


  document
    .getElementById(
      'summary-unit-average'
    )
    .textContent =
      `Promedio: ${unitAverage.toFixed(1)} por venta`

}


/* =========================================================
   ANÁLISIS POR CATEGORÍA
   ========================================================= */

function renderCategoryAnalysis(
  filtered
) {

  const categories = [
    'Laptops',
    'Periféricos',
    'Componentes',
    'Accesorios'
  ]


  categoryAnalysis.innerHTML =
    ''


  categories.forEach(
    (category) => {

      let units = 0

      let revenue = 0


      filtered.forEach(
        (sale) => {

          sale.items.forEach(
            (item) => {

              if (
                item.category ===
                category
              ) {

                units +=
                  item.quantity

                revenue +=
                  item.quantity *
                  item.unitPrice

              }

            }
          )

        }
      )


      const averageCost =
        units
          ? revenue / units
          : 0


      const card =
        document.createElement(
          'article'
        )


      card.className =
        'category-stat'


      card.innerHTML = `

        <div class="category-stat-top">

          <strong>
            ${category}
          </strong>

          <span>
            ${units} unidades
          </span>

        </div>


        <div class="category-stat-data">

          <div>

            <span>
              Ingresos
            </span>

            <strong>
              ${money(revenue)}
            </strong>

          </div>


          <div>

            <span>
              Precio promedio
            </span>

            <strong>
              ${money(averageCost)}
            </strong>

          </div>

        </div>

      `


      categoryAnalysis.appendChild(
        card
      )

    }
  )

}


/* =========================================================
   TABLA
   ========================================================= */

function renderTable(filtered) {

  tableBody.innerHTML =
    ''


  document
    .getElementById(
      'results-text'
    )
    .textContent =
      `${filtered.length} ${
        filtered.length === 1
          ? 'resultado'
          : 'resultados'
      }`


  if (
    filtered.length === 0
  ) {

    noSales.style.display =
      'block'

    return

  }


  noSales.style.display =
    'none'


  filtered.forEach(
    (sale) => {

      const units =
        sale.items.reduce(
          (sum, item) =>
            sum +
            item.quantity,
          0
        )


      const firstProduct =
        sale.items[0]


      const additional =
        sale.items.length - 1


      const row =
        document.createElement(
          'tr'
        )


      row.innerHTML = `

        <td>

          <span class="sale-id">
            ${sale.number}
          </span>

        </td>


        <td>
          ${formatDate(
            sale.createdAt
          )}
        </td>


        <td>

          <span class="customer-name">
            ${sale.customer.name}
          </span>

          <span class="customer-document">

            ${
              sale.customer
                .documentNumber

                ? `${
                    sale.customer
                      .documentType
                  }: ${
                    sale.customer
                      .documentNumber
                  }`

                : 'Sin documento'
            }

          </span>

        </td>


        <td>

          <span
            class="badge badge-document"
          >
            ${sale.documentType}
          </span>

        </td>


        <td>

          <div class="product-preview">

            <strong>
              ${firstProduct.name}
            </strong>

            <span>

              ${units} unidades

              ${
                additional > 0

                  ? ` · +${additional} producto${
                      additional > 1
                        ? 's'
                        : ''
                    }`

                  : ''
              }

            </span>

          </div>

        </td>


        <td>

          <span class="badge">
            ${sale.paymentMethod}
          </span>

        </td>


        <td>

          <span class="sale-total">
            ${money(sale.total)}
          </span>

        </td>


        <td>

          <button
            class="detail-button"
            type="button"
            onclick="openSaleDetail(${sale.id})"
          >
            Ver detalle
          </button>

        </td>

      `


      tableBody.appendChild(
        row
      )

    }
  )

}


/* =========================================================
   ACTUALIZAR TODO
   ========================================================= */

function updateHistory() {

  const filtered =
    getFilteredSales()


  renderSummary(
    filtered
  )


  renderCategoryAnalysis(
    filtered
  )


  renderTable(
    filtered
  )

}


/* =========================================================
   DETALLE DE VENTA
   ========================================================= */

function openSaleDetail(id) {

  const sale =
    sales.find(
      (item) =>
        item.id === id
    )


  if (!sale) {
    return
  }


  document
    .getElementById(
      'detail-sale-number'
    )
    .textContent =
      sale.number


  document
    .getElementById(
      'detail-date'
    )
    .textContent =
      formatDate(
        sale.createdAt
      )


  document
    .getElementById(
      'detail-customer'
    )
    .textContent =
      sale.customer.name


  document
    .getElementById(
      'detail-document'
    )
    .textContent =
      sale.documentType


  document
    .getElementById(
      'detail-payment'
    )
    .textContent =
      sale.paymentMethod


  const list =
    document.getElementById(
      'detail-products-list'
    )


  list.innerHTML =
    ''


  sale.items.forEach(
    (item) => {

      const total =
        item.quantity *
        item.unitPrice


      const row =
        document.createElement(
          'div'
        )


      row.className =
        'detail-product-row'


      row.innerHTML = `

        <span>
          ${item.name}
        </span>

        <span>
          x${item.quantity}
        </span>

        <span>
          ${money(
            item.unitPrice
          )}
        </span>

        <span>
          ${money(total)}
        </span>

      `


      list.appendChild(
        row
      )

    }
  )


  document
    .getElementById(
      'detail-subtotal'
    )
    .textContent =
      money(
        sale.subtotal
      )


  document
    .getElementById(
      'detail-igv'
    )
    .textContent =
      money(
        sale.igv
      )


  document
    .getElementById(
      'detail-total'
    )
    .textContent =
      money(
        sale.total
      )


  document
    .getElementById(
      'detail-modal'
    )
    .classList.add(
      'visible'
    )

}


function closeDetailModal() {

  document
    .getElementById(
      'detail-modal'
    )
    .classList.remove(
      'visible'
    )

}


document
  .getElementById(
    'close-detail-modal'
  )
  .addEventListener(
    'click',
    closeDetailModal
  )


document
  .getElementById(
    'detail-modal'
  )
  .addEventListener(
    'click',
    (event) => {

      if (
        event.target.id ===
        'detail-modal'
      ) {

        closeDetailModal()

      }

    }
  )


/* =========================================================
   EVENTOS DE FILTROS
   ========================================================= */

searchInput.addEventListener(
  'input',
  updateHistory
)


monthFilter.addEventListener(
  'change',
  updateHistory
)


categoryFilter.addEventListener(
  'change',
  updateHistory
)


documentFilter.addEventListener(
  'change',
  updateHistory
)


paymentFilter.addEventListener(
  'change',
  updateHistory
)


sortSales.addEventListener(
  'change',
  updateHistory
)


/* =========================================================
   LIMPIAR FILTROS
   ========================================================= */

document
  .getElementById(
    'clear-filters'
  )
  .addEventListener(
    'click',
    () => {

      searchInput.value =
        ''

      monthFilter.value =
        'all'

      categoryFilter.value =
        'all'

      documentFilter.value =
        'all'

      paymentFilter.value =
        'all'

      sortSales.value =
        'newest'


      updateHistory()

    }
  )


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document
  .getElementById(
    'dashboard-menu'
  )
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/dashboard.html'

    }
  )


document
  .getElementById(
    'pos-menu'
  )
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/pos.html'

    }
  )


document
  .getElementById(
    'new-sale-button'
  )
  .addEventListener(
    'click',
    () => {

      window.location.href =
        '/pos.html'

    }
  )


document
  .getElementById(
    'customers-menu'
  )
  .addEventListener(
    'click',
    () => {

      alert(
        'El módulo de clientes será implementado próximamente.'
      )

    }
  )


/* =========================================================
   SESIÓN
   ========================================================= */

const token =
  localStorage.getItem(
    'erp_token'
  )


const userRaw =
  localStorage.getItem(
    'erp_user'
  )


if (!token) {

  window.location.href =
    '/index.html'

}


if (userRaw) {

  try {

    const user =
      JSON.parse(
        userRaw
      )


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
        ''

  } catch (error) {

    console.error(
      error
    )

  }

}


/* =========================================================
   LOGOUT
   ========================================================= */

document
  .getElementById(
    'logout-btn'
  )
  .addEventListener(
    'click',
    async () => {

      try {

        await fetch(
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
   SIDEBAR
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

  }
)


/* =========================================================
   INICIAR
   ========================================================= */

loadMonths()

updateHistory()