# Librería Quisqueya — correcciones de las Fases 3 y 4

Aplicación académica de ISW-306. Express gestiona autenticación, sesiones y operaciones de negocio; Supabase conserva Auth, PostgreSQL, RLS y Storage. La interfaz HTML/CSS existente se conserva.

## Versión de esta entrega

La rama de esta entrega es **correcciones-fases-3-4**, creada desde fase-3-backend (9c15d7b), la versión más reciente al iniciar las correcciones. main y fase-4-despliegue estaban en 7edaa5b y no se modificaron. Por indicación del usuario esta entrega se mantiene local, sin push ni merge.

Trabaja desde la carpeta de esta entrega. Cuando el propietario autorice publicarla, una copia nueva podrá obtenerse con:

~~~powershell
git clone --branch correcciones-fases-3-4 https://github.com/YamelyOvalles/Proyecto_libreria.git
cd Proyecto_libreria
~~~

Ese comando de clonación solo funciona después de publicar la rama. Los informes anteriores en evidencias describen sus respectivas versiones; el estado actual está en [el informe final](evidencias/correcciones-finales-fases-3-4.md).

## Inicio rápido con Docker

Requisitos: Node.js 22 o superior, npm, Git y Docker Desktop iniciado con contenedores Linux. En Windows utiliza npm.cmd; en Linux/macOS utiliza npm.

Desde la carpeta del proyecto:

~~~powershell
npm.cmd install
npm.cmd run dev
~~~

En una copia nueva sin configuración, dev prepara Supabase local, genera archivos privados, aplica únicamente las migraciones aditivas de sesiones y crea las cuentas demo. La primera descarga de imágenes puede tardar. Los mensajes de Supabase CLI que contienen claves se capturan y no se imprimen.

Si ya tienes configuración local, dev la conserva y comprueba Auth y la tabla de sesiones antes de iniciar Express. Si el esquema de sesiones necesita actualizarse o quieres preparar el entorno explícitamente:

~~~powershell
npm.cmd run setup -- --local
npm.cmd run dev
~~~

Abre **http://localhost:3000**. Solo necesitas mantener el comando dev en una terminal. La aplicación ya no requiere iniciar bright-action por separado: Express crea y elimina cuentas mediante Auth Admin y procesa los productos con las RPC existentes.

setup conserva las variables existentes y agrega solo las ausentes; no sobrescribe server/.env. Las cuentas demo de la pila local son admin@demo.local, empleado@demo.local, cliente@demo.local, otro@demo.local e inactivo@demo.local. Su contraseña aleatoria está únicamente como DEMO_PASSWORD en scripts/.env.demo, ignorado por Git. Consúltala localmente sin copiarla a informes ni mensajes. No son cuentas del proyecto remoto.

Para reiniciar Express usa Ctrl+C y npm.cmd run dev. Docker puede permanecer encendido. Para detener deliberadamente la pila local usa npx.cmd supabase stop; los datos locales se conservan. No es necesario reiniciar ni reinstalar la base comercial.

## Opción con Supabase remoto de demostración

Un proyecto demo remoto debe pertenecer al equipo o estar autorizado. No se ha creado, reconfigurado ni validado un proyecto remoto durante esta entrega.

~~~powershell
npm.cmd run setup -- --remote
~~~

Completa el archivo privado server/.env.remote generado desde server/.env.example. Necesitas URL y clave pública del proyecto, conexión PostgreSQL para sesiones y la clave privada de Auth Admin para crear/eliminar cuentas. El administrador del proyecto debe disponer previamente del esquema comercial, RLS, Storage y redirecciones de correo.

Aplica la migración de sesiones al destino remoto seleccionado solo con autorización del propietario. Para ello establece sus variables como variables del proceso o usa server/.env; el comando sin --local lee ese archivo. No ejecutes database/database.sql sobre una base existente.

~~~powershell
npm.cmd run sessions:migrate
npm.cmd run dev:remote
~~~

