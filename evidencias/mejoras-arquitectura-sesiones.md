# Revisión de arquitectura y sesiones — 21 de octubre de 2026

> Informe histórico de la entrega 918f5fc/9c15d7b. El estado de las correcciones posteriores, sus pruebas y pendientes está en [correcciones-finales-fases-3-4.md](correcciones-finales-fases-3-4.md).

## Alcance y punto de partida

Se revisaron los archivos versionados de la aplicación, servidor, SQL, función administrativa, pruebas, configuración y documentación, y se comparó el estado original de `fase-3-backend` (`005f8a3`) con la rama de partida `main`. Git estaba limpio. Las mejoras corrigen observaciones de la Fase 3. Se prepararon inicialmente en una rama auxiliar y, por indicación del usuario, quedaron en `fase-3-backend` mediante un avance directo hasta el commit verificado `918f5fc`. Ese avance conserva también la base de Fase 4 utilizada durante la implementación y las pruebas. La rama auxiliar fue eliminada; las referencias de `main` y `fase-4-despliegue` no se modificaron.

La Fase 4 ya había incorporado rutas, controlador y gateway de pedidos, validación del checkout, manejo central de errores y pruebas de permisos y transacciones. Por tanto, la observación de «Express solo sirve archivos» estaba parcialmente resuelta. Seguían pendientes las sesiones propias y la intermediación de las demás operaciones. No se reconstruyó la aplicación ni se modificaron el instalador comercial, las RPC, las políticas RLS existentes, la función bright-action o el diseño visual.

## Comparación solicitada

| Observación del facilitador | Problema encontrado | Solución implementada | Estado | Archivo relacionado |
| --- | --- | --- | --- | --- |
| Responsabilidades de Express | Checkout ya pasaba por Express; otros módulos accedían directamente a Supabase | Adaptador del SDK hacia rutas Express permitidas; identidad y roles comprobados en servidor | Implementado y probado localmente | `server/routes/supabase.js`, `server/services/application-auth.js`, `js/supabase-client.js` |
| Sesión en sessionStorage | JWT y refresh token persistían en el navegador | express-session, cookie HttpOnly, SDK en memoria con valores sin acceso al proveedor | Implementado; login y recarga probados | `server/middleware/sessions.js`, `js/auth.js` |
| Persistencia y expiración | No existía almacén propio del servidor | PostgreSQL en producción; 30 minutos de inactividad y máximo de ocho horas; renovación del JWT en servidor | Probado entre instancias con PostgreSQL local | `database/migrations/20261021_application_sessions.sql`, `tests/session-store.integration.test.js` |
| Rutas privadas y roles | La página administrativa dependía del guard del navegador | Express protege panel y documentos; exige roles para RPC y función administrativa; conserva RLS por usuario | Probado para cliente, empleado, administrador e inactivo | `server/app.js`, `server/middleware/auth.js`, `tests/http.test.js` |
| Protección general | Faltaban CSRF, encabezados y limitación propia de intentos | Encabezado obligatorio en modificaciones, comprobación de origen, ausencia de CORS, Helmet/CSP y rate limiting | Pruebas HTTP y navegador satisfactorias | `server/middleware/sessions.js`, `server/routes/supabase.js` |
| Contraseña publicada | README y script demo compartían una contraseña fija; las pruebas dependían de ella | Contraseña generada y guardada solo en archivo ignorado; pruebas leen variable privada | Retirada del código actual; cinco cuentas demo locales rotadas | `README.md`, `scripts/local-config.js`, `scripts/seed-demo.js` |
| CRUD con 30/30 | Había que conservar restricciones, confirmaciones y transacciones | Se mantienen RPC, RLS y confirmaciones por nombre; cambió el transporte, no el esquema comercial | CRUD, inventario, pedidos y facturas probados | `tests/database.test.js`, `tests/supabase.integration.test.js`, `tests/local-browser/auth.spec.js` |
| Documentación y Fase 4 | Faltaban instrucciones de sesiones propias y separación de garantías | README ampliado, migración repetible y este informe; Docker/Supabase/Vercel conservados | Documentado; despliegue remoto pendiente | `README.md`, `server/.env.example`, `scripts/migrate-sessions.js` |

## Funcionamiento y seguridad

