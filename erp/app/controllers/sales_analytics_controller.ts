
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class SalesAnalyticsController {
  /**
   * GET /api/v1/sales-analytics/forecast?months=3
   * Consulta ventas completadas agregadas por día y envía únicamente
   * los datos numéricos al servicio Python. No consulta datos personales.
   */
  async forecast({ request, response }: HttpContext) {
    const months = Number(request.input('months', 3))

    if (![1, 2, 3].includes(months)) {
      return response.badRequest({
        success: false,
        message: 'El horizonte debe ser de 1, 2 o 3 meses.',
      })
    }

    try {
      const queryResult = await db.rawQuery(`
        SELECT
          TO_CHAR(
            (sale_date AT TIME ZONE 'America/Lima')::date,
            'YYYY-MM-DD'
          ) AS date,
          COALESCE(SUM(total), 0)::float AS revenue,
          COUNT(*)::int AS sales_count,
          COUNT(*) FILTER (
            WHERE sale_number LIKE 'SIM-%'
          )::int AS simulated_count,
          COUNT(*) FILTER (
            WHERE sale_number NOT LIKE 'SIM-%'
          )::int AS real_count
        FROM erp.sales
        WHERE status = 'COMPLETADA'
          AND sale_date >= NOW() - INTERVAL '730 days'
        GROUP BY (sale_date AT TIME ZONE 'America/Lima')::date
        ORDER BY (sale_date AT TIME ZONE 'America/Lima')::date ASC
      `)

      const rows = Array.isArray(queryResult.rows)
        ? queryResult.rows
        : []

      if (!rows.length) {
        return response.ok({
          success: true,
          data: {
            status: 'insufficient_history',
            message: 'No hay ventas completadas para entrenar el modelo.',
            history_days: 0,
            history_monthly: [],
            forecast_monthly: [],
          },
        })
      }

      const history = rows.map((row: any) => ({
        date: String(row.date),
        revenue: Number(row.revenue ?? 0),
        sales_count: Number(row.sales_count ?? 0),
        simulated_count: Number(row.simulated_count ?? 0),
        real_count: Number(row.real_count ?? 0),
      }))

      const serviceUrl = (
        process.env.ML_ANALYTICS_URL || 'http://ml-analytics:8000'
      ).replace(/\/+$/, '')

      const mlResponse = await fetch(`${serviceUrl}/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          history,
          horizon_months: months,
        }),
        signal: AbortSignal.timeout(30000),
      })

      // CORRECCIÓN: tipar la respuesta que llega desde Python.
      const result = (await mlResponse.json().catch(() => ({}))) as {
        detail?: string
        [key: string]: unknown
      }

      if (!mlResponse.ok) {
        console.error('[SalesAnalytics] Python service:', result)

        return response.status(503).send({
          success: false,
          message:
            result.detail ||
            'El servicio de Machine Learning no está disponible.',
        })
      }

      return response.ok({
        success: true,
        data: result,
      })
    } catch (error) {
      console.error('[SalesAnalytics] forecast:', error)

      return response.status(503).send({
        success: false,
        message:
          'No se pudo generar el pronóstico. Verifica que el servicio ml-analytics esté activo.',
      })
    }
  }
}
