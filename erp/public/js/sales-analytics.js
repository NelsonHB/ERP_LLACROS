/* EZCUDO360 — Analítica predictiva */

'use strict'

const $ = (id) => document.getElementById(id)
const API_PATH = '/api/v1/sales-analytics/forecast'

let chartResizeHandler = null
let lastResult = null
let toastTimer

function money(value) {
  return `S/ ${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function token() {
  try {
    return localStorage.getItem('erp_token')
  } catch {
    return null
  }
}

function toast(message) {
  const node = $('analyticsToast')
  if (!node) return

  node.textContent = message
  node.classList.remove('analytics-hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.add('analytics-hidden'), 4000)
}

async function requestForecast(months) {
  const accessToken = token()
  if (!accessToken) {
    throw new Error('Inicia sesión para consultar la analítica.')
  }

  const response = await fetch(`${API_PATH}?months=${encodeURIComponent(months)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || result.success === false) {
    if (response.status === 401) {
      throw new Error('Tu sesión venció. Inicia sesión nuevamente.')
    }

    throw new Error(result.message || `Error HTTP ${response.status}`)
  }

  return result.data
}

function showNotice(message, type = 'demo') {
  const node = $('dataNotice')
  if (!node) return

  node.textContent = message
  node.className = `analytics-notice ${type}`
}

function clearNotice() {
  const node = $('dataNotice')
  if (!node) return

  node.className = 'analytics-notice analytics-hidden'
}

