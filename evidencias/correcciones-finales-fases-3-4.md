# Correcciones de las Fases 3 y 4 — 21 de octubre de 2026

## Alcance y estado real

Se trabajó en **correcciones-fases-3-4**, creada desde fase-3-backend (9c15d7b), la rama más reciente al iniciar. main y fase-4-despliegue permanecieron en 7edaa5b; fase-3-backend conserva su referencia original. No se sobrescribieron cambios locales ajenos: el árbol estaba limpio al iniciar. El propietario autorizó posteriormente la limpieza y publicación de esta rama, sin fusionar otras ramas ni reescribir el historial.

Se implementaron y probaron localmente las correcciones verificables. La ejecución remota, las credenciales del proveedor y la revisión efectiva de otro integrante no pueden darse por completadas desde esta copia. El informe histórico anterior se identifica como tal.

### Comprobación posterior del acceso local

Se verificó un inicio de sesión real como administrador con admin@demo.local y la contraseña privada configurada en scripts/.env.demo, seguido del cierre de esa sesión de diagnóstico. La cuenta pruebaadmin@gmail.com no existe en la pila local consultada; las cuentas del proyecto remoto son independientes. Los errores de autenticación distinguen credenciales incorrectas, correo sin confirmar, límite de intentos y fallos del proveedor sin exponer su respuesta interna. La suite ampliada pasó 46 pruebas; los resultados anteriores corresponden a la entrega inicial descrita más abajo.

| Fase | Problema | Corrección realizada | Prueba ejecutada | Estado |
| --- | --- | --- | --- | --- |
| 3 | Inventario del empleado | Ruta y controlador propios admiten empleado/administrador; cliente rechazado. Se alineó también la compatibilidad con las RPC originales. | HTTP con proveedor simulado, integración con RLS real y navegador registrando una entrada como empleado | COMPLETADO Y VERIFICADO |
| 3 | Logout y renovación | Revocación antes de consultar logout del proveedor; filas revocadas no aceptan saves ni touches antiguos; renovaciones del mismo proceso comparten resultado. | Carrera simulada y renovación de Supabase real mientras otra instancia ejecuta logout; reutilización de cookie rechazada | COMPLETADO Y VERIFICADO |
| 3 | Sesiones persistentes | Almacén PostgreSQL con revocación, secreto estable, UTC y migración aditiva; configuración local generada sin exponer valores. | Reinicio de instancia, dos instancias posteriores, expiración forzada, save/touch revocados y cookie Secure tras proxy simulado | COMPLETADO Y VERIFICADO |
| 3 | README | Guía de la rama de entrega, inicio rápido, variables, sesiones, rutas y pruebas; clonación condicionada a publicación autorizada. | Arranque local descrito, instalación limpia y generación de plantilla remota; las instrucciones de producción se señalan como pendientes | COMPLETADO Y VERIFICADO |
| 3 | Seguridad en producción | Bloqueo de HTTP en modo producción, cookies Secure, CSRF, CSP y comprobaciones de configuración; procedimiento de TLS/RLS/rotación preparado. | Pruebas locales de bloqueo HTTP y proxy HTTPS simulado; no se probó un despliegue HTTPS real ni sus políticas remotas | REQUIERE INTERVENCIÓN MANUAL |
| 4 | Login y CRUD mediante Express | Rutas, controladores, servicios y middleware propios; frontend consume endpoints nativos. Express gestiona Auth Admin y RPC con RLS. | CRUD de usuarios/productos/categorías, carrito, pedidos, facturas, contacto y configuración con Supabase local; navegador, portada y suite heredada | COMPLETADO Y VERIFICADO |
| 4 | Git e historial | Historial auditado, .env de Fase 2 identificado sin divulgarlo, exclusión comprobada y procedimientos de retirada/revisión preparados. No se alteraron autores. | git log, shortlog, ls-tree, check-ignore; acceso web a PR #13 no disponible. No se ejecutó limpieza compartida | REQUIERE INTERVENCIÓN MANUAL |
| 4 | Ejecución simplificada | npm run dev prepara/verifica la pila local e inicia Express desde una terminal; ya no necesita bright-action. Modo remoto preparado. | Setup local, dev con health 200, instalación limpia y flujo completo sin proceso Edge adicional. Proyecto demo remoto pendiente de configurar | COMPLETADO Y VERIFICADO |