1. El SDK envía login a Express. El servidor valida formato y tamaño, aplica el límite de intentos y consulta Supabase Auth. Confirma identidad y perfil activo antes de regenerar el identificador de sesión.
2. Solo se guardan en el servidor los tokens, su vencimiento, el usuario devuelto por Auth y el inicio de sesión. No se guarda la contraseña. La cookie contiene un identificador firmado, no los tokens.
3. El SDK recibe valores sintéticos de compatibilidad y los mantiene en memoria. Express ignora cualquier Authorization del navegador al acceder al proveedor: utiliza exclusivamente los tokens de la sesión. Los valores sintéticos no permiten autenticarse directamente contra Supabase ni ante Express sin la cookie.
4. Las rutas permitidas de REST, RPC, Storage y bright-action pasan por Express. El servicio verifica usuario con Auth, perfil activo y rol actual; renueva tokens próximos a caducar. El gateway utiliza la clave pública y JWT del usuario, por lo que RLS continúa aplicándose. bright-action conserva sus verificaciones internas y su acceso administrativo exclusivo.
5. El checkout mantiene un controlador dedicado que admite campos explícitos y rechaza precios o identidad suministrados por el cliente. PostgreSQL sigue calculando importes y modificando stock y documentos de forma atómica. La validación de argumentos administrativos sigue en las RPC existentes, comprobadas por las pruebas SQL, además del control de rol en Express.
6. Se limitan tamaños de JSON y portadas; no se interpola SQL. Los errores del proxy no revelan mensajes internos del proveedor. La interfaz mantiene sus mecanismos de presentación de texto. CSP permite scripts propios y únicamente el hash del redirect original de index.html; conserva estilos y portadas existentes.
7. Las modificaciones exigen `X-Libreria-Request: 1`, rechazan Origin ajeno y Sec-Fetch-Site cross-site. Sin CORS, otro origen no obtiene autorización de preflight para ese encabezado. Esto también protege login, recuperación y logout. SameSite=Lax complementa esa protección.
8. Logout invalida la sesión compartida y limpia la cookie; si falla Supabase, la sesión de Express se destruye igualmente. La renovación y el acceso posterior vuelven a comprobar actividad y rol.

En el navegador permanecen la presentación, formularios, validaciones de ayuda, selección de archivos y generación/impresión de documentos. Las imágenes públicas pueden cargarse directamente. Los enlaces de recuperación entregan tokens transitorios en el fragmento de la URL: se intercambian por sesión propia y se retira el fragmento. Se probó este flujo con correo local. Google OAuth sigue deshabilitado en la configuración local; no se declara verificado.

