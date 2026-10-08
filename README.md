# Librería Quisqueya — Fase 4

Aplicación académica de Desarrollo de Aplicaciones Web ISW-306. Conserva HTML, CSS, JavaScript y Express 5. Supabase proporciona Auth, PostgreSQL, Storage y la Edge Function `bright-action`. El servidor Express también participa en la confirmación de pedidos.

**Estado:** implementación y pruebas aisladas disponibles; validación completa de Supabase local pendiente en esta máquina por falta de Docker. Consulta [la evidencia de pruebas](evidencias/fase-4-pruebas.md). Este README no es el informe final académico. Integrantes y matrículas: pendientes de confirmación. No se atribuyen aportes individuales.

## Requisitos y versiones

| Componente | Versión verificada aquí | Requisito |
| --- | --- | --- |
| Node.js | 24.19.0 | >=22; el SDK actual de Supabase requiere Node 22 |
| npm | 11.17.0 | Usar `npm ci` con el lockfile |
| Express | 5.2.1 | Express 5, resuelto por package-lock.json |
| dotenv | 17.4.2 | Resuelto por package-lock.json |
| Supabase JS | 2.117.2 | Fijado para Node, navegador y Edge Function |
| Supabase CLI | 2.120.0 | Dependencia de desarrollo; ejecutar con `npx supabase` |
| Deno | 2.9.7 | Solo para comprobar tipos de la Edge Function fuera de la pila local |
| Playwright | 1.64.0 | Pruebas de navegador |
| PGlite | 0.5.8 / PostgreSQL 18.3 WASM | Pruebas SQL aisladas; no sustituye Auth ni Storage HTTP |
| PostgreSQL de Supabase local | 17 configurado | Pendiente de ejecución en Docker |
| Docker Desktop / Docker Engine | No instalado en esta máquina | Necesario para la pila Supabase local completa |

Se verificaron los paquetes instalados, no se afirma haber probado todas las versiones mínimas. El SDK del navegador se sirve desde `/vendor/supabase.js`, instalado por `npm ci`: no depende de un CDN mutable. Se necesita internet para la primera descarga de npm y de las imágenes Docker.

En Windows los comandos de abajo usan `npm.cmd` y `npx.cmd` para evitar el bloqueo de `npm.ps1` por PowerShell. En Linux/macOS usa `npm` y `npx`.

## Instalación independiente con Supabase local (preferida para evaluar)

Esta opción NO necesita acceso al proyecto remoto, ni reinicia su base. Instala y abre Docker Desktop con contenedores Linux; comprueba `docker info`. Reserva los puertos 3000 y 54320–54324. Ejecuta desde la raíz del repositorio:

```powershell
git clone https://github.com/YamelyOvalles/Proyecto_libreria.git
cd Proyecto_libreria
git switch fase-4-despliegue
npm.cmd ci
npx.cmd supabase start
npm.cmd run local:config
npm.cmd run demo:seed
npm.cmd run start:local
```

Si ya tienes el repositorio, empieza con `npm.cmd ci`; conserva tus archivos `.env` existentes. `local:config` escribe **server/.env.local** con URL/clave pública y **scripts/.env.demo** con la clave administrativa LOCAL. Ambos son ignorados y el comando se niega a sobrescribirlos. No modifica `server/.env`. Las claves no se muestran por el script. `supabase status` puede mostrarlas: no compartas su salida.

La primera ejecución de `supabase start` carga `database/database.sql` mediante `[db.seed].sql_paths` en `supabase/config.toml`: crea esquema, RLS, RPC, bucket y datos. No es necesario ejecutar SQL manualmente para el entorno local. Auth local permite registro sin confirmación de email. Studio: `http://127.0.0.1:54323`; correo de desarrollo: `http://127.0.0.1:54324`. El correo remoto y Google OAuth no están habilitados automáticamente en local.

En otra terminal, desde la misma raíz, inicia la función para las operaciones administrativas:

```powershell
npx.cmd supabase functions serve bright-action --no-verify-jwt
```

Abre `http://localhost:3000`. `GET /api/health` confirma servidor/configuración, **no** comprueba conectividad, login ni estado de las tablas. Mantén las terminales de Express y de la función abiertas durante la evaluación.

### Usuarios ficticios locales

`demo:seed` usa la API Admin de Auth para crear cuentas confirmadas y asigna los roles automáticamente. No se requiere registrar ni promover manualmente un administrador. Solo acepta URL loopback; rechaza un proyecto remoto. Se puede repetir: actualiza contraseña/perfil/rol de estas cinco cuentas sin duplicarlas.

**Contraseña de todas las cuentas:** `DemoLocal-306!` (exclusivamente local).

