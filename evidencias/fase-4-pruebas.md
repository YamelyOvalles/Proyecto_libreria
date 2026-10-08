# Registro técnico de pruebas — Fase 4

Fecha de ejecución: 7 de octubre de 2026, America/La_Paz. Rama: `fase-4-despliegue`.
Este archivo registra pruebas y limitaciones; no es el informe final académico ni una aprobación.

## Entorno y alcance

Windows, PowerShell, Node 24.19.0, npm 11.17.0, Express 5.2.1, SDK Supabase 2.117.2,
Supabase CLI 2.120.0, Deno 2.9.7, Playwright 1.64.0 y Chromium 156.0.8078.4.
SQL ejecutado en PostgreSQL 18.3 WASM mediante PGlite 0.5.8, en memoria y desde cero.
La pila Supabase local está configurada para PostgreSQL 17, todavía sin verificar con Docker.

No se aplicaron cambios a la base remota. Se preservó `server/.env`.
No se fusionó un PR, publicó un sitio ni creó la etiqueta `v4.0`.

## Resultados ejecutados

| Comando | Resultado | Qué demuestra |
| --- | --- | --- |
| `npm.cmd run check` | Aprobado | Sintaxis de JS de aplicación, scripts, pruebas y configuración Playwright |
| `npm.cmd test` | 27 aprobadas, 0 fallidas, 0 omitidas | HTTP real de Express con gateway sustituido; RPC/RLS/restricciones/triggers en PostgreSQL aislado; guard de frontend con dependencias sustituidas |
| `npm.cmd run verify:install` | Aprobado | Copia independiente sin secretos ni node_modules; npm ci, sintaxis y suite aislada |
| `npm.cmd run test:browser` | 3 aprobadas | Chromium real, formulario de login, guard de panel sin sesión y navegación pública |
| `npm.cmd run test:edge` | Aprobado | TypeScript/dependencias de bright-action con Deno; no ejecución funcional de Auth ni API Admin |
| `npx supabase start` | Bloqueado por entorno | La CLI lee la configuración, pero informa Docker/Podman ausentes |
| `npm.cmd run test:integration` | Fallo explícito de precondición | Falta server/.env.local porque la pila local no pudo iniciar; los flujos de la suite no llegaron a ejecutarse |

Para el navegador se instaló Chromium dentro de `node_modules/.cache/ms-playwright` y se
seleccionó su ejecutable mediante `PLAYWRIGHT_EXECUTABLE_PATH`. No se sustituyeron las
respuestas de Supabase en esas tres pruebas: se comprobaron estados públicos sin sesión.
No se confunde mostrar el formulario de login con iniciar una sesión válida.

La instalación aislada detectó que `sendFile` rechazaba un directorio padre oculto (.tmp).
Se corrigió usando nombres fijos de páginas/SDK, manteniendo la denegación de archivos
ocultos en rutas estáticas. Se repitió la instalación y quedó aprobada. La copia de prueba
se conservó en `.tmp/install-*`, ignorada por Git; no se añadieron credenciales a la evidencia.

## Comprobaciones de flujos y permisos

- Instalación completa de `database/database.sql` sin reemplazar ni saltar sus sentencias.
  Esquemas mínimos de infraestructura de Auth y Storage preparados antes del instalador.
- Trigger de registro asigna cliente aunque los metadatos pidan administrador.
- Catálogo/inventario públicos permitidos; perfiles/RPC administrativas denegados a anon.
- CRUD del carrito propio; un segundo cliente no puede leer ni borrar el carrito ajeno.
- Checkout calcula importes en servidor, reserva stock, vacía carrito y crea cotización.
  Sin stock o con carrito vacío falla sin crear otro pedido ni alterar la reserva.
- Cliente no puede modificar directamente roles, perfiles, productos o pedidos ni invocar
  funciones de personal/administrador. Empleado no puede gestionar productos/categorías,
  roles o configuración, pero conserva operaciones de inventario y pedidos autorizadas.
- Procesamiento, pago, factura idempotente, despacho y devolución actualizan inventario.
  Los documentos y detalles quedan aislados entre clientes. Producto vendido no se borra.
- CRUD de categorías/productos y ajustes de inventario con validaciones y movimientos.
- Administración de perfiles/roles sin poder quitarse el propio acceso administrativo.
- Desactivar un administrador impide RPC de administración/personal y escrituras Storage
  incluso manteniendo el mismo claim de sesión de prueba.
- Mensaje público validado y estado modificable únicamente por administrador.
- Políticas SQL de Storage: cliente/empleado no escriben; administrador ejecuta CRUD.
  Esto verifica políticas, no subida/descarga HTTP de un archivo real.
- Migración incremental aplicada conservando libros, perfiles e historial comercial.
- Express deniega token ausente/vencido, perfil inactivo/ausente y datos manipulados;
  reenvía JWT/clave pública; errores JSON/async no filtran stack ni detalles internos.
- Archivos internos y secretos no se sirven por HTTP. Configuración pública rechaza claves
  administrativas y acepta únicamente proyectos Supabase HTTPS o loopback local HTTP.
- Guard del navegador cubre `/admin` y `/admin.html`; perfiles ausentes/inactivos cierran sesión.

## Revisión de módulos

