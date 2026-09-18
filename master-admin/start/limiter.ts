/*
|--------------------------------------------------------------------------
| Rate limiters de la aplicación
|--------------------------------------------------------------------------
|
| Definimos límites distintos según el riesgo del endpoint:
| - login/signup: pocos intentos, para frenar fuerza bruta y bots.
| - global: límite general de la API para el resto de rutas.
| - erp-sensitive: acciones delicadas del CRUD de usuarios del ERP.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/**
 * Límite estricto para login: 5 intentos cada 1 minuto,
 * bloqueado 5 minutos si se excede. Se aplica por IP.
 */
export const throttleLogin = limiter.define('login', (ctx) => {
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('5 minutes')
    .usingKey(`login_${ctx.request.ip()}`)
})

/**
 * Límite para creación de cuentas: evita spam de registros.
 */
export const throttleSignup = limiter.define('signup', (ctx) => {
  return limiter.allowRequests(3).every('10 minutes').usingKey(`signup_${ctx.request.ip()}`)
})

/**
 * Límite global para el resto de la API (por IP).
 */
export const throttle = limiter.define('global', (ctx) => {
  return limiter.allowRequests(100).every('1 minute').usingKey(`global_${ctx.request.ip()}`)
})

/**
 * Límite estricto para acciones sensibles sobre usuarios del ERP
 * (reset de contraseña, eliminación). Es independiente del límite
 * global: aunque alguien tenga un token válido (robado o filtrado),
 * no puede automatizar estos endpoints a alta velocidad.
 * Se aplica por admin autenticado, no solo por IP.
 */
export const throttleSensitiveErpAction = limiter.define('erp-sensitive', (ctx) => {
  const adminId = ctx.auth?.user?.id ?? ctx.request.ip()
  return limiter.allowRequests(10).every('5 minutes').usingKey(`erp_sensitive_${adminId}`)
})