| Correo | Rol | Propósito |
| --- | --- | --- |
| admin@demo.local | administrador | Productos, categorías, usuarios, mensajes, configuración y operación comercial |
| empleado@demo.local | empleado | Pedidos, movimientos de inventario y documentos; sin gestión de productos/usuarios |
| cliente@demo.local | cliente | Catálogo, carrito, checkout y documentos propios |
| otro@demo.local | cliente | Comprobar aislamiento de datos entre clientes |
| inactivo@demo.local | cliente inactivo | Comprobar rechazo de operaciones |

El SQL incluye 4 libros, 4 categorías, 4 autores, inventario inicial y sucursal. `demo:seed` añade mediante las mismas RPC de la aplicación 3 pedidos ficticios (pendiente, procesando/pagado y cancelado), sus cotizaciones, una factura y un mensaje de contacto. Identifica los ejemplos por sus notas para no duplicarlos al repetir el comando; no vacía un carrito demo que ya tenga artículos. Este sembrado completo aún requiere validarse con Docker. La suite de integración añade y conserva más historial comercial LOCAL y elimina cuentas/productos temporales sin historial. Los documentos no representan facturación fiscal válida.

Para parar sin borrar datos: `npx.cmd supabase stop`. Para una reinstalación completamente nueva **solo de esta pila local**: `npx.cmd supabase db reset --local` y después `npm.cmd run demo:seed`. El reset borra los datos de esa pila local; no es parte del arranque normal. No uses `--linked` ni `--db-url` para este procedimiento. El SQL completo es de instalación nueva, no un script idempotente para ejecutar repetidamente sobre producción.

## Alternativa con Supabase remoto nuevo

`npm start` ejecuta Express localmente, pero Auth, datos, Storage y funciones siguen en el proyecto Supabase remoto configurado. No es una instalación independiente ni un backend PostgreSQL alojado dentro de Express.

1. Crea un proyecto Supabase **nuevo** y ejecuta completo `database/database.sql` en su SQL Editor. No ejecutes ese archivo sobre la base existente del equipo.
2. Copia la configuración y completa URL y clave pública:

```powershell
Copy-Item server/.env.example server/.env
npm.cmd ci
npm.cmd start
```

| Variable | Archivo/entorno | Uso |
| --- | --- | --- |
| SUPABASE_URL | server/.env o entorno del host | HTTPS del proyecto remoto; loopback HTTP solo para local |
| SUPABASE_ANON_KEY | server/.env o entorno del host | Clave pública `anon` o `sb_publishable_` |
| PORT | server/.env o entorno del host | Puerto Express, 3000 por defecto |
| SUPABASE_SERVICE_ROLE_KEY | scripts/.env.demo, únicamente LOCAL | Crear demos; jamás navegador ni configuración pública |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY | Entorno interno de la Edge Function | Supabase las proporciona al ejecutar/desplegar la función |

Express falla al arrancar si falta configuración o recibe una clave administrativa. `server/.env.example` y `scripts/.env.demo.example` son plantillas sin secretos. No copies `js/supabase-config.example.js`: Express entrega `/js/supabase-config.js` dinámicamente. Se conserva el ejemplo antiguo por compatibilidad, pero servir el sitio solo como archivos estáticos ya no permite completar el checkout.

Para un entorno remoto, provisiona al administrador mediante las herramientas administrativas de un proyecto nuevo según su política de acceso. El procedimiento académico reproducible de demos está disponible en la opción LOCAL y deliberadamente no instala contraseñas conocidas en producción.

### Actualizar la base remota existente

**La exportación remota recibida el 7 de octubre reveló un esquema distinto al instalador.**
Consulta [la conciliación](database/conciliacion-remota.md). No aplicar aún la migración
al proyecto existente: faltan las definiciones de funciones para comprobar su compatibilidad.

No se ha modificado, reiniciado ni consultado su información privada. Antes de usar este frontend contra ella, revisa y respalda su esquema y aplica **únicamente** [database/migrations/004_security_checkout.sql](database/migrations/004_security_checkout.sql) si corresponde al esquema de la Fase 3. Esta migración añade el control de cuenta activa en escrituras de carrito y serializa checkout; no carga demos ni recrea tablas. Se comprobó su aplicación preservando los datos en PostgreSQL aislado. La compatibilidad con una base remota divergente sigue pendiente. Despliega también la nueva `bright-action` después de revisar que exista `eliminar_producto_admin` con sus permisos.

## Edge Function, Storage y autenticación

Para comprobar que el instalador SQL incluye lo utilizado por la aplicación, ejecuta
`npm.cmd run db:audit`. La [guía de base de datos](database/README.md) detalla su cobertura
y cómo comparar con una exportación del esquema remoto mediante una consulta de solo lectura.
Sin esa exportación, la cobertura local no demuestra identidad con el proyecto remoto.

