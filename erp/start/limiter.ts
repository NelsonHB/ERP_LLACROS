/*
|--------------------------------------------------------------------------
| Rate limiters de la aplicación
|--------------------------------------------------------------------------
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