dev:remote lee server/.env.remote y no inicia Docker ni la CLI. La conexión al proyecto demo y su configuración siguen pendientes de verificación con credenciales privadas. Puedes elegir explícitamente .env, .env.local o .env.remote mediante LIBRERIA_ENV_FILE.

## Variables privadas y despliegue

| Variable | Uso |
| --- | --- |
| SUPABASE_URL | URL del proyecto; local o HTTPS de Supabase |
| SUPABASE_ANON_KEY | Clave pública anon/publishable; preserva RLS |
| SUPABASE_AUTH_ADMIN_KEY | Clave secret/service_role usada exclusivamente para Auth Admin en el servidor |
| SESSION_SECRET | Secreto aleatorio de al menos 32 caracteres, estable entre reinicios e instancias |
| SESSION_DATABASE_URL | Conexión privada a PostgreSQL para el almacén de sesiones |
| NODE_ENV | production en el host de producción; development para ejecución local |
| PORT | Puerto de Express; 3000 de forma predeterminada |
| LIBRERIA_ENV_FILE | Selección explícita de archivo de entorno para scripts y servidor |
| DEMO_PASSWORD | Solo scripts/.env.demo: contraseña de cuentas ficticias locales |

SUPABASE_AUTH_ADMIN_KEY nunca se envía al navegador ni se utiliza para consultas SQL. Express exige rol administrador antes de llamar a Auth Admin. Las consultas de libros, perfiles, roles y demás datos utilizan exclusivamente la clave pública y el JWT del usuario. No se desactiva RLS. La API pública de configuración devuelve solo URL y clave pública.

En producción son obligatorios el secreto y PostgreSQL; se rechaza MemoryStore. La conexión remota de sesiones exige sslmode=verify-full. El usuario del almacén debe ser propietario exclusivamente de la tabla de sesiones o tener una política RLS específica; otorgar CRUD sin política no basta. El propietario de la base prepara ese acceso y aplica las migraciones. Mantén protegidos secretos, conexión y copias de seguridad.

Express exige HTTPS en producción y confía en un salto de proxy; el proxy del host debe ser confiable y preservar el protocolo original. Las cookies son HttpOnly, SameSite=Lax y Secure en producción. Vercel conserva api/index.js y vercel.json; exige las mismas variables y conectividad con el almacén PostgreSQL. El HTTPS y el despliegue reales siguen pendientes de comprobación externa.

## Sesiones y seguridad

La sesión de aplicación se guarda en Express/PostgreSQL. El navegador recibe identidad, perfil y rol; no recibe JWT ni refresh tokens para el flujo normal de Auth. Los enlaces de recuperación se intercambian en Express y se elimina su fragmento de URL. El SDK se conserva para portadas a través de Express, sin gestionar Auth.

La sesión tiene 30 minutos de inactividad y máximo de ocho horas. El ID se regenera al autenticar; Express renueva el token y comprueba usuario, perfil activo y rol. Logout revoca primero la sesión propia y limpia la cookie. Las revocaciones permanecen ocho horas; una escritura o touch antiguo no puede restaurarlas, tampoco entre instancias. Las fechas del almacén se manejan en UTC. Las pruebas fuerzan vencimientos y concurrencia, sin esperar ocho horas de reloj.

Las modificaciones exigen X-Libreria-Request: 1; se rechazan orígenes ajenos y no se habilita CORS. Hay validación de entradas, límites de tamaño, Helmet/CSP y limitación de intentos por proceso. Un despliegue con varias instancias debe agregar un limitador compartido para un límite global; el almacén de sesiones ya es compartido.

Las contraseñas administrativas publicadas anteriormente deben cambiarse en Supabase Auth y donde se hayan reutilizado. No se declara completada ninguna rotación remota. El procedimiento de Git e historial está en [evidencias/git-seguridad-y-revision.md](evidencias/git-seguridad-y-revision.md).

## Rutas principales de Express