`bright-action` valida el bearer token con `auth.getUser`, comprueba en base de datos el rol **administrador** y un perfil activo, y solo entonces usa la API Admin para crear/eliminar usuarios. Bloquea eliminar la cuenta propia y cuentas con pedidos/cotizaciones/facturas. La eliminación de productos llama ahora a la RPC transaccional con el JWT del administrador; ya no realiza múltiples borrados privilegiados por separado.

Para un proyecto remoto nuevo o una actualización autorizada:

```powershell
npx.cmd supabase login
npx.cmd supabase functions deploy bright-action --project-ref TU_PROJECT_REF --no-verify-jwt
```

No necesitas ejecutar `supabase link` para este despliegue explícito. `verify_jwt=false` en config y `--no-verify-jwt` desactivan la validación automática del gateway; **la función siempre valida internamente el token y el rol**. Esto permite usar claves públicas nuevas sin confundirlas con el JWT del usuario. Si falta la función, crear/eliminar usuarios y eliminar productos falla; las demás RPC no dependen de ella. Nunca copies `service_role` al HTML, a `js/`, a la configuración pública o al entorno de Express.

El SQL crea `portadas`: bucket público para leer imágenes, máximo 5 MiB, MIME JPEG/PNG/WebP. Las políticas de `storage.objects` permiten insertar/actualizar/eliminar solo a un administrador activo. Ser público permite leer portadas, no escribirlas. Las imágenes iniciales son archivos del repositorio; subir una portada nueva usa Storage. Una subida cuyo guardado del producto falla se intenta limpiar desde el cliente; verifica Storage si una interrupción de red deja un archivo huérfano.

En Auth remoto configura Site URL y las redirect URLs que uses: `http://localhost:3000/login.html`, `/informacion.html`, `/tienda.html` y sus equivalentes del dominio publicado. Para Google OAuth habilita el proveedor y configura sus credenciales/redirección en Supabase; es opcional y no bloquea login por contraseña. Registro remoto puede requerir confirmación. Para recuperación usa el correo de desarrollo local o SMTP propio remoto y comprueba el enlace en `login.html`. Los límites de correo dependen de la configuración del proveedor; no se asume un cupo fijo universal.

## Express y separación de responsabilidades

```text
server/app.js                 Construye Express sin abrir un puerto
server/index.js               Carga configuración, arranca y cierra el servidor
server/config.js              Variables y validación al arrancar
server/public-config.js       Configuración pública sin secretos
server/routes/api.js          Rutas HTTP, health y checkout
server/routes/pages.js        Páginas permitidas, assets y SDK local
server/controllers/orders.js  Valida forma de la solicitud y coordina checkout
server/middleware/auth.js     Valida token contra Auth y perfil activo
server/middleware/errors.js   Errores JSON sin stack ni secretos
server/services/supabase.js   Cliente HTTP con clave pública, JWT y timeout
api/index.js                  Mismo Express para función Node en Vercel
js/                           Interfaz existente y Supabase SDK
supabase/functions/           bright-action y dependencias Deno fijadas
supabase/config.toml          Pila local aislada
scripts/                      Configuración local, demos y verificación de instalación
```

| Operación | Responsable | Motivo |
| --- | --- | --- |
| Confirmar pedido | `POST /api/pedidos` de Express → RPC | Express valida sesión/perfil y contrato HTTP; el navegador ya utiliza esta ruta |
| Precios, reservas, stock, pedido y cotización | RPC PostgreSQL | Una única transacción, identidad de `auth.uid()`, bloqueo de carrito/inventario y datos calculados en servidor |
| Login, registro, refresh, recuperación, logout | Supabase Auth | Mantener el proveedor de identidad y sesiones existente |
| Lecturas de catálogo y documentos; CRUD de carrito | Supabase con RLS | Lectura pública limitada y datos privados por propietario; escrituras requieren cuenta activa |
| Productos, categorías, inventario, pago/estado, facturas, roles | RPC con verificaciones internas | No repetir reglas ni permitir escrituras directas que omitan la transacción/autorización |
| Crear/eliminar cuentas de Auth | bright-action | Necesita API administrativa; clave aislada del navegador y de Express |
| Portadas | Supabase Storage y políticas | Control de escritura en servidor y lectura pública |

Express **no incluye un contenedor de inyección de dependencias propio**. `createApp({config, gateway})`, `requireSession(gateway)` y `createOrderController(gateway)` reciben dependencias explícitas. Las pruebas pueden sustituir el gateway HTTP sin agregar un contenedor artificial. Express 5 propaga los rechazos de handlers async al middleware de errores.

El JWT del cliente se reenvía a Auth y a PostgREST: Express no usa `service_role` ni evita RLS. La identidad y el total no se aceptan del navegador. Ocultar botones es una ayuda de interfaz; las RPC, políticas y Edge Function toman las decisiones de autorización aunque alguien invoque las APIs directamente.