function resetView() {
  lastResult = null

  const pdfButton = $('downloadReportPdf')
  if (pdfButton) pdfButton.disabled = true

  $('kpiDays').textContent = '—'
  $('kpiSimulated').textContent = '—'
  $('kpiForecastRevenue').textContent = '—'
  $('kpiForecastCount').textContent = '—'
  $('forecastTable').innerHTML = '<tr><td colspan="4" class="analytics-empty">Sin pronóstico disponible.</td></tr>'
  $('modelMae').textContent = '—'
  $('modelWape').textContent = '—'
  $('modelHoldout').textContent = '—'
  $('featureImportance').innerHTML = '<p class="analytics-muted">Aún no hay información del entrenamiento.</p>'
  $('chartEmpty').classList.remove('analytics-hidden')

  const canvas = $('forecastChart')
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function renderEvaluation(result) {
  const evaluation = result.evaluation
  $('modelName').textContent = result.model || 'RandomForestRegressor'

  if (!evaluation || evaluation.status !== 'evaluated') {
    $('modelMae').textContent = 'No disponible'
    $('modelWape').textContent = 'No disponible'
    $('modelHoldout').textContent = '—'
    $('modelEvaluationNote').textContent = evaluation?.message || 'No hay datos suficientes para evaluar el modelo.'
    return
  }

  $('modelMae').textContent = evaluation.mae_daily_revenue === null
    ? '—'
    : `${money(evaluation.mae_daily_revenue)} / día`

  $('modelWape').textContent = evaluation.wape_pct === null
    ? '—'
    : `${Number(evaluation.wape_pct).toFixed(2)} %`

  $('modelHoldout').textContent = `${evaluation.holdout_days} días`
  $('modelEvaluationNote').textContent = `${evaluation.message} WAPE expresa error relativo ponderado; no es un porcentaje de exactitud.`
}

function renderFeatures(features = []) {
  const container = $('featureImportance')

  if (!features.length) {
    container.innerHTML = '<p class="analytics-muted">No hay importancia de variables disponible.</p>'
    return
  }

  container.innerHTML = features.map((feature) => {
    const percent = Math.max(0, Math.min(100, Number(feature.importance) * 100))

    return `
      <div class="analytics-feature">
        <strong>${escapeHtml(feature.feature)}</strong>
        <div class="analytics-feature-bar"><span style="width:${percent.toFixed(1)}%"></span></div>
        <small>${percent.toFixed(1)} % de importancia relativa</small>
      </div>
    `
  }).join('')
}

function renderForecastTable(rows = []) {
  const container = $('forecastTable')

  if (!rows.length) {
    container.innerHTML = '<tr><td colspan="4" class="analytics-empty">No se generaron meses proyectados.</td></tr>'
    return
  }

  container.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.month)}</strong></td>
      <td>${money(row.revenue)}</td>
      <td>${Number(row.sales_count || 0).toLocaleString('es-PE')}</td>
      <td>${money(row.average_ticket)}</td>
    </tr>
  `).join('')
}

function drawChart(history = [], forecast = []) {
  const canvas = $('forecastChart')
  const ctx = canvas.getContext('2d')
  const width = Math.max(320, canvas.clientWidth)
  const height = 320
  const ratio = window.devicePixelRatio || 1

  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.style.height = `${height}px`
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const labels = [
    ...history.map((item) => item.month),
    ...forecast.map((item) => item.month),
  ]

  const actual = history.map((item) => Number(item.revenue || 0))
  const predicted = forecast.map((item) => Number(item.revenue || 0))

  if (!labels.length) {
    $('chartEmpty').classList.remove('analytics-hidden')
    return
  }

  $('chartEmpty').classList.add('analytics-hidden')

  const left = 72
  const right = 20
  const top = 20
  const bottom = 55
  const chartW = width - left - right
  const chartH = height - top - bottom
  const allValues = [...actual, ...predicted]
  const maxValue = Math.max(1, ...allValues) * 1.18
  const x = (index) => left + (labels.length <= 1
    ? chartW / 2
    : (index / (labels.length - 1)) * chartW)
  const y = (value) => top + chartH - (value / maxValue) * chartH

  ctx.font = '10px Arial'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#e8edf4'
  ctx.fillStyle = '#64748b'

  for (let tick = 0; tick <= 4; tick++) {
    const value = maxValue * tick / 4
    const yy = y(value)

    ctx.beginPath()
    ctx.moveTo(left, yy)
    ctx.lineTo(width - right, yy)
    ctx.stroke()
    ctx.fillText(value.toLocaleString('es-PE', { maximumFractionDigits: 0 }), left - 10, yy)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  labels.forEach((label, index) => {
    if (labels.length > 9 && index % 2 !== 0 && index !== labels.length - 1) return
    ctx.fillText(label, x(index), top + chartH + 13)
  })

  function drawLine(values, startIndex, color, dashed = false) {
    if (!values.length) return

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.setLineDash(dashed ? [6, 5] : [])

    values.forEach((value, index) => {
      const pointX = x(startIndex + index)
      const pointY = y(value)

      if (index === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
    })

    ctx.stroke()
    ctx.setLineDash([])

    values.forEach((value, index) => {
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(x(startIndex + index), y(value), 3.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  drawLine(actual, 0, '#2563eb')

  if (predicted.length) {
    const bridge = actual.length
      ? [actual[actual.length - 1], ...predicted]
      : predicted

    drawLine(bridge, Math.max(0, actual.length - 1), '#16a34a', true)
  }
}

function renderResult(result) {
  lastResult = result

  const pdfButton = $('downloadReportPdf')
  if (pdfButton) pdfButton.disabled = result.status !== 'ok'

  $('kpiDays').textContent = Number(result.history_days || 0).toLocaleString('es-PE')
  $('kpiSimulated').textContent = Number(result.simulated_sales || 0).toLocaleString('es-PE')
  $('kpiForecastRevenue').textContent = result.status === 'ok'
    ? money(result.forecast_total_revenue)
    : '—'
  $('kpiForecastCount').textContent = result.status === 'ok'
    ? Number(result.forecast_total_sales || 0).toLocaleString('es-PE')
    : '—'
  $('kpiForecastPeriod').textContent = result.status === 'ok'
    ? `Próximos ${result.horizon_months} meses`
    : 'Historial insuficiente'

  renderEvaluation(result)
  renderForecastTable(result.forecast_monthly || [])
  renderFeatures(result.feature_importance || [])

  if (result.status !== 'ok') {
    showNotice(result.message || 'No hay datos suficientes para entrenar el modelo.', 'error')
    drawChart(result.history_monthly || [], [])
    return
  }

  if (result.data_source === 'DEMO' || result.data_source === 'MIXED') {
    showNotice(result.message || 'El historial contiene datos de demostración.', 'demo')
  } else {
    showNotice(result.message || 'Pronóstico generado con el historial disponible.', 'info')
  }

  drawChart(result.history_monthly || [], result.forecast_monthly || [])
}

function exportReportPdf() {
  const result = lastResult

  if (!result || result.status !== 'ok') {
    toast('Primero debes generar un pronóstico válido.')
    return
  }

  // Esta función se ejecuta desde un clic del usuario para evitar
  // que el navegador bloquee la ventana de impresión.
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    toast('Permite las ventanas emergentes para generar el PDF.')
    return
  }

  const evaluation = result.evaluation || {}

  const forecastRows = (result.forecast_monthly || []).map((row) => {
    const revenue = Number(row.revenue || 0)
    const count = Number(row.sales_count || 0)
    const averageTicket = row.average_ticket == null
      ? (count > 0 ? revenue / count : 0)
      : Number(row.average_ticket)

    return `
      <tr>
        <td>${escapeHtml(row.month)}</td>
        <td>${money(revenue)}</td>
        <td>${count.toLocaleString('es-PE')}</td>
        <td>${money(averageTicket)}</td>
      </tr>
    `
  }).join('')

  const historyRows = (result.history_monthly || [])
    .slice(-12)
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.month)}</td>
        <td>${money(row.revenue)}</td>
      </tr>
    `)
    .join('')

  const features = (result.feature_importance || [])
    .slice()
    .sort((a, b) => Number(b.importance) - Number(a.importance))
    .slice(0, 10)

  const featureRows = features.map((feature) => {
    const percent = Math.max(0, Math.min(100, Number(feature.importance || 0) * 100))

    return `
      <tr>
        <td>${escapeHtml(feature.feature)}</td>
        <td>${percent.toFixed(2)} %</td>
      </tr>
    `
  }).join('')

  const forecastRevenue = Number(result.forecast_total_revenue || 0)
  const forecastCount = Number(result.forecast_total_sales || 0)
  const averageTicket = forecastCount > 0 ? forecastRevenue / forecastCount : 0
  const simulatedSales = Number(result.simulated_sales || 0)
  const dataSource = String(result.data_source || 'NO ESPECIFICADO')
  const horizon = Number(result.horizon_months || 0)

  let sourceDescription = 'Origen de los datos no especificado.'

  if (dataSource === 'DEMO') {
    sourceDescription = 'El pronóstico utiliza datos de demostración. Las ventas simuladas no representan operaciones comerciales reales.'
  } else if (dataSource === 'MIXED') {
    sourceDescription = 'El historial contiene una combinación de ventas reales y registros simulados identificados con SIM-.'
  } else if (dataSource === 'REAL') {
    sourceDescription = 'El historial utilizado no contiene ventas identificadas con el prefijo SIM-.'
  }

  let maeText = 'No disponible'
  let wapeText = 'No disponible'
  let holdoutText = 'No disponible'

  if (evaluation.status === 'evaluated') {
    if (evaluation.mae_daily_revenue != null) {
      maeText = `${money(evaluation.mae_daily_revenue)} por día`
    }

    if (evaluation.wape_pct != null) {
      wapeText = `${Number(evaluation.wape_pct).toFixed(2)} %`
    }

    if (evaluation.holdout_days != null) {
      holdoutText = `${evaluation.holdout_days} días`
    }
  }

  const evaluationMessage = evaluation.message ||
    'No se dispone de una evaluación suficiente del modelo.'

  let chartImage = ''

  try {
    chartImage = $('forecastChart').toDataURL('image/png')
  } catch (error) {
    console.warn('No se pudo incluir el gráfico en el reporte:', error)
  }

  const generatedAt = new Date().toLocaleString('es-PE')

  const reportHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Predictivo EZCUDO360</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }

        * { box-sizing: border-box; }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #1e293b;
          margin: 0;
          font-size: 11px;
          line-height: 1.5;
        }

        .header {
          border-bottom: 3px solid #1e40af;
          padding-bottom: 16px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand {
          color: #1e40af;
          font-size: 24px;
          font-weight: 800;
        }

        .brand span { color: #0f172a; }

        .header-label {
          color: #64748b;
          font-size: 10px;
          text-align: right;
        }

        h1 {
          font-size: 23px;
          margin: 20px 0 5px;
          color: #0f172a;
        }

        h2 {
          font-size: 15px;
          color: #1e40af;
          margin: 24px 0 10px;
          border-bottom: 1px solid #dbe3ef;
          padding-bottom: 7px;
        }

        p { margin: 6px 0; }
        .muted { color: #64748b; }

        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 18px 0;
        }

        .metric {
          border: 1px solid #dbe3ef;
          border-radius: 7px;
          padding: 13px;
        }

        .metric span {
          display: block;
          color: #64748b;
          font-size: 10px;
          margin-bottom: 6px;
        }

        .metric strong {
          font-size: 16px;
          color: #0f172a;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0 18px;
          font-size: 10px;
        }

        th {
          background: #eff4fb;
          color: #1e293b;
          text-align: left;
        }

        th, td {
          border: 1px solid #dbe3ef;
          padding: 8px;
        }

        tr { page-break-inside: avoid; }

        .chart {
          width: 100%;
          max-height: 320px;
          object-fit: contain;
          margin: 10px 0;
          border: 1px solid #e2e8f0;
          padding: 8px;
        }

        .warning {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          padding: 12px;
          border-radius: 6px;
          margin: 16px 0;
        }

        .note {
          background: #f1f5f9;
          border-left: 3px solid #64748b;
          padding: 12px;
          margin: 16px 0;
        }

        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #dbe3ef;
          color: #64748b;
          font-size: 9px;
          text-align: center;
        }

        .section { page-break-inside: avoid; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>

    <body>
      <header class="header">
        <div class="brand">EZCUDO<span>360</span></div>
        <div class="header-label">
          INTELIGENCIA DE NEGOCIOS<br>
          REPORTE DE ANALÍTICA PREDICTIVA
        </div>
      </header>

      <h1>Pronóstico de ventas</h1>
      <p class="muted">Informe generado: ${escapeHtml(generatedAt)}</p>
      <p>
        Horizonte de predicción:
        <strong>${horizon} ${horizon === 1 ? 'mes' : 'meses'}</strong>
      </p>

      <section class="summary">
        <div class="metric">
          <span>Ingresos proyectados</span>
          <strong>${money(forecastRevenue)}</strong>
        </div>
        <div class="metric">
          <span>Ventas estimadas</span>
          <strong>${forecastCount.toLocaleString('es-PE')}</strong>
        </div>
        <div class="metric">
          <span>Ticket promedio estimado</span>
          <strong>${money(averageTicket)}</strong>
        </div>
      </section>

      <section class="section">
        <h2>1. Resumen del historial</h2>
        <p>
          Días históricos disponibles:
          <strong>${Number(result.history_days || 0).toLocaleString('es-PE')}</strong>
        </p>
        <p>
          Ventas de prueba detectadas:
          <strong>${simulatedSales.toLocaleString('es-PE')}</strong>
        </p>
        <p>Fuente de datos: <strong>${escapeHtml(dataSource)}</strong></p>
        <div class="warning">
          <strong>Observación sobre los datos:</strong>
          ${escapeHtml(sourceDescription)}
        </div>
      </section>

      <section class="section">
        <h2>2. Ingresos históricos y pronosticados</h2>
        ${chartImage
          ? `<img class="chart" src="${chartImage}" alt="Gráfico de ingresos históricos y pronosticados">`
          : '<p>No se pudo incluir el gráfico.</p>'}
      </section>

      <section class="section">
        <h2>3. Pronóstico mensual</h2>
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Ingresos estimados</th>
              <th>Ventas estimadas</th>
              <th>Ticket promedio</th>
            </tr>
          </thead>
          <tbody>
            ${forecastRows || '<tr><td colspan="4">Sin datos proyectados.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>4. Evaluación del modelo</h2>
        <p>
          Algoritmo:
          <strong>${escapeHtml(result.model || 'RandomForestRegressor')}</strong>
        </p>
        <table>
          <tbody>
            <tr><th>MAE diario</th><td>${escapeHtml(maeText)}</td></tr>
            <tr><th>WAPE</th><td>${escapeHtml(wapeText)}</td></tr>
            <tr><th>Días de validación</th><td>${escapeHtml(holdoutText)}</td></tr>
          </tbody>
        </table>
        <p class="muted">${escapeHtml(evaluationMessage)}</p>
        <p class="muted">
          WAPE representa el error porcentual ponderado.
          No debe interpretarse como un porcentaje de exactitud.
        </p>
      </section>

      <section class="section">
        <h2>5. Variables utilizadas por el modelo</h2>
        <table>
          <thead>
            <tr><th>Variable</th><th>Importancia relativa</th></tr>
          </thead>
          <tbody>
            ${featureRows || '<tr><td colspan="2">Sin información disponible.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>6. Historial mensual reciente</h2>
        <table>
          <thead>
            <tr><th>Mes</th><th>Ingresos históricos</th></tr>
          </thead>
          <tbody>
            ${historyRows || '<tr><td colspan="2">Sin historial disponible.</td></tr>'}
          </tbody>
        </table>
      </section>

      <div class="note">
        <strong>Consideraciones:</strong>
        Las predicciones son estimaciones estadísticas basadas en el historial
        disponible. No representan ventas aseguradas ni garantizan ingresos
        futuros. Los registros SIM- son datos ficticios de prueba.
      </div>

      <footer class="footer">
        EZCUDO360 · Sistema de gestión empresarial<br>
        Reporte generado automáticamente a partir del módulo de Analítica Predictiva.
      </footer>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(reportHtml)
  printWindow.document.close()
  printWindow.focus()

  toast('Reporte preparado. Selecciona Guardar como PDF en la ventana de impresión.')

  setTimeout(() => {
    printWindow.print()
  }, 400)
}

async function generateForecast() {
  const button = $('generateForecast')
  const pdfButton = $('downloadReportPdf')
  const months = Number($('forecastHorizon').value)

  button.disabled = true
  button.textContent = 'Entrenando modelo...'

  // Impide descargar un pronóstico anterior mientras se genera uno nuevo.
  lastResult = null
  if (pdfButton) pdfButton.disabled = true

  clearNotice()

  try {
    const result = await requestForecast(months)
    renderResult(result)

    $('lastUpdated').textContent = `Última ejecución: ${new Date().toLocaleString('es-PE')}`

    if (result.status === 'ok') {
      toast('Pronóstico generado correctamente.')
    } else {
      toast(result.message || 'No hay suficientes datos históricos.')
    }
  } catch (error) {
    showNotice(error.message, 'error')
    toast(error.message)
  } finally {
    button.disabled = false
    button.textContent = 'Generar pronóstico'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('generateForecast').addEventListener('click', generateForecast)

  const pdfButton = $('downloadReportPdf')
  if (pdfButton) {
    pdfButton.addEventListener('click', exportReportPdf)
    pdfButton.disabled = true
  }

  generateForecast()

  if (chartResizeHandler) {
    window.removeEventListener('resize', chartResizeHandler)
  }

  chartResizeHandler = () => {
    if (lastResult) {
      drawChart(
        lastResult.history_monthly || [],
        lastResult.forecast_monthly || []
      )
    }
  }

  window.addEventListener('resize', chartResizeHandler)
})