| Método y ruta | Permiso y responsabilidad |
| --- | --- |
| POST /api/auth/login, /register, /recover, /exchange | Autenticación/recuperación mediante controlador y servicio |
| GET /api/auth/session | Verifica sesión, actividad y rol |
| POST /api/auth/logout | Revoca sesión propia y cierra sesión de Auth |
| PUT /api/auth/password | Cambia contraseña del usuario autenticado |
| GET /api/catalogo | Catálogo público |
| GET /api/catalogo/impuestos, /api/sucursales | Datos de compra para usuario autenticado |
| GET /api/productos, /api/categorias | Personal |
| POST, PUT, DELETE /api/productos[/id], /api/categorias[/id] | Administrador; RPC transaccionales |
| GET, POST, PUT, DELETE /api/usuarios[/id] | Administrador; historial protegido y sin autoeliminación |
| GET /api/inventario; POST /api/inventario/ajustes | Empleado o administrador |
| GET /api/carrito; PUT /api/carrito/items/:id | Carrito propio; identidad tomada de la sesión |
| POST /api/pedidos | Checkout con precios/stock/documentos calculados por PostgreSQL |
| GET /api/pedidos; PATCH /api/pedidos/:id/estado o /pago | Personal |
| POST /api/pedidos/:id/factura | Personal; conserva restricciones y transacciones |
| GET /api/documentos/:tipo/:id | Propietario o personal, según RLS |
| GET/PUT /api/configuracion | Lectura de personal; escritura de administrador |
| POST /api/contacto; GET/PATCH /api/mensajes[/id] | Contacto público; gestión de administrador |

El frontend principal consume estas rutas. /api/supabase se conserva para compatibilidad y transporte de Storage; las portadas públicas pueden descargarse directamente del proveedor. bright-action sigue en el repositorio para instalaciones anteriores y tiene pruebas separadas; no es una dependencia del arranque actual.

server/routes define rutas; server/controllers valida y coordina solicitudes; server/services ejecuta Auth, consultas, RPC y persistencia; server/middleware aplica sesiones, CSRF, validación y errores. PostgreSQL sigue siendo la autoridad transaccional de precios, inventario, pedidos y documentos.

## Migraciones, datos y pruebas

database/database.sql conserva el instalador comercial de Fase 4. Las migraciones en database/migrations agregan exclusivamente el almacén de sesiones y su revocación; son repetibles y no reinstalan las tablas comerciales.

~~~powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:sessions:local
npm.cmd run test:browser
npm.cmd run test:browser:local
~~~

La suite aislada usa proveedores simulados y PostgreSQL en memoria. Las pruebas de integración y navegador local requieren setup y usan datos ficticios de la pila local; crean usuarios, productos, movimientos, pedidos y documentos. Conservan el historial generado y no aceptan proyectos remotos. Playwright genera resultados ignorados por Git. Si no está instalado Chromium, usa npx.cmd playwright install chromium. En Windows puedes seleccionar Chrome existente con PLAYWRIGHT_EXECUTABLE_PATH.

Para la función heredada, opcionalmente inicia npx.cmd supabase functions serve bright-action --no-verify-jwt y ejecuta npm.cmd run test:legacy-edge. npm.cmd run test:edge comprueba sus tipos si tienes Deno. Esto no es necesario para usar la aplicación actual.

El workflow de GitHub ejecuta las suites de Express, PostgreSQL y navegador sobre una pila local efímera. La ejecución remota del workflow solo puede comprobarse después de publicar los cambios y contar con la participación real de otro integrante.

## Si algo falla

- Docker no responde: abre Docker Desktop y espera el motor Linux; vuelve a ejecutar setup.
- Faltan variables o tabla de sesiones: prepara el destino correcto con setup local o la migración autorizada remota.
- El puerto 3000 está ocupado: usa PORT con otro puerto; los correos locales están configurados para localhost:3000.
- Crear/eliminar cuentas devuelve error de configuración: revisa SUPABASE_AUTH_ADMIN_KEY privada en Express.
- 401/403: comprueba sesión, actividad y rol; un cliente no puede modificar inventario ni acceder al panel.
- Correo local: revisa Mailpit en http://127.0.0.1:54324.
- La configuración existente apunta a otro destino: setup se detiene para conservarla; selecciónala explícitamente.

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
