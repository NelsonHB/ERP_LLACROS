# Documentación del proyecto: Master Admin + ERP (AdonisJS, Docker, PostgreSQL, Redis)

## Qué es este proyecto

Son dos aplicaciones separadas, escritas en AdonisJS (TypeScript, corre sobre Node.js):

La primera se llama master-admin. Es el panel de control central. Ahí se registran las cuentas de las personas que van a poder usar el ERP. Corre en el puerto 3333.

La segunda se llama erp. Es la base del sistema operativo del ERP, donde más adelante se irán agregando los módulos (inventario, ventas, compras, etc). Corre en el puerto 3334.

Las dos comparten la misma base de datos PostgreSQL, pero cada una tiene su propio esquema dentro de esa base, para que sus tablas no se mezclen: master-admin usa el esquema llamado master_admin, y erp usa el esquema llamado erp.

## Estructura de carpetas

En la raíz del proyecto hay un archivo docker-compose.yml que levanta todos los servicios juntos: la base de datos, Redis, las dos aplicaciones, y un servicio de limpieza automática.

También está el archivo schemas.sql, que crea los dos esquemas (master_admin y erp) dentro de la base de datos. Con Postgres local esto ocurre solo, automáticamente, la primera vez que se levanta el contenedor. Solo hace falta correrlo a mano si más adelante decides usar una base externa, como Supabase.

Dentro de master-admin y de erp hay, cada una, su propio Dockerfile, su archivo .env con la configuración, y una carpeta public con las páginas de login y del panel.

## Requisitos para levantarlo

Necesitas tener Docker y Docker Compose instalados en tu máquina. Todo lo demás (Node, las dependencias de cada aplicación, Postgres, Redis) corre dentro de los contenedores, no hace falta instalarlo aparte.

## Cómo levantar todo

Desde la carpeta raíz del proyecto, corres el comando docker compose up --build. Esto va a construir las imágenes y levantar cinco servicios: la base de datos Postgres, Redis, master-admin, erp, y el servicio de limpieza automática.

La primera vez que levantas cada aplicación, el contenedor hace tres cosas en orden, automáticamente, sin que tengas que intervenir: instala las dependencias (npm install), y luego construye la base de datos, aplicando todas las migraciones pendientes (la tabla de usuarios y la de tokens de acceso quedan creadas solas, dentro del esquema que le corresponde a cada aplicación). Recién después de eso arranca el servidor. Esto también significa que cada vez que agregues una migración nueva en el futuro, no hace falta correrla a mano: se aplica sola la próxima vez que levantes los contenedores.

Cuando termine, puedes entrar a estas direcciones desde tu navegador:

master-admin queda en http://localhost:3333

erp queda en http://localhost:3334

Si alguna vez ves un error que dice que no encuentra algún paquete (por ejemplo Cannot find package), lo más probable es que haya quedado un volumen viejo de una corrida anterior. Se soluciona corriendo docker compose down -v y después otra vez docker compose up --build. El -v borra los volúmenes viejos, incluyendo los datos de Postgres y Redis locales de desarrollo (no afecta nada si usas Supabase).

## La base de datos: cómo está configurada ahora

Por defecto, el proyecto usa un Postgres que corre dentro de un contenedor local, definido en el propio docker-compose.yml. No depende de internet ni de Supabase para que puedas desarrollar. El usuario y la contraseña de ese Postgres local son ambos la palabra postgres, y solo sirven para desarrollo en tu máquina, no para producción.

Dentro de cada aplicación, en el archivo .env, vas a encontrar dos bloques de variables relacionadas con la base de datos. Uno está activo y es el que apunta al Postgres local. El otro está comentado (con el símbolo numeral delante de cada línea) y es el que apuntaría a Supabase.

## Cómo cambiar de Postgres local a Supabase

Este es el procedimiento completo, paso por paso.

Primero necesitas los datos reales de conexión de tu proyecto de Supabase. Entras al panel de Supabase, vas a Project Settings, luego a Database, y ahí buscas la sección Connection string. Elige el modo llamado Transaction pooler, porque es el que mejor funciona para este tipo de aplicaciones. Ahí vas a ver el host, el puerto, el usuario y vas a necesitar también la contraseña de tu base de datos (la que pusiste cuando creaste el proyecto en Supabase, o la puedes resetear ahí mismo si no la recuerdas).

