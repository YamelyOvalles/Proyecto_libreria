# Librería Quisqueya — Fase 4

Proyecto de Desarrollo de Aplicaciones Web ISW-306. La interfaz utiliza HTML, CSS y JavaScript; el servidor utiliza Express 5. Supabase proporciona autenticación, PostgreSQL, Storage y la función administrativa `bright-action`.

## Requisitos

Instala Git, Node.js 22 o superior y Docker Desktop con contenedores Linux. Abre Docker Desktop antes de continuar. Necesitas internet para descargar las dependencias y las imágenes en la primera instalación.

La aplicación se verificó en Windows con Node 24.19.0, npm 11.17.0, Docker 29.8.2 y WSL 2. Los paquetes instalados fueron Express 5.2.1, Supabase JS 2.117.2 y Supabase CLI 2.120.0; la base local ejecutó PostgreSQL 17.11. `npm ci` instala las versiones del archivo package-lock.json.

En Windows usa PowerShell y los comandos `npm.cmd` y `npx.cmd` que aparecen abajo. En Linux o macOS usa `npm` y `npx`.

## Primera instalación

La opción local instala un backend propio para la evaluación. No requiere acceso al proyecto remoto del equipo ni modifica su base de datos.

Comprueba primero que Docker esté funcionando:

```powershell
docker info
```

Después ejecuta:

```powershell
git clone --branch fase-4-despliegue https://github.com/YamelyOvalles/Proyecto_libreria.git
cd Proyecto_libreria
npm.cmd ci
npx.cmd supabase start
npm.cmd run local:config
npm.cmd run demo:seed
```

La primera descarga puede tardar varios minutos. Supabase carga automáticamente **database/database.sql**, el único instalador de la base. El profesor no debe ejecutar otros archivos SQL ni crear un administrador manualmente.

`local:config` crea server/.env.local y scripts/.env.demo con las claves de esta instalación local. Ambos archivos están ignorados por Git. Conserva los archivos que ya existan: el script se niega a sobrescribirlos y no cambia server/.env.

## Iniciar la aplicación

Abre dos terminales en la carpeta Proyecto_libreria y mantenlas abiertas.

En la primera inicia la función administrativa:

```powershell
npx.cmd supabase functions serve bright-action --no-verify-jwt
```

En la segunda inicia Express:

```powershell
npm.cmd run start:local
```

Abre **http://localhost:3000**. Usa esta dirección para que los enlaces de recuperación coincidan con la configuración de autenticación.

La función `bright-action` es necesaria para crear y eliminar usuarios y para eliminar productos desde el panel. Aunque el comando desactiva la comprobación automática del gateway, la función valida internamente la sesión, el perfil activo y el rol administrador antes de ejecutar cualquier operación.

## Cuentas para probar

La contraseña demo se genera al ejecutar `local:config` y queda como `DEMO_PASSWORD` en `scripts/.env.demo`, ignorado por Git. Consúltala localmente sin compartirla. En instalaciones existentes define allí una contraseña nueva de al menos 12 caracteres y ejecuta `npm.cmd run demo:seed` para rotarla.

- admin@demo.local: administrador, con acceso a todos los módulos.
- empleado@demo.local: pedidos, inventario y documentos.
- cliente@demo.local: catálogo, carrito y compras.
- otro@demo.local: segundo cliente para comprobar aislamiento.
- inactivo@demo.local: cuenta que debe recibir rechazo de acceso.

El instalador incluye cuatro libros, autores, categorías, inventario y una sucursal. `demo:seed` crea las cuentas y agrega tres pedidos ficticios, cotizaciones, una factura y un mensaje. Se puede repetir sin duplicar estos ejemplos. Las credenciales son exclusivamente locales.

Prueba login, carrito y compra como cliente; procesa el pedido como empleado y revisa sus documentos. Como administrador puedes crear un producto, subir una portada y editarlo. Los productos con historial se desactivan al eliminarlos para conservar ventas y movimientos.

## Base de datos, archivos y correos

Todo el esquema de la aplicación está en **database/database.sql**: 24 tablas, funciones, índices, triggers, permisos, políticas RLS, bucket de portadas y datos iniciales. Supabase aporta los servicios y esquemas de Auth y Storage. Las cuentas demo se crean con el script porque pertenecen a Auth.

El SQL se concilió con las exportaciones recibidas del remoto. Se corrigieron permisos de cuentas inactivas, restricciones antiguas incompatibles, bloqueo del checkout, coherencia de ITBIS y borrado de productos sin historial. Las exportaciones y el SQL de regresión se conservan en tests/fixtures únicamente para pruebas; no son pasos de instalación. No ejecutes el instalador completo sobre una base existente.

