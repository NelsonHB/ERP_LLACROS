# Proyecto ERP + Master Admin (AdonisJS + Docker + PostgreSQL + Redis)

Dos apps AdonisJS (TypeScript) independientes:

- `master-admin/` → API del súper admin/master que controlará el ERP. Puerto **3333**.
- `erp/` → API base del ERP, lista para agregar módulos. Puerto **3334**.

Cada una vive en su propio esquema de PostgreSQL (`master_admin` y `erp` dentro de la misma base `postgres`), y comparte Redis para cache y rate limiting.

**Todo esto ya fue probado de extremo a extremo** (migraciones, signup, login, rate limiting y limpieza automática) contra una instancia real de Postgres + Redis antes de entregarte el proyecto.

---

## 1. Base de datos: PostgreSQL local (no Supabase)

`docker-compose.yml` levanta un contenedor de **PostgreSQL local** (`postgres:16-alpine`) y uno de **Redis local** (`redis:7-alpine`). No depende de internet ni de Supabase — `master-admin/.env` y `erp/.env` ya apuntan a `DB_HOST=postgres` / `REDIS_HOST=redis`, los nombres de los servicios Docker. `DB_SSL=false` porque este Postgres local no tiene SSL activado (importante: no lo cambies a `true` mientras uses la base local, o la conexión falla).

Si en algún futuro quisieras usar Supabase en vez de local, el procedimiento completo (con `DB_SSL=true` y todo lo demás) está en `DOCUMENTACION.md`, sección "Cómo cambiar de Postgres local a Supabase". No es necesario para el uso normal del proyecto.

---

## 2. Seguridad implementada

- **Contraseñas**: hasheadas con `scrypt` (memory-hard, resistente a fuerza bruta por hardware), vía el `Hash` service de Adonis — nunca se guardan en texto plano.
- **Tokens de acceso con expiración**: cada login/signup emite un token que **expira a los 30 días** (antes, por defecto, los tokens de Adonis no expiraban nunca — quedaba un riesgo de seguridad abierto indefinidamente).
- **Rate limiting (anti fuerza-bruta)**, con Redis como store:
  - `POST /api/v1/auth/login`: máx. **5 intentos por minuto** por IP, bloqueo de **5 minutos** si se excede.
  - `POST /api/v1/auth/signup`: máx. **3 registros cada 10 minutos** por IP (anti-spam de cuentas).
  - Resto de la API: **100 requests/minuto** por IP.
  - Probado en vivo: al 5º intento fallido de login consecutivo, la API responde `429 Too many requests` con `retryAfter` en segundos.
- **Rutas protegidas**: `/api/v1/account/*` requiere `Authorization: Bearer <token>` válido (middleware `auth`); sin token responde `401`.
- **CORS** configurable vía `.env` (`CORS_ORIGIN`), para restringir qué frontends pueden llamar a la API.
- **Shield**: cabeceras de seguridad HTTP (protección XSS, sniffing, etc.) activas por defecto vía `@adonisjs/shield`.

---

## 2.2 Interfaz de login (ya incluida en ambas apps)

Tanto `master-admin` como `erp` incluyen una interfaz web mínima funcional (HTML/CSS/JS sin build step, servida directo por AdonisJS). **Tema: blanco y azul, simple** — sin decoraciones, colores básicos.

- **`http://localhost:3333/`** (master-admin) y **`http://localhost:3334/`** (erp) → pantalla de login. Muestra en vivo si el servidor está en línea, envía las credenciales a `/api/v1/auth/login`, y guarda el token.
- **`.../dashboard.html`** en cada una → shell autenticado ("fondo básico"): topbar con el usuario logueado, verifica el token contra la API real al cargar, botón de cerrar sesión, y un lienzo vacío listo para ir agregando los módulos correspondientes.

### Registro de usuarios: solo desde master-admin

**El registro público está deshabilitado en `erp`** (la ruta `POST /api/v1/auth/signup` fue removida — devuelve `404`). Solo `master-admin` puede registrar cuentas. El controlador de signup de `erp` se dejó intacto (comentado en las rutas) para cuando se conecte la autenticación compartida entre ambas apps — ver sección 2.3.

**Cuenta ya creada en `master-admin`** (pruébala apenas levantes el proyecto):
- Correo: `haroldprueba@gmail.com`
- Contraseña: `pruebas123`