El último estado se refiere a la ejecución **local**. La opción remota está **IMPLEMENTADA, PENDIENTE DE VERIFICACIÓN** con un proyecto demo autorizado y sus variables privadas.

## Cambios técnicos

### Express y frontend

- Auth tiene rutas en server/routes/authentication.js, controladores en server/controllers/authentication.js y servicio en server/services/authentication.js. Login, registro, sesión, logout, recuperación, contraseña y callback de correo pasan por Express. El flujo normal entrega identidad/perfil/rol, sin JWT ni refresh token al navegador.
- Los controladores de negocio y tienda validan campos, tipos, roles e identificadores antes de acceder a Supabase. Las rutas principales se documentan en README. Se conservan el controlador dedicado de checkout y el manejo centralizado de errores.
- Los módulos frontend de administración, tienda, carrito, contacto, documentos y login consumen los endpoints propios. El SDK queda para Storage mediante el transporte Express; las portadas públicas conservan su lectura directa. La interfaz y los estilos no se rediseñaron.
- Express crea/elimina cuentas mediante la API Auth Admin. Esa operación requiere una clave privada únicamente del lado servidor, conforme a [la documentación de Supabase](https://supabase.com/docs/reference/javascript/auth-admin-createuser). Antes exige sesión, perfil activo y rol administrador. Esa clave nunca se usa para las consultas SQL: perfiles, roles, libros, historial y RPC utilizan el JWT del usuario y la clave pública, conservando RLS.
- El borrado de productos usa eliminar_producto_admin desde Express. El borrado de usuarios comprueba historial con RLS y prohíbe la autoeliminación. La creación revierte la cuenta de Auth si falla la asignación del perfil; un fallo de esa compensación se informa para revisión administrativa.
- bright-action se conserva para compatibilidad con instalaciones anteriores, con suite propia. La ejecución actual no depende de iniciarla.

### Sesiones y concurrencia

- Se sustituyó el almacén PostgreSQL anterior por una implementación pequeña de express-session con operaciones SQL parametrizadas y actualización condicionada. El motivo es impedir que un save pendiente inserte nuevamente una sesión revocada.
- La migración 20261021_session_revocation.sql añade revoked_at a la tabla de sesiones. No toca tablas comerciales ni elimina políticas existentes. Logout conserva la revocación durante ocho horas y borra los datos de Auth de la fila. Las escrituras antiguas reciben rechazo y los touches no cambian una fila revocada.
- Se revalida la existencia de la sesión alrededor de la renovación. La actualización del almacén también verifica la revocación de forma atómica, para cubrir el intervalo entre lectura y escritura.
- El ID se regenera al autenticar. Se mantienen 30 minutos de inactividad y máximo absoluto de ocho horas. Los vencimientos se guardan/comparan en UTC. Se prueban vencimientos forzados y no se afirma haber esperado ocho horas reales.
- El secreto y la conexión local se guardan en archivos ignorados. Producción rechaza un almacén de memoria. El control de revocación compartido fue probado entre instancias con PostgreSQL real; los límites de intentos siguen siendo por proceso.

### Ejecución y despliegue

- setup local conserva valores existentes, agrega solo los ausentes, captura las salidas de CLI que podrían contener claves, aplica migraciones de sesiones y prepara datos ficticios locales. No reinstala ni resetea la base comercial existente.
- dev verifica Auth, acceso a Auth Admin y columnas del almacén antes de iniciar el watcher de Express. Si Docker está detenido, el operador debe iniciarlo; si el motor está disponible y falta la pila local, el script puede iniciarla.
- setup remoto crea únicamente una plantilla privada. dev:remote utiliza ese destino sin Docker. No se ha creado ni modificado un proyecto remoto ni generado credenciales ficticias como si fueran funcionales.
- El workflow se actualizó para ejecutar Express/Supabase sin la terminal Edge adicional. La ejecución de GitHub Actions actualizada permanece pendiente porque no se publicaron los cambios.

## Resultados ejecutados

| Comando/comprobación | Resultado final | Límites |
| --- | --- | --- |
| npm run check | Correcto | Sintaxis JavaScript |
| npm test | 45/45 | PostgreSQL en memoria y proveedores simulados; no equivale a probar el remoto |
| npm run test:integration | 9/9 | Auth, PostgreSQL, RLS y Auth Admin locales reales; incluye caso contenedor y carrera entre instancias |
| npm run test:sessions:local | 1/1 | PostgreSQL real, Auth simulado; incluye persistencia, expiración, revocación y HTTPS de proxy simulado |
| npm run test:browser:local | 6/6 | Chrome y Supabase locales reales: login/logout/recarga, roles, producto con subida de portada, checkout/PDF, recuperación por correo e inventario de empleado |
| npm run test:browser | 4/4 | Navegador con proveedor simulado; sesión propia y Storage sin tokens |
| npm run test:legacy-edge | 12/12 | Función heredada iniciada temporalmente para comprobar compatibilidad de Fase 4 |
| npm run test:edge | Correcto | Deno verifica tipos de la función existente |
| npm run verify:install | Correcto | Copia temporal sin .env privados, npm ci, sintaxis y 45 pruebas; copia eliminada al terminar |
| npm run setup -- --local | Correcto | Preparación de la pila local y migraciones aditivas |
| npm run dev con PORT=3017 | Correcto, health HTTP 200 | Comando único de desarrollo; solo host local |
| npm run setup -- --remote | Plantilla preparada | No valida un proyecto remoto ni sus credenciales |
| Comparación con 9c15d7b | Sin cambios en SQL comercial, HTML, CSS, configuración Supabase/Docker, Edge y entradas de Vercel | El servidor y el transporte del frontend sí cambiaron y fueron probados |
| Revisión de candidatos y secretos | Sin coincidencias con los valores privados locales comparados | No certifica ausencia de secretos desconocidos en todo el historial |
| git diff --check | Correcto | Las advertencias LF/CRLF de Git no son fallos de prueba |

La prueba de la carrera real deja terminar una renovación auténtica de Supabase después de que otra instancia cierre la sesión y comprueba que la cookie antigua no autentica en ninguna de las dos. La prueba del almacén comprueba además que un save/touch viejo no la restaura. Son comprobaciones distintas y ambas se ejecutaron.

## Errores encontrados durante la implementación

- Permiso de inventario inconsistente entre Express y PostgreSQL: corregido y cubierto en HTTP, integración y navegador.
- Restauración de sesión tras logout: corregida con revocación compartida y escritura condicionada; prueba real añadida.
- Diferencia de zona horaria al enviar Date hacia una columna timestamp: corregida con conversión explícita a UTC; la sesión ahora persiste al recargar y entre instancias.
- Consulta de impuestos sin token del usuario: corregida para pasar la identidad validada al servicio; el recorrido de compra real termina en cotización y PDF.
- Contacto autenticado: se conserva el JWT del usuario en la ruta pública cuando hay sesión, para que el mensaje mantenga su asociación con la cuenta; la integración comprueba esa relación y también el envío anónimo.
- ISBN de prueba fuera de la restricción de PostgreSQL: corregidos los datos y la validación del servidor para ISBN de 13 dígitos o formato de 10 caracteres.
- Navegación simultánea en el test de logout/cambio de rol: la prueba ahora espera la redirección antes de iniciar la navegación siguiente. La última ejecución completa aprobó los seis casos.
- Durante la reanudación Docker estaba detenido: se inició el motor y se repitió la preparación local. No se presentó la falta de servicio como un fallo confirmado de la lógica de negocio.

## Archivos modificados/agregados

- Documentación y CI: README.md, .github/workflows/fase4-tests.yml, evidencias/mejoras-arquitectura-sesiones.md, evidencias/git-seguridad-y-revision.md y este informe.
- Frontend: js/admin.js, js/app.js, js/auth.js, js/checkout.js, js/documento.js, js/login.js, js/supabase-client.js, js/tienda.js y js/validaciones.js.
- Dependencias/comandos: package.json, package-lock.json. Se retiró connect-pg-simple al sustituir su almacén; se conserva pg.
- Ejecución: scripts/local-config.js, scripts/migrate-sessions.js, scripts/setup.js, scripts/preflight.js y scripts/dev.js.
- Configuración: server/.env.example, server/config.js y server/app.js. Las variables privadas locales se agregaron a server/.env.local sin versionarlas. setup remoto preparó server/.env.remote con marcadores, ignorado por Git.
- Rutas/controladores: server/routes/authentication.js, server/routes/business.js, server/routes/supabase.js, server/controllers/authentication.js, server/controllers/business.js y server/controllers/store.js.
- Servicios/middleware: server/services/application-auth.js, server/services/authentication.js, server/services/business.js, server/services/session-store.js, server/services/supabase.js, server/middleware/sessions.js y server/middleware/validation.js.
- Migración: database/migrations/20261021_session_revocation.sql.
- Pruebas: tests/express-business.test.js, tests/express.integration.test.js, tests/session-store.integration.test.js, tests/frontend.test.js, tests/database.test.js, tests/browser/session.spec.js y tests/local-browser/auth.spec.js.

## Instalación de esta entrega local

Con Node.js 22+ y Docker Desktop iniciado, desde la carpeta de esta rama:

```powershell
npm.cmd install
npm.cmd run dev
```

Si la configuración existente necesita preparación, ejecuta primero npm.cmd run setup -- --local. Abre http://localhost:3000. Para Linux/macOS usa npm. El modo remoto requiere completar las variables privadas y preparar un proyecto autorizado; consulta README antes de ejecutar migraciones allí.

## Intervenciones manuales y riesgos pendientes

1. **Producción y demo remoto:** proveer variables privadas, acceso del rol de sesiones a su tabla, esquema/RLS reales, bucket, correo y redirecciones; comprobar TLS, cookies y persistencia en el host. No se dispone de esas comprobaciones. El secreto no debe cambiar entre instancias o reinicios.
2. **Rotación:** cambiar en Supabase Auth la contraseña administrativa publicada y cualquier credencial reutilizada/comprometida. No se hizo una rotación remota. Las cuentas ficticias locales utilizan el valor privado preparado para pruebas.
3. **Historial:** .env sigue en la referencia original de Fase 2, conservada por alcance. Su retirada actual y posible limpieza histórica están preparadas en el procedimiento de seguridad; no se reescribió historial compartido ni se autorizó force push.
4. **PR #13 e informe académico:** contrastar las revisiones en GitHub con acceso real y corregir el informe externo si corresponde. Otro integrante debe revisar efectivamente este trabajo; no se han fabricado revisiones, commits ni autorías.
5. **Varias instancias:** las sesiones y su revocación comparten PostgreSQL. El limitador de intentos requiere un almacén compartido si se desea un límite global. En hosts efímeros debe comprobarse también la limpieza periódica de sesiones vencidas.
6. **GitHub Actions:** el workflow se preparó y los comandos equivalentes se probaron localmente; no se afirma una ejecución nueva del workflow remoto sin publicación.

Se conservaron las funcionalidades originales comprobadas: roles, catálogo, portadas, carrito, CRUD, inventario, pedidos, cotizaciones/PDF, facturas, configuración documental, contacto y recuperación de contraseña. Esto está respaldado por los recorridos locales indicados, no por la mera existencia de código. La verificación de producción sigue abierta.