Segundo, abres el archivo .env dentro de la carpeta master-admin. Vas a ver un bloque de líneas que dice Opción A, que es el que está activo ahora mismo, apuntando a postgres como host. Le pones el símbolo numeral delante de cada una de esas líneas para desactivarlas, incluyendo la línea DB_SSL=false. Justo debajo hay otro bloque que dice Opción B, con las variables de Supabase, pero comentadas, incluyendo una línea DB_SSL=true. Le quitas el símbolo numeral a esas líneas para activarlas, y reemplazas los valores de ejemplo por los datos reales que sacaste de tu panel de Supabase: el host, el puerto, el usuario, y la contraseña.

Ese DB_SSL es importante y no se debe pasar por alto: Supabase exige que la conexión vaya cifrada (SSL), pero el Postgres local de este proyecto no lo tiene activado. Por eso existe esa variable, para prender o apagar el cifrado según cuál de las dos bases estés usando. Si usas Supabase con DB_SSL en false, la conexión falla. Si usas el Postgres local con DB_SSL en true, la conexión también falla, porque el servidor local no sabe hablar ese protocolo cifrado.

Tercero, repites exactamente el mismo paso pero en el archivo .env que está dentro de la carpeta erp.

Cuarto, abres el archivo docker-compose.yml que está en la raíz del proyecto, y ahí quitas o comentas el bloque completo del servicio llamado postgres, ya que al usar Supabase no hace falta correr una base de datos local.

Quinto, entras al panel de Supabase, a la sección SQL Editor, y ahí pegas y corres el contenido completo del archivo schemas.sql que está en la raíz del proyecto. Esto crea los dos esquemas (master_admin y erp) dentro de tu base de Supabase, igual que se crean automáticamente en el Postgres local.

Sexto, vuelves a correr docker compose up --build, y desde ese momento ambas aplicaciones van a estar guardando y leyendo los datos directamente desde Supabase, en vez de la base local.

Un detalle importante: la contraseña real de tu base de datos nunca se debe subir a GitHub. El archivo .env ya está excluido en el .gitignore por esa razón. Lo único que se sube al repositorio es un archivo de ejemplo, sin contraseñas reales.

## Seguridad que ya está implementada

Las contraseñas de los usuarios nunca se guardan en texto plano. Se guardan pasadas por un algoritmo llamado scrypt, que hace que sea extremadamente difícil de revertir incluso si alguien llegara a robar la base de datos.

Cada vez que alguien inicia sesión o se registra, se le entrega un token de acceso. Ese token ahora tiene una fecha de vencimiento de 30 días. Antes, por defecto, los tokens de esta tecnología no vencían nunca, lo cual era un riesgo de seguridad. Ahora, después de 30 días, ese token deja de funcionar automáticamente.

Hay un límite de intentos para evitar que alguien intente adivinar contraseñas a la fuerza. En el login, solo se permiten 5 intentos por minuto desde la misma dirección de internet, y si se supera ese límite, se bloquea por 5 minutos. Esto ya fue probado en vivo: al quinto intento seguido con una contraseña incorrecta, el sistema responde que hay demasiados intentos y hay que esperar.

Las rutas que muestran información del usuario logueado, o que permiten cerrar sesión, están protegidas: si alguien intenta acceder sin un token válido, el sistema responde que no está autorizado.

## Cache y limpieza automática de la base de datos

Redis está configurado en ambas aplicaciones y sirve, por ahora, principalmente para dos cosas: guardar el conteo de los intentos de login (para el límite de intentos que se explicó arriba), y quedar disponible como cache para cuando se necesite acelerar consultas pesadas más adelante.

Para que la base de datos no vaya acumulando basura con el tiempo, existe un comando que borra automáticamente los tokens de acceso que ya vencieron, y también los tokens que nunca se llegaron a usar y que tienen más de 30 días de creados (que normalmente son sesiones que alguien empezó y nunca terminó).

Ese comando se ejecuta solo, automáticamente, cada 6 horas, gracias a un servicio dentro del docker-compose.yml llamado cron-cleanup. No hace falta que nadie lo corra a mano, aunque si quieres correrlo manualmente en cualquier momento para revisar que funciona, el comando es node ace cleanup:expired-tokens, ejecutado dentro del contenedor correspondiente.

## La interfaz de login y el panel base