La [documentación de express-session](https://expressjs.com/en/resources/middleware/session/) describe el almacenamiento de sesión en servidor y excluye MemoryStore para producción. El almacén utilizado es [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple). Se exige secreto estable privado y conexión PostgreSQL en producción y Vercel. La cookie usa Secure con HTTPS y obligatoriamente en producción, HttpOnly y SameSite=Lax. En desarrollo sin PostgreSQL, MemoryStore es deliberadamente temporal y reiniciar el proceso obliga a entrar otra vez.

## Credenciales y datos

Se retiró la contraseña demo publicada de README y del generador de cuentas. Las pruebas ya no incluyen esa contraseña: leen `DEMO_PASSWORD` del entorno privado. `local:config` genera una contraseña aleatoria para instalaciones nuevas. Para esta comprobación se agregó una contraseña aleatoria al archivo demo local existente y se rotaron las cinco cuentas demo mediante el generador local. No se mostraron claves ni contraseñas.

Las contraseñas eliminadas pueden seguir en commits anteriores. No se reescribió el historial. Se debe rotar manualmente la contraseña del administrador publicada en el informe académico y cualquier cuenta remota que haya reutilizado las credenciales antiguas. El informe académico externo no está entre los archivos versionados revisados, por lo que no se afirma haberlo editado. Las claves administrativas solo deben rotarse si se compartieron o publicaron; no se cambió ninguna clave remota. Los ejemplos contienen marcadores ficticios y los archivos privados siguen ignorados por Git.

Las pruebas reales agregaron datos ficticios y registros de evaluación a la pila local. La prueba de almacén aplicó la migración aditiva de sesiones exclusivamente a PostgreSQL local. No se ejecutó reset ni se modificó el proyecto remoto.

## Archivos modificados y agregados

- Servidor: `server/app.js`, `server/index.js`, `server/config.js`, `server/routes/api.js`, `server/routes/supabase.js`, `server/controllers/orders.js`, `server/middleware/auth.js`, `server/middleware/sessions.js`, `server/services/supabase.js`, `server/services/application-auth.js`.
- Cliente: `js/supabase-client.js`, `js/auth.js`, `js/checkout.js`, `js/documento.js`. Se conservaron pantallas, formularios y CRUD existentes.
- Configuración y ejecución: `package.json`, `package-lock.json`, `server/.env.example`, `scripts/.env.demo.example`, `scripts/local-config.js`, `scripts/seed-demo.js`, `scripts/migrate-sessions.js`.
- Migración: `database/migrations/20261021_application_sessions.sql`. Solo agrega la tabla propia de sesiones y su índice, con RLS y sin acceso para anon/authenticated.
- Pruebas: `tests/http.test.js`, `tests/frontend.test.js`, `tests/database.test.js`, `tests/supabase.integration.test.js`, `tests/local-browser/auth.spec.js`, `tests/helpers/ui-server.js`, `tests/browser/session.spec.js`, `tests/session-store.integration.test.js`.
- Documentación: `README.md` y este informe.
- Preparación privada local: se agregó `DEMO_PASSWORD` en `scripts/.env.demo`, ignorado por Git. No forma parte del commit.

## Verificación

| Comando/comprobación | Resultado | Alcance |
| --- | --- | --- |
| `npm.cmd run check` | Correcto | Sintaxis JavaScript |
| `npm.cmd test` | 40 pruebas correctas | HTTP, SDK real con proveedor simulado, sesiones, CSRF, roles, SQL/RLS en PGlite, regresiones y auditorías del esquema |
| `npm.cmd run test:integration` | 12 pruebas correctas | Supabase local real: Auth, permisos, CRUD, Storage, bright-action, stock, pedidos y facturación; el total incluye el caso contenedor |
| `npm.cmd run test:browser` | 4 pruebas correctas | Chrome: páginas públicas y sesión completa con proveedor simulado, sin tokens en Storage |
| `npm.cmd run test:browser:local` | 5 pruebas correctas | Chrome con Supabase real: login/logout/recarga, roles, CRUD de producto, checkout, PDF, registro y recuperación por correo |
| `npm.cmd run test:sessions:local` | 1 prueba correcta | PostgreSQL local real: sesión sobrevive al cierre de la primera instancia, funciona en dos instancias nuevas y logout la invalida en ambas; Auth simulado |
| `npm.cmd run test:edge` | Correcto | Deno comprueba tipos de bright-action |
| `npm.cmd run dev` con configuración local | Correcto, health HTTP 200 | Arranque con watcher en puerto 3017 |
| `git diff --check` | Correcto | Espacios y conflictos de parche |

Las primeras ejecuciones encontraron la función administrativa local detenida y la contraseña demo antigua; se preparó el entorno y se repitieron las pruebas. Chrome requirió usar su ejecutable instalado y permisos de ejecución para finalizar correctamente los procesos. Esos fallos de preparación no se cuentan como verificaciones satisfactorias.

Pendientes: despliegue Vercel/host remoto, cookies Secure en un HTTPS de producción real, credenciales/rotaciones del remoto y políticas efectivamente instaladas allí. Los fixtures y las pruebas SQL no sustituyen una auditoría del servidor remoto vivo. El límite de ocho horas y la renovación se probaron de forma automatizada; no se esperaron ocho horas reales. El límite de intentos es por proceso; para múltiples instancias se debe configurar un almacén de rate limiting compartido. La tabla de sesiones contiene tokens privados y requiere protección de conexión, permisos y copias de seguridad.

## Ejecución

1. `npm.cmd ci`.
2. Inicia Docker Desktop y la pila local existente con `npx.cmd supabase start`. En una instalación nueva ejecuta `npm.cmd run local:config`; conserva archivos existentes.
3. En instalaciones existentes, configura una contraseña nueva de al menos 12 caracteres como `DEMO_PASSWORD` en `scripts/.env.demo` y ejecuta `npm.cmd run demo:seed` si necesitas preparar o rotar las cuentas demo locales.
4. Mantén `npx.cmd supabase functions serve bright-action --no-verify-jwt` en una terminal.
5. Ejecuta `npm.cmd run start:local`, o establece `$env:LIBRERIA_ENV_FILE='.env.local'` y ejecuta `npm.cmd run dev`. Abre `http://localhost:3000`.
6. Para sesiones persistentes, configura `SESSION_SECRET` y `SESSION_DATABASE_URL` privados y ejecuta `npm.cmd run sessions:migrate -- --local` antes del arranque. No ejecutes el instalador comercial sobre una base existente. En producción utiliza las variables del host, conexión TLS y la migración dirigida al destino seleccionado, sin `--local`.

No se realizó merge a main ni publicación remota. Los cambios se entregan en `fase-3-backend` con commits descriptivos.