Las portadas iniciales están en assets/portadas. El SQL configura el bucket `portadas` para imágenes JPEG, PNG y WebP de hasta 5 MiB; solo un administrador activo puede escribir. La configuración local permite registrarse sin confirmar correo y utiliza Mailpit para recibir correos de recuperación:

- Base de datos y administración local: http://127.0.0.1:54323
- Buzón de correos local: http://127.0.0.1:54324

Google OAuth está deshabilitado. La analítica opcional está deshabilitada para evitar depender del puerto TCP de Docker; esto no impide los flujos de la aplicación.

## Detener y volver a iniciar

Detén Express y la función con Ctrl+C en sus terminales. Después ejecuta:

```powershell
npx.cmd supabase stop
```

En la siguiente sesión ejecuta `npx.cmd supabase start` y vuelve a iniciar las dos terminales. Los datos se conservan. No repitas `local:config` si sus archivos ya existen.

Para borrar y reinstalar deliberadamente **solo la base local**, detén Express y la función, ejecuta `npx.cmd supabase db reset --local` y luego `npm.cmd run demo:seed`. Este reset elimina los datos locales; no forma parte del arranque normal.

## Pruebas

Las pruebas ejecutadas y sus límites están en [evidencias/fase-4-pruebas.md](evidencias/fase-4-pruebas.md). Pasaron 32 pruebas aisladas, 12 de integración y 5 de navegador con servicios locales reales.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run db:audit
npm.cmd run verify:install
```

Para probar Auth, roles, CRUD, Storage, pedidos y Edge, mantén Supabase y bright-action activos:

```powershell
npm.cmd run test:integration
```

Para las pruebas de navegador detén Express: la prueba abre su propio servidor en el puerto 3000. Mantén Supabase y bright-action activos.

```powershell
npx.cmd playwright install chromium
npm.cmd run test:browser:local
```

Estas pruebas también recorren checkout, cotización, PDF y recuperación por correo local. Agregan datos ficticios a la base local. Los resultados de navegador se guardan en test-results, ignorado por Git. Para revisar tipos de la función por separado, instala Deno y ejecuta `npm.cmd run test:edge`; se verificó con Deno 2.9.7.

## Organización de Express

server/app.js construye la aplicación y server/index.js la inicia. server/config.js valida la configuración; server/routes contiene las rutas; server/controllers coordina las solicitudes; server/middleware valida sesiones y maneja errores; server/services accede a Supabase.

El navegador confirma compras mediante **POST /api/pedidos**. Express valida la sesión, el perfil activo y los campos recibidos, y llama a la RPC PostgreSQL con el JWT del usuario. La RPC calcula precios y confirma stock, pedido y cotización en una transacción. Así se evita duplicar reglas comerciales y se mantienen los permisos de Supabase.

Supabase Auth verifica la identidad; Express administra la sesión de aplicación con `express-session`. El navegador utiliza `/api/supabase` para Auth, REST, RPC, portadas y bright-action. Express verifica el perfil activo, el rol y el origen, y envía a Supabase el JWT guardado en el servidor. RLS protege las filas y las RPC mantienen las transacciones existentes. bright-action conserva la API Admin exclusivamente en Supabase.

La cookie `lq.sid` es HttpOnly y SameSite=Lax; usa Secure con HTTPS y obligatoriamente en producción. El identificador se regenera al autenticar. La sesión caduca a los 30 minutos sin actividad y tiene un máximo absoluto de ocho horas; los tokens se renuevan solo en el servidor. Logout destruye la sesión propia incluso si Supabase no está disponible. El SDK recibe valores de compatibilidad sin capacidad de acceso a Supabase y los conserva únicamente en memoria. No se guardan contraseñas ni JWT reales en Storage del navegador. Las portadas públicas pueden seguir descargándose directamente del proveedor.

Las solicitudes que modifican datos deben llevar `X-Libreria-Request: 1`; se rechazan orígenes ajenos y no se habilita CORS. Helmet aplica CSP y otros encabezados. El acceso a `/admin` y `/documento`, con o sin extensión, también se verifica en Express. La autorización por fila de los documentos sigue correspondiendo a RLS.

### Almacén de sesiones y migración incremental

En desarrollo, sin `SESSION_DATABASE_URL`, se permite MemoryStore: reiniciar Express cierra las sesiones y el secreto temporal cambia. Para conservarlas entre reinicios, configura `SESSION_SECRET` aleatorio (mínimo 32 caracteres) y `SESSION_DATABASE_URL` privados en `server/.env.local`. Utiliza la conexión PostgreSQL de tu pila local, no una clave de la API. Después ejecuta:

```powershell
npm.cmd run sessions:migrate -- --local
```

La migración `database/migrations/20261021_application_sessions.sql` crea solamente la tabla de sesiones y su índice, activa RLS y revoca el acceso a los roles públicos. No reinstala la base ni modifica las tablas existentes. Es repetible. Requiere un propietario de PostgreSQL; el usuario del almacén necesita SELECT, INSERT, UPDATE y DELETE en esa tabla. Restringe las credenciales de conexión a ese uso cuando prepares producción.

En producción, incluidas las funciones de Vercel, **ambas variables son obligatorias**; el servidor se niega a utilizar MemoryStore. Configura la conexión privada con TLS verificado, aplica la migración con `npm.cmd run sessions:migrate` sobre el destino seleccionado y ejecuta detrás de un proxy HTTPS confiable. Se confía en un salto de proxy. El limitador de intentos es por proceso; un despliegue con varias instancias requiere un almacén compartido para un límite global.

Para desarrollo con la configuración local y el comando solicitado:

```powershell
$env:LIBRERIA_ENV_FILE='.env.local'
npm.cmd run dev
```

El informe de esta revisión, la comparación con la Fase 3, los archivos modificados y los límites de las pruebas están en [evidencias/mejoras-arquitectura-sesiones.md](evidencias/mejoras-arquitectura-sesiones.md). Para comprobar el almacén PostgreSQL local entre instancias usa `npm.cmd run test:sessions:local`; esta prueba aplica únicamente la migración aditiva de sesiones a la pila local.

Express no trae un contenedor de inyección de dependencias. La aplicación pasa configuración y gateway explícitamente a sus componentes, lo que permite probarlos sin agregar uno artificial.

## Uso remoto o despliegue

Para la evaluación utiliza la opción local. `npm start` usa server/.env o las variables del host y puede conectarse a un Supabase remoto. server/.env.example contiene la plantilla: SUPABASE_URL, SUPABASE_ANON_KEY pública y PORT. Un proyecto remoto nuevo debe instalar database/database.sql y configurar Auth, redirecciones y correo por separado.

Para desplegar bright-action en un proyecto autorizado:

```powershell
npx.cmd supabase login
npx.cmd supabase functions deploy bright-action --project-ref TU_PROJECT_REF --no-verify-jwt
```

Supabase proporciona las variables administrativas dentro de la función. Nunca copies service_role o claves secretas a Express, HTML, JavaScript público o Git. Los ejemplos .env contienen solo marcadores. Evita compartir la salida de `supabase status`, porque puede mostrar claves.

Para un host Node configura las variables públicas, ejecuta `npm ci --omit=dev` y `npm start`. También se conserva la entrada Express para Vercel en api/index.js. El despliegue de producción y la configuración privada del remoto no están verificados. No se ha fusionado un PR ni creado v4.0.

## Si algo falla

- **Docker no arranca en Windows:** ejecuta `wsl --version`. Si falta WSL, abre PowerShell como administrador y ejecuta `wsl --install --no-distribution`; completa el proceso, reinicia si Windows lo solicita y abre Docker Desktop.
- **Puerto ocupado:** detén la otra aplicación que use 3000 o los puertos 54320–54324. Antes de test:browser:local detén tu Express.
- **local:config dice que el archivo existe:** conserva la configuración y continúa con demo:seed o start:local.
- **Error al crear usuarios o eliminar productos:** comprueba que la terminal de bright-action siga activa.
- **401 o 403:** vuelve a iniciar sesión y comprueba que el perfil esté activo y tenga el rol necesario.
- **No encuentras el correo de recuperación:** abre el buzón local indicado arriba y usa localhost:3000 para la web.
- **Playwright no encuentra el navegador:** ejecuta `npx.cmd playwright install chromium`.

## Integrantes del equipo

| Nombre completo | Matrícula |
| --- | --- |
| Yamely Mercedes Ovalles | 100077467 |
| Ezequiel Vicente Medina | 100044311 |
| Adaury Ramón Cerda Morrobel | 100070698 |
| José Alfredo Fortuna Taveras | 100055564 |
| Eudy Rafael Gómez Martínez | 100078755 |
| Erwin Enrique Tavárez Torres | 100020186 |
| Adams Osvaldo De León Peña | 100076562 |
| Melvin José Luis Peña Rodríguez | 100080338 |