Ambas aplicaciones, master-admin y erp, tienen ya una interfaz web funcional, hecha en HTML, CSS y JavaScript simple, sin necesidad de instalar ningún framework de frontend ni de compilar nada. Se sirve directamente desde el propio servidor de AdonisJS.

El estilo visual es blanco con azul, simple, sin decoraciones ni colores oscuros, como se pidió. Todo el CSS compartido entre páginas vive en un solo archivo (master-admin/public/css/global.css), en vez de estar repetido dentro de cada HTML. Cualquier página nueva que se agregue más adelante debe enlazar ese archivo en vez de escribir su propio bloque de estilos desde cero.

Cuando entras a la dirección raíz de cualquiera de las dos aplicaciones, ves la pantalla de login. Ahí hay un indicador que dice si el servidor está conectado, que es real, no decorativo: hace una consulta de verdad al servidor para confirmarlo.

Una vez que inicias sesión correctamente, te lleva a una pantalla base (el panel), donde se ve el nombre y correo de la persona que inició sesión, un botón para cerrar sesión, y tarjetas que llevan a los distintos módulos de administración.

Cada módulo nuevo del panel vive en su propia carpeta dentro de master-admin/public/, para no mezclar todo en un mismo lugar. El primero de estos módulos es "UsuariosErp", que se explica en la siguiente sección.

## Administrar los usuarios del ERP desde master-admin (ya funciona)

Como master-admin y erp comparten la misma base de datos física de Postgres (solo cambia el esquema), master-admin puede administrar directamente la tabla de usuarios de erp, sin pasar por internet ni por ninguna llamada entre servidores.

Esto quedó implementado como un CRUD completo:

En el backend, dentro de master-admin, hay una segunda conexión a la base de datos (llamada erp_db) que apunta al esquema erp en vez de al esquema master_admin. Sobre esa conexión hay un modelo, un validador y un controlador que permiten listar, crear, editar y borrar usuarios de erp. Las rutas quedan bajo /api/v1/erp-users, protegidas: hace falta haber iniciado sesión en master-admin para usarlas.

En el frontend, dentro de master-admin/public/UsuariosErp/, hay una página completa para esto: una tabla con todos los usuarios del ERP, un botón para crear uno nuevo, y botones de editar y eliminar en cada fila. Se llega a ella desde una tarjeta en el panel principal.

Esto ya se probó de punta a punta: se creó un usuario desde esta pantalla en master-admin, y ese mismo usuario pudo iniciar sesión de verdad en erp, con la contraseña que se le puso desde master-admin.

## Sobre el registro de usuarios

En master-admin, el registro de cuentas está abierto: cualquiera que sepa el endpoint correspondiente puede crear una cuenta ahí, llamando a la dirección /api/v1/auth/signup. Estas son las cuentas de los administradores que manejan el sistema (no las de quienes usan el ERP día a día).

En erp, el registro de cuentas está cerrado a propósito. Si alguien intenta registrarse ahí directamente, el sistema responde que esa dirección no existe. Las cuentas que pueden usar el ERP se crean únicamente desde el módulo "Usuarios del ERP" dentro de master-admin, explicado arriba.

## Credenciales actuales

Estas cuentas se crean llamando a los endpoints o usando la pantalla de master-admin; no vienen ya cargadas en una base de datos nueva (una base recién creada empieza vacía). Como referencia, las credenciales usadas durante el desarrollo fueron:

Para master-admin (cuenta de administrador, se crea con /api/v1/auth/signup o con el comando de terminal): correo harold@gmail.com, contraseña prueba123.

Para erp (cuenta de un usuario del ERP, se crea desde el módulo "Usuarios del ERP" dentro de master-admin, o con el comando de terminal apuntando al contenedor de erp): correo james@gmail.com, contraseña james123.

Si levantas el proyecto desde cero, ninguna de las dos existe todavía: hay que crearlas una vez, de cualquiera de las dos formas mencionadas.

## Cómo crear usuarios desde la terminal, sin exponer nada a internet

Ahora existe un comando en las dos aplicaciones para crear cuentas directamente desde la terminal del servidor, sin pasar por ninguna dirección web pública. Aplica exactamente las mismas reglas de seguridad que el registro normal: valida que el correo no esté repetido, exige contraseña de entre 8 y 32 caracteres, y guarda la contraseña siempre hasheada con scrypt, nunca en texto plano.

