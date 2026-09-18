import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

import {
  throttle,
  throttleLogin,
  throttleSignup,
  throttleSensitiveErpAction,
} from '#start/limiter'


/*
|--------------------------------------------------------------------------
| Rutas públicas
|--------------------------------------------------------------------------
|
| Estas rutas no requieren autenticación.
|
*/


/*
| Ruta principal de la aplicación.
|
| Cuando alguien accede a:
|
|   /
|
| lo redirigimos al frontend.
|
*/
router.get('/', ({ response }) => {
  return response.redirect('/index.html')
})


/*
| Endpoint utilizado para comprobar que el servidor está funcionando.
|
| GET /health
|
| No consulta la base de datos.
| Simplemente confirma que la API está activa.
|
*/
router.get('/health', () => {
  return {
    status: 'online',
  }
})


/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
|
| Todas las rutas que estén dentro de este grupo tendrán:
|
|   /api/v1
|
| como prefijo.
|
| Además, throttle se aplica de manera general a todas las rutas
| de la API para evitar un número excesivo de solicitudes.
|
*/
router
  .group(() => {


    /*
    |--------------------------------------------------------------------------
    | Autenticación
    |--------------------------------------------------------------------------
    |
    | Prefijo:
    |
    |   /api/v1/auth
    |
    | Estas rutas son públicas porque justamente permiten iniciar
    | una sesión o crear una cuenta.
    |
    */
    router
      .group(() => {

        /*
        | POST /api/v1/auth/signup
        |
        | Crea una nueva cuenta.
        |
        | throttleSignup limita específicamente los intentos
        | de registro para evitar abuso.
        |
        */
        router
          .post('/signup', [controllers.NewAccount, 'store'])
          .use(throttleSignup)


        /*
        | POST /api/v1/auth/login
        |
        | Comprueba las credenciales del usuario y genera
        | las credenciales/token necesarias para acceder
        | a las rutas protegidas.
        |
        | throttleLogin limita los intentos de inicio de sesión
        | para dificultar ataques de fuerza bruta.
        |
        */
        router
          .post('/login', [controllers.AccessTokens, 'store'])
          .use(throttleLogin)

      })
      .prefix('/auth')
      .as('auth')


    /*
    |--------------------------------------------------------------------------
    | Cuenta del usuario autenticado
    |--------------------------------------------------------------------------
    |
    | Prefijo:
    |
    |   /api/v1/account
    |
    | A diferencia de /auth, estas rutas están protegidas.
    |
    | middleware.auth() comprueba que la petición tenga una
    | autenticación válida.
    |
    */
    router
      .group(() => {

        /*
        | GET /api/v1/account/profile
        |
        | Obtiene información del usuario que actualmente
        | está autenticado.
        |
        */
        router
          .get('/profile', [controllers.Profile, 'show'])
          .as('profile')


        /*
        | POST /api/v1/account/logout
        |
        | Cierra la sesión del usuario.
        |
        */
        router
          .post('/logout', [controllers.AccessTokens, 'destroy'])
          .as('logout')

      })
      .prefix('/account')
      .as('account')
      .use(middleware.auth())


    /*
    |--------------------------------------------------------------------------
    | Usuarios del ERP
    |--------------------------------------------------------------------------
    |
    | Prefijo:
    |
    |   /api/v1/erp-users
    |
    | Este grupo representa el CRUD de usuarios que utilizarán
    | el ERP.
    |
    | IMPORTANTE:
    |
    | Estas rutas están protegidas por middleware.auth().
    |
    | Por lo tanto, un usuario debe autenticarse primero mediante:
    |
    |   POST /api/v1/auth/login
    |
    | y posteriormente podrá acceder a estas rutas utilizando
    | sus credenciales de autenticación.
    |
    */
    router
      .group(() => {

        /*
        | GET /api/v1/erp-users
        |
        | Obtiene la lista de usuarios del ERP.
        |
        | Controlador:
        |   ErpUsersController.index()
        |
        */
        router
          .get('/', [controllers.ErpUsers, 'index'])
          .as('index')


        /*
        | GET /api/v1/erp-users/:id
        |
        | Obtiene un usuario específico.
        |
        | Ejemplo:
        |
        |   GET /api/v1/erp-users/15
        |
        | :id = 15
        |
        */
        router
          .get('/:id', [controllers.ErpUsers, 'show'])
          .as('show')


        /*
        | POST /api/v1/erp-users
        |
        | Crea un nuevo usuario dentro del ERP.
        |
        */
        router
          .post('/', [controllers.ErpUsers, 'store'])
          .as('store')


        /*
        | PUT /api/v1/erp-users/:id
        |
        | Actualiza un usuario existente.
        |
        | Ejemplo:
        |
        |   PUT /api/v1/erp-users/15
        |
        */
        router
          .put('/:id', [controllers.ErpUsers, 'update'])
          .as('update')
        router
          .patch('/:id/reset-password', [controllers.ErpUsers, 'resetPassword'])
          .as('resetPassword')
          .use(throttleSensitiveErpAction)


        /*
        | DELETE /api/v1/erp-users/:id
        |
        | Elimina un usuario existente.
        |
        | Ejemplo:
        |
        |   DELETE /api/v1/erp-users/15
        |
        */
        router
          .delete('/:id', [controllers.ErpUsers, 'destroy'])
          .as('destroy')
          .use(throttleSensitiveErpAction)

      })
      .prefix('/erp-users')

      /*
      | Nombre interno del grupo de rutas.
      |
      | No modifica la URL.
      | Solamente sirve para identificar las rutas dentro
      | del sistema de routing de AdonisJS.
      |
      */
      .as('erpUsers')

      /*
      | PROTECCIÓN
      |
      | Todas las rutas del CRUD requieren autenticación.
      |
      | Sin una autenticación válida:
      |
      |   GET    /erp-users
      |   GET    /erp-users/:id
      |   POST   /erp-users
      |   PUT    /erp-users/:id
      |   DELETE /erp-users/:id
      |
      | no deberían poder ejecutarse.
      |
      */
      .use(middleware.auth())

  })

  /*
  | Prefijo general de toda la API.
  |
  | Por eso:
  |
  |   /auth/login
  |
  | termina siendo:
  |
  |   /api/v1/auth/login
  |
  | y:
  |
  |   /erp-users
  |
  | termina siendo:
  |
  |   /api/v1/erp-users
  |
  */
  .prefix('/api/v1')

  /*
  | Protección general contra exceso de solicitudes.
  |
  | Se aplica a todas las rutas que están dentro de /api/v1.
  |
  | Esto es independiente de middleware.auth().
  |
  | throttle      = limita cantidad de peticiones
  | middleware.auth = comprueba autenticación
  |
  */
  .use(throttle)