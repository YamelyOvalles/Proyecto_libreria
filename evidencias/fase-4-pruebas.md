# Pruebas de Fase 4

Ejecución: 12 de octubre de 2026, America/La_Paz. Rama fase-4-despliegue.
Este registro es evidencia técnica; no es el informe académico final.

## Resultados comprobados

- npm run check: sintaxis aprobada.
- npm test: 32 aprobadas, cero fallidas u omitidas. Incluye instalación SQL desde cero, comparación con exportaciones, permisos, RLS, RPC, totales, inventario y Express.
- npm run db:audit: sin tablas, columnas, RPC o buckets faltantes para la aplicación.
- npm run verify:install: npm ci, sintaxis y 32 pruebas aprobadas en una copia sin archivos .env; copia retirada al finalizar.
- Supabase local: instalador database/database.sql ejecutado desde cero en PostgreSQL 17.11 con Docker. Se generó configuración local sin sobrescribir server/.env.
- npm run demo:seed: ejecutado dos veces; cinco cuentas demo y un pedido por cada una de las tres notas DEMO_FASE4, sin duplicados.
- npm run test:integration: 12 aprobadas, cero fallidas u omitidas; corresponden a 11 subpruebas y la prueba contenedora.
- npm run test:browser:local: cinco aprobadas con Chromium y servicios reales.
- npm run test:edge: comprobación de tipos aprobada con Deno 2.9.7.
- Express local: arranque en localhost:3000 y GET /api/health con HTTP 200.

Entorno verificado: Windows, Node 24.19.0, npm 11.17.0, Express 5.2.1,
Supabase JS 2.117.2, CLI 2.120.0, Docker 29.8.2, WSL 3.0.3,
PostgreSQL local 17.11, Mailpit 1.31.3 y Playwright 1.64.0.
Las pruebas SQL aisladas utilizan PGlite 0.5.8 con PostgreSQL 18.3 WASM.

## Flujos probados con servicios locales reales

Login correcto e incorrecto, validación y renovación de sesión, logout, cuentas
inactivas y rechazo de operaciones por roles insuficientes. Creación, edición y
eliminación de cuentas mediante Auth, RPC y bright-action; protección de cuentas
con historial. CRUD de categorías y productos, ajustes de inventario, eliminación
sin historial y desactivación con historial. Storage permitió subir, descargar y
eliminar una portada como administrador y rechazó escritura de cliente.

Se comprobó aislamiento de carritos, pedidos, documentos y mensajes; checkout por
Express con JWT real y rechazo de precios manipulados; cotización, procesamiento,
pago, factura y entrega. Dos solicitudes simultáneas del mismo carrito crearon
un solo pedido. Cancelar liberó reservas y devolver dos veces repuso stock una
sola vez, conservando la factura y su snapshot.

El navegador comprobó sesiones al recargar, logout, permisos visibles, CRUD de
producto, carrito, checkout, cotización, PDF válido y regreso al documento tras
login. Registró una cuenta ficticia, solicitó recuperación, leyó el correo de
Mailpit y cambió contraseña; Auth rechazó la anterior y aceptó la nueva.
Los tokens permanecieron en memoria; el PDF se guardó en test-results, ignorado.

Se corrigió el CSS que sobreponía hidden en enlaces administrativos. Se conservó
la intención de recuperación mientras el SDK consume el enlace y se ajustaron
las pruebas a Mailpit. La analítica opcional se deshabilitó porque Vector dependía
del puerto Docker 2375 no disponible; la pila reinició conservando datos y las
suites reales volvieron a pasar.

## Base consolidada y seguridad

Las exportaciones de esquema del 7 de octubre y de funciones del 12 de octubre
se conservan como fixtures de prueba. El instalador contiene las 24 tablas,
17 triggers, 63 índices, 11 secuencias y bucket recibidos. Incluye 25 funciones y
73 políticas tras las correcciones documentadas en el README. Veintiuna funciones
conservan su cuerpo; checkout, snapshot documental y borrado de producto tienen
las correcciones verificadas. No se exportaron usuarios ni datos privados.

No se aplicó SQL ni se modificó el proyecto remoto. Su revisión pública comprobó
registro habilitado, confirmación de correo obligatoria, Google OAuth deshabilitado,
rechazo anónimo de bright-action y acceso HTTP a las dos portadas remotas
referenciadas por el catálogo. No demuestra el CRUD administrativo remoto.

## Pendientes y límites

No se verificaron Site URL/Redirect URLs remotos, SMTP propio ni fecha/versión
exacta del despliegue Edge: requieren acceso de gestión autenticado. Tampoco se
probó despliegue de producción, migración sobre una copia completa del remoto,
Google OAuth, impresora física o carga de múltiples clientes distintos. La prueba
de concurrencia cubre dos solicitudes del mismo carrito. La configuración local
sí se probó y no depende del proyecto remoto.

El workflow de GitHub está preparado, pero no se presenta como ejecutado.
No se fusionó un PR, creó v4.0 ni redactó el informe académico final.

## Verificación de la entrega limpia

Se retiraron guías repetidas, evidencia antigua, ejemplos obsoletos y configuración
del editor. database conserva solo database.sql; las exportaciones y el SQL de
regresión se trasladaron a tests/fixtures y se actualizaron sus referencias.
Después de la limpieza, verify:install volvió a aprobar npm ci, sintaxis y las
32 pruebas. La revisión de archivos candidatos no detectó claves locales, tokens
reales ni claves privadas; los .env y resultados generados permanecen ignorados.