Para crear una cuenta en master-admin, entrando primero al contenedor con docker compose exec master-admin sh, o corriéndolo directo desde fuera con docker compose exec master-admin, el comando completo es node ace user:create.

Si lo corres sin ponerle nada más, el comando te va preguntando el nombre completo, el correo, la contraseña y la confirmación de la contraseña, una cosa a la vez, y la contraseña no se muestra en pantalla mientras la escribes.

También se puede correr todo en una sola línea, pasándole los datos directamente, lo cual es útil para scripts: docker compose exec master-admin node ace user:create con las opciones --full-name, --email y --password, cada una con su valor entre comillas.

Para crear una cuenta en erp, es exactamente el mismo comando, pero apuntando al otro contenedor: docker compose exec erp node ace user:create.

Si intentas crear una cuenta con un correo que ya existe, el comando no la crea y te explica cuál fue el problema, en vez de dejar datos a medias o duplicados.

Este comando reemplaza, por ahora, la forma de crear cuentas para erp, ya que el registro público de erp está cerrado a propósito, como se explicó antes.

## Problemas ya resueltos, por si aparecen mensajes parecidos

Si en algún momento ves en los logs un mensaje que dice algo como The server does not support SSL connections, ya está resuelto en la versión actual del proyecto: el archivo de configuración de la base de datos ahora respeta una variable llamada DB_SSL, que va en false para el Postgres local y en true para Supabase. Si ves ese error, revisa que esa variable esté en el valor correcto según cuál base estés usando.

Si ves un mensaje que dice Invalid URL viniendo del servicio de limpieza automática (cron-cleanup), también ya está resuelto: era un problema que aparecía cuando el archivo .env se guardaba con saltos de línea de Windows en vez de saltos de línea de Linux, y el símbolo invisible de más rompía las variables de entorno. El servicio de limpieza ahora limpia ese símbolo automáticamente antes de leer el archivo, así que no debería volver a pasar, pero si edita el .env con un editor de texto en Windows y algún día reaparece, esa es la causa.

## Sobre crecer hacia microservicios más adelante

El CRUD de usuarios del ERP funciona hoy porque master-admin y erp comparten la misma base de datos física — es la solución correcta para el tamaño actual del proyecto (una app pequeña, en desarrollo, con un crecimiento mediano proyectado, no microservicios todavía).

Si en el futuro la aplicación creciera mucho y cada parte terminara en su propio servidor o base de datos separada, este truco de la segunda conexión dejaría de funcionar, porque ya no habría una sola base física a la que conectarse. En ese escenario, el camino sería que erp deje de tener su propia tabla de usuarios y en su lugar le pregunte a master-admin, por una llamada de API, si un token es válido. Eso es lo típico en arquitecturas de microservicios. No hace falta construir eso ahora: se deja anotado para cuando realmente haga falta.

## Cómo conectar el proyecto a GitHub

Primero entras a GitHub y creas un repositorio nuevo, vacío, sin agregarle README ni archivo de licencia (ya vienen incluidos en este proyecto).

Después, desde la carpeta raíz del proyecto en tu computadora, corres estos comandos en orden: git init, luego git add punto, luego git commit con un mensaje describiendo el estado inicial, luego git branch menos M main, luego git remote add origin y la dirección de tu repositorio, y por último git push menos u origin main.

Los archivos .env, que contienen las contraseñas reales, nunca se suben, porque ya están excluidos en el archivo .gitignore. Lo que sí se sube es el archivo de ejemplo, sin datos sensibles.

## Comandos útiles del día a día

Para correr las migraciones de la base de datos a mano (por ejemplo, si agregaste una nueva y no quieres reiniciar el contenedor completo) dentro de cada aplicación ya levantada con Docker, el comando es docker compose exec, seguido del nombre del servicio (master-admin o erp), seguido de node ace migration:run. Aunque, como se explicó antes, esto ya ocurre automáticamente cada vez que el contenedor arranca.

Para correr manualmente la limpieza de tokens vencidos, el comando es el mismo pero con node ace cleanup:expired-tokens al final.

Para ver los mensajes que va imprimiendo cada aplicación mientras corre, el comando es docker compose logs, seguido del nombre del servicio, y opcionalmente agregando menos f al final para que se quede viendo los mensajes nuevos en tiempo real.