## Ejecución y pruebas

```powershell
npm.cmd run check                # Sintaxis de todos los JS de aplicación/pruebas/configuración
npm.cmd test                     # HTTP, PostgreSQL WASM con RLS/RPC y guard de frontend
npm.cmd run verify:install       # Copia limpia sin .env/node_modules, npm ci y pruebas
npm.cmd run test:edge            # Deno: tipos/dependencias; no ejecuta una Edge Function
npx.cmd playwright install chromium
npm.cmd run test:browser         # Chromium: páginas públicas, formulario y guard; sin Auth real
```

Con Docker, Supabase local, demos y `bright-action` activas:

```powershell
npm.cmd run test:integration     # Auth real, refresh/logout, CRUD, permisos, Storage, Edge y checkout HTTP
npm.cmd run test:browser:local   # Login/sesión/logout, roles y CRUD de producto desde la interfaz
```

La integración rechaza URLs remotas y falla explícitamente si falta la pila/configuración; no omite pruebas silenciosamente. En las pruebas SQL se sustituyen los esquemas de infraestructura de Supabase por tablas mínimas y `auth.uid()` ligado a un claim de prueba. El motor, RLS, restricciones, triggers y RPC son PostgreSQL reales, pero eso no prueba GoTrue, HTTP de Storage, conexiones concurrentes ni el despliegue remoto. El gateway se sustituye en parte de las pruebas HTTP; la suite local completa usa el gateway real.

La ejecución limpia crea una carpeta ignorada `.tmp/install-*` y la elimina si las pruebas pasan. Si falla, conserva la copia para inspección; también puedes conservarla con `npm run verify:install -- --keep`. No copia `.env` ni el antiguo archivo local `js/supabase-config.js`. El workflow `.github/workflows/fase4-tests.yml` prepara en un runner con Docker una pila local, genera demos y ejecuta integración/navegador. Está preparado, **no se afirma que haya corrido en GitHub**.

## Publicación

No se publicó ni se fusionó esta entrega. Para un host Node: `npm ci --omit=dev`, variables públicas correctas y `npm start`; usa HTTPS y el puerto asignado por el proveedor. Auth/PostgreSQL/Storage/Edge siguen siendo Supabase remoto.

Para Vercel se conserva `api/index.js`, que exporta **la misma aplicación Express**, y `vercel.json` incluye páginas/assets/SDK y envía las rutas al servidor. Define SUPABASE_URL y SUPABASE_ANON_KEY; usa runtime Node 24. `.vercelignore` excluye los `.env`. Verifica `/api/health`, `/vendor/supabase.js`, login y checkout en Preview antes de producción. El despliegue Vercel no se probó aún; el esquema anterior que publicaba solo el frontend estático no cubre la nueva ruta de pedidos. No se deben fusionar PR ni crear `v4.0` antes de la aprobación exigida por la consigna.

## Resolución de problemas

| Síntoma | Acción |
| --- | --- |
| PowerShell bloquea npm.ps1 | Usa npm.cmd / npx.cmd; no hace falta cambiar políticas del sistema |
| `docker: command not found` / contenedores no saludables | Instala/abre Docker Desktop y comprueba docker info antes de Supabase local |
| Puerto ocupado | Detén el servicio local que lo ocupa o ajusta puertos/configuración/redirect URLs |
| Arranque rechaza configuración | Completa server/.env o genera server/.env.local; utiliza una clave pública |
| local:config rechaza sobrescribir | Conserva los archivos existentes; regenera solo si decides reemplazar esa configuración local |
| SQL falla por una política existente | No repitas el instalador completo; usa base nueva o migración revisada |
| `bright-action` 404 / error al crear usuario | Inicia functions serve localmente o despliega la función en el proyecto correcto |
| 401/403 al invocar API | Inicia sesión; comprueba rol y perfil activo; no sustituyas JWT por la clave anon |
| Productos o documentos no disponibles | Revisa resultado de instalación/migración, RLS y logs sin compartir claves |
| Sin correos / recovery / Google | Revisa SMTP local/remoto, redirect URLs y proveedor OAuth; no reenviar en bucle |
| Playwright no encuentra Chromium | Ejecuta npx playwright install chromium antes de test:browser |
| Deno bloquea dependencia demasiado reciente | Usa la versión fijada y lockfile; no desactives la política de antigüedad |

Fuentes oficiales: [Supabase local](https://supabase.com/docs/guides/local-development), [seeding](https://supabase.com/docs/guides/local-development/seeding-your-database), [configuración CLI](https://supabase.com/docs/guides/local-development/cli/config), [errores en Express 5](https://expressjs.com/en/5x/guide/error-handling/), [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [archivos de funciones Vercel](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