| Módulo | Archivos principales revisados | Validación disponible / pendiente |
| --- | --- | --- |
| Login, registro, sesión, recuperación y logout | login.js, auth.js, supabase-client.js, app.js | Guard/configuración ejecutados; login/refresh/logout/registro/recovery reales pendientes |
| Catálogo, filtros y carrito | tienda.js, funciones.js | SQL/carrito/aislamiento ejecutados; interfaz con datos locales pendiente |
| Checkout | checkout.js, server/controllers/orders.js, RPC | HTTP y SQL por separado ejecutados; recorrido completo con JWT real pendiente |
| Productos y categorías | admin.js, RPC, bright-action | CRUD SQL ejecutado; CRUD desde panel y borrado Edge pendientes |
| Inventario | admin.js, RPC | Movimientos/reservas/permisos ejecutados en SQL |
| Pedidos y pagos | admin.js, RPC | Estados/pagos/permisos/despacho/devolución ejecutados en SQL |
| Usuarios | admin.js, RPC, bright-action | Trigger/roles/RPC ejecutados; creación/eliminación Auth vía Edge pendientes |
| Contacto y mensajes | validaciones.js, admin.js, RPC | Validación/aislamiento/estado SQL ejecutados; envío completo en navegador pendiente |
| Cotizaciones y facturas | documento.js, admin.js, triggers/RPC | Creación/lectura aislada/idempotencia SQL ejecutadas; render/PDF con datos reales pendiente |
| Configuración de negocio | admin.js, RPC | RPC/permisos ejecutados en SQL |

## Pendientes obligatorios antes de considerar terminada la actividad

1. En un equipo con Docker operativo: ejecutar instalación local completa del README,
   incluido `demo:seed` (cuentas y ejemplos comerciales) y `functions serve`.
2. Ejecutar `npm run test:integration`: login, contraseña incorrecta, validación/refresh/logout,
   Edge Function con roles, crear/editar/eliminar cuentas, CRUD, archivos Storage reales,
   carrito, checkout HTTP con JWT real, documentos y protección del historial.
3. Ejecutar `npm run test:browser:local`: login/sesión/logout, permisos y CRUD desde el panel.
   Revisar además checkout → documento → impresión/PDF, registro y recovery por correo local.
4. Comprobar compras concurrentes en PostgreSQL de la pila completa; PGlite usa una sola
   instancia/conexión y no demuestra concurrencia real entre solicitudes independientes.
5. Validar migración en una copia del esquema remoto si difiere del instalador; cualquier
   despliegue y su smoke test siguen pendientes. No usar el instalador completo sobre la base existente.

Se preparó `.github/workflows/fase4-tests.yml` para ejecutar la pila local e integración en
un runner con Docker. No se ha ejecutado ni se presentan resultados de GitHub Actions.
Las capturas y registros previos de Fase 3 no se usan como evidencia de la Fase 4.

## Auditoría adicional de cobertura SQL — 7 de octubre de 2026

`npm run db:audit` ejecutó el instalador en una base vacía y verificó referencias de tablas,
relaciones/columnas SELECT, RPC/parámetros y bucket: **sin referencias faltantes**.
Objetos creados: 19 tablas, 22 funciones (14 públicas y 8 privadas), 37 políticas,
3 triggers de aplicación, 43 índices, 10 secuencias y un bucket. `npm test` pasó ahora
**28 pruebas**, incluida detección de cambios/objetos faltantes en la comparación de esquemas.

El intento de consultar metadatos públicos OpenAPI del Supabase configurado devolvió HTTP 401.
No se obtuvo un inventario remoto ni se modificó su base. La identidad exacta con el proyecto
remoto sigue pendiente de exportar el SELECT de `database/verificar_esquema.sql`.
`database/README.md` distingue el instalador SQL de Auth, Edge, secretos, archivos de Storage
y datos históricos; estos últimos no se incluyen automáticamente en una instalación nueva.

## Exportación remota recibida — 7 de octubre de 2026

La usuaria aportó la exportación de esquema: 24 tablas, 24 funciones, 58 políticas,
17 triggers, 63 índices y 11 secuencias. La comparación confirma diferencias con el
instalador, incluidas 5 tablas adicionales, columnas y 3 funciones privadas adicionales;
6 funciones existentes tienen hash de cuerpo distinto. Inventario y conciliación guardados
en `database/schema-remoto-2026-10-07.json` y `database/conciliacion-remota.md`.

Se reprodujeron las políticas antiguas de carrito y los permisos de UPDATE de perfiles
en PostgreSQL aislado. Una cuenta inactiva podía escribir en el carrito y reactivarse.
La prueba de `tests/remote-policies.test.js` verifica que la migración revisada impide ambos
casos, retirando políticas antiguas y revocando UPDATE directo de perfiles/columnas.
Además se reproducen los CHECK antiguos de pedidos que rechazaban efectivo/tarjeta
y devuelto, pese a los CHECK nuevos. La migración retira esos duplicados.
Esto no representa una prueba del esquema remoto completo ni de sus funciones, cuyos
cuerpos faltan. No se ejecutó ninguna migración en Supabase remoto.

Tras estos cambios se ejecutaron `npm run check` y `npm test`: **29 pruebas aprobadas,
0 fallidas**. La consulta `database/exportar_funciones.sql` se ejecutó contra el PostgreSQL
aislado y devolvió las 22 definiciones locales completas. Esto valida la consulta, sin
afirmar que se hayan recibido o probado los cuerpos de las 24 funciones remotas.
`npm run verify:install` también completó `npm ci`, sintaxis y las mismas 29 pruebas
en una copia nueva sin archivos `.env`, creada en `.tmp/install-vGhin3`.

## Limpieza del proyecto — 7 de octubre de 2026

Se retiraron las seis copias temporales de instalación tras registrar sus resultados,
el snapshot local regenerable, `debug.log` y el resultado temporal de Playwright.
Se conservaron las evidencias Markdown y la exportación remota del esquema.
La verificación de instalación ahora elimina su copia si pasa; conserva los fallos y
permite conservar una ejecución correcta con `--keep`.
Se volvió a ejecutar `npm run verify:install`: instalación, sintaxis y 29 pruebas
aprobadas. Se comprobó que la copia temporal se eliminó al terminar correctamente.