> Esta cuenta se creó llamando una vez al endpoint de signup. Si necesitas crear más cuentas de administradores, usa el mismo comando (cambiando los datos):
> ```bash
> curl -X POST http://localhost:3333/api/v1/auth/signup \
>   -H "Content-Type: application/json" \
>   -d '{"fullName":"Nombre","email":"correo@ejemplo.com","password":"tu-password","passwordConfirmation":"tu-password"}'
> ```

Ambas páginas, en ambas apps, ya fueron **probadas de extremo a extremo** con un navegador real (Playwright) contra sus respectivas APIs: signup → login → verificación de token → logout, todo funcionando con datos reales, no simulados.

Es intencionalmente simple (sin framework de frontend, sin build step) para que sirva de base rápida — cuando quieras, se puede migrar a React/Vue o agregar más pantallas sin tocar la API.

---

## 2.3 Usuarios del ERP administrados desde master-admin (ya resuelto)

`master-admin` y `erp` comparten la misma base física de Postgres (solo cambia el esquema: `master_admin` vs `erp`). Aprovechando eso, `master-admin` tiene una **segunda conexión Lucid** (`erp_db` en `config/database.ts`) que apunta directo al esquema `erp`, y con eso un CRUD completo:

- `app/models/erp_user.ts` — modelo sobre la tabla `users` de `erp`, vía la conexión `erp_db`.
- `app/validators/erp_user.ts` — valida al crear (contraseña obligatoria) y al editar (todo opcional, con `filter` para no chocar consigo mismo en la unicidad del correo).
- `app/controllers/erp_users_controller.ts` — `index`, `show`, `store`, `update`, `destroy`.
- Rutas bajo `/api/v1/erp-users`, protegidas con `middleware.auth()`.
- UI en `public/UsuariosErp/index.html` (tabla + formulario de crear/editar), enlazada desde una tarjeta en `dashboard.html`.

Probado de extremo a extremo: un usuario creado desde esta pantalla en `master-admin` pudo loguearse de verdad en `erp` con la contraseña asignada ahí.

**Si el proyecto creciera hacia microservicios** (bases de datos separadas por servicio), este truco de conexión cruzada dejaría de funcionar, y el camino sería que `erp` valide tokens llamando a la API de `master-admin` en vez de tener su propia tabla. No es necesario ahora — el proyecto es pequeño y de crecimiento mediano, no microservicios — pero queda anotado para esa etapa futura.

---

## 3. Cache y limpieza automática (anti-basura en la BD)

- **Redis** configurado como servicio compartido (`config/redis.ts`) — listo para usarlo como cache de consultas frecuentes además del rate limiting.
- **Comando `cleanup:expired-tokens`** (en ambas apps) que borra:
  1. Tokens de acceso **ya vencidos** (`expires_at` en el pasado).
  2. Tokens **nunca usados** con más de 30 días de antigüedad (sesiones que alguien empezó y nunca completó).
- **Servicio `cron-cleanup`** en `docker-compose.yml`: corre ese comando en ambas apps **cada 6 horas**, automáticamente, sin que tengas que acordarte de hacerlo a mano.

Para correrlo manualmente (o probarlo) en cualquier momento:

```bash
docker compose exec master-admin node ace cleanup:expired-tokens
docker compose exec erp node ace cleanup:expired-tokens
```

---

## 2.1 Endpoints de autenticación (ya funcionando)

Ambas apps (`master-admin` en :3333, `erp` en :3334) traen el mismo set de endpoints:

| Método | Ruta                      | Descripción                          | Rate limit |
|--------|---------------------------|---------------------------------------|-----------|
| POST   | `/api/v1/auth/signup`     | Registro (fullName, email, password) | 3 / 10 min |
| POST   | `/api/v1/auth/login`      | Login (email, password)              | 5 / min    |
| GET    | `/api/v1/account/profile` | Perfil del usuario autenticado       | 100 / min  |
| POST   | `/api/v1/account/logout`  | Invalida el token actual             | 100 / min  |

Solo en `master-admin`, además:

| Método | Ruta                       | Descripción                          |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/v1/erp-users`        | Listar usuarios del ERP              |
| GET    | `/api/v1/erp-users/:id`    | Ver un usuario del ERP               |
| POST   | `/api/v1/erp-users`        | Crear un usuario del ERP             |
| PUT    | `/api/v1/erp-users/:id`    | Editar un usuario del ERP            |
| DELETE | `/api/v1/erp-users/:id`    | Eliminar un usuario del ERP          |

Ejemplo de uso real:

```bash
# Registro
curl -X POST http://localhost:3333/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Admin Master","email":"admin@test.com","password":"password123","passwordConfirmation":"password123"}'

