/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { throttle, throttleLogin } from '#start/limiter'

router.get('/', ({ response }) => {
  return response.redirect('/index.html')
})

router.get('/health', () => {
  return { status: 'online' }
})

router
  .group(() => {
    router
      .group(() => {
        // El registro está deshabilitado a propósito: los usuarios que
        // pueden operar el ERP se crean únicamente desde master-admin,
        // no aquí. Ver NewAccountController para más contexto.
        router.post('login', [controllers.AccessTokens, 'store']).use(throttleLogin)
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
  .use(throttle)