# Login
curl -X POST http://localhost:3333/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

# Perfil (usa el token que te devolvió el login)
curl http://localhost:3333/api/v1/account/profile \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 4. Levantar todo con Docker

```bash
docker compose up --build
```

- Master Admin → http://localhost:3333
- ERP → http://localhost:3334
- Postgres local → `localhost:5432` (user/pass: `postgres`/`postgres`, solo para desarrollo)
- Redis local → `localhost:6379`

> **Si ya habías levantado una versión anterior de este proyecto** (antes de tener Redis/rate limiting) y ves errores tipo `Cannot find package '@adonisjs/limiter'`, es porque quedó un volumen viejo de `node_modules` de esa corrida anterior. El entrypoint ya se encarga de reinstalar dependencias en cada arranque, así que basta con:
> ```bash
> docker compose down -v   # -v borra los volúmenes locales (node_modules, datos de Postgres/Redis)
> docker compose up --build
> ```

Correr migraciones dentro de los contenedores:

```bash
docker compose exec master-admin node ace migration:run
docker compose exec erp node ace migration:run
```

---

## 5. Sin Docker (desarrollo local directo)

Necesitas Postgres y Redis corriendo en tu máquina (o cambia `DB_HOST`/`REDIS_HOST` en el `.env` a `127.0.0.1` si los tienes locales fuera de Docker):

```bash
cd master-admin && npm install && npm run dev   # puerto 3333
cd erp && npm install && npm run dev             # puerto 3334
```

---

## 6. Conectarlo a GitHub

1. Crea un repo vacío en https://github.com/new (sin README/gitignore, ya los trae este proyecto).
2. Desde la raíz del proyecto:

```bash
git init
git add .
git commit -m "Estructura inicial: master-admin + erp (AdonisJS) con Docker, Postgres/Redis local, auth y rate limiting"
git branch -M main
git remote add origin https://github.com/<TU_USUARIO>/<TU_REPO>.git
git push -u origin main
```

> Los `.env` reales nunca se suben (están en `.gitignore`). Solo se sube `.env.example` como plantilla. Ojo: en desarrollo local usamos `postgres`/`postgres` como password de la base — cámbialo antes de ir a producción.

---

## 7. Estructura del repo

```
erp-adonis/
├── docker-compose.yml         (Postgres, Redis, master-admin, erp, cron-cleanup)
├── schemas.sql       (crea los esquemas master_admin/erp)
├── .gitignore
├── .github/workflows/ci.yml
├── master-admin/              (puerto 3333, esquema master_admin)
│   ├── Dockerfile
│   ├── .env / .env.example
│   ├── config/database.ts     (Postgres + searchPath + conexión erp_db)
│   ├── config/redis.ts
│   ├── config/limiter.ts      (rate limiting sobre Redis)
│   ├── commands/cleanup_expired_tokens.ts
│   ├── commands/create_user.ts
│   ├── app/controllers/       (signup, login, logout, profile, erp_users)
│   ├── app/models/user.ts     (hash de contraseñas con scrypt)
│   ├── app/models/erp_user.ts (usuarios de erp, vía conexión erp_db)
│   ├── start/routes.ts
│   ├── start/limiter.ts
│   ├── database/migrations/
│   └── public/
│       ├── index.html         (login)
│       ├── dashboard.html     (panel base)
│       ├── css/global.css     (estilos compartidos por todas las páginas)
│       └── UsuariosErp/       (módulo: CRUD de usuarios del ERP)
│           ├── index.html
│           └── styles.css
└── erp/                       (mismo patrón base, puerto 3334, esquema erp)
```

Cada módulo nuevo del panel de `master-admin` debería seguir el mismo patrón que `UsuariosErp/`: su propia carpeta dentro de `public/`, con su HTML y su `styles.css` propio, enlazando siempre `/css/global.css` para lo compartido.

---

## 8. Próximos pasos sugeridos

- En `master-admin`: roles/permisos (ej. `@adonisjs/bouncer`) para diferenciar "master" de otros administradores.
- En `erp`: definir los módulos base como carpetas dentro de `app/` (ej. `app/inventory`, `app/sales`), siguiendo el mismo patrón de carpeta por módulo en `public/` si necesitan interfaz propia.
- Cache de consultas: usar el servicio Redis ya configurado (`import redis from '@adonisjs/redis/services/main'`) para cachear listados pesados o resultados costosos.
- Conectar SaaS externos (pagos, mensajería) como servicios en `app/services/`, con rutas de webhook dedicadas.
