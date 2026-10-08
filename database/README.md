# Base de datos y configuración de Supabase

**Actualización tras recibir la exportación remota:** la comparación encontró diferencias
reales. El inventario remoto tiene 24 tablas, 24 funciones, 58 políticas y 17 triggers;
el instalador local todavía no reproduce todos esos objetos. Consulta
[conciliacion-remota.md](conciliacion-remota.md) y el inventario
[schema-remoto-2026-10-07.json](schema-remoto-2026-10-07.json).
Faltan los cuerpos de funciones: ejecutar [exportar_funciones.sql](exportar_funciones.sql),
de solo lectura. No aplicar la migración al remoto hasta revisar esos cuerpos y probar
la conciliación completa en aislamiento.

`database.sql` es el instalador consolidado de una base **nueva**. No depende de ejecutar
primero la migración de Fase 4: ya contiene sus funciones y políticas actualizadas.
`migrations/004_security_checkout.sql` sirve para actualizar una base compatible de Fase 3,
después de revisar su esquema y respaldarla. No ejecutar el instalador completo sobre la base existente.

## Cobertura comprobada el 7 de octubre de 2026

Se ejecutó el SQL completo en PostgreSQL aislado y se compararon las referencias del frontend,
Express y `bright-action` con los objetos realmente creados por el instalador.

| Objeto | Incluido en database.sql |
| --- | --- |
| Tablas públicas | 19: roles, perfiles, usuario_roles, autores, categorias, libros, libro_autor, inventarios, sucursales, carritos, carrito_detalles, pedidos, pedido_detalles, pedido_direcciones_entrega, movimientos_inventario, contact_messages, configuracion_negocio, cotizaciones, facturas |
| RPC públicas | 14: crear_pedido_desde_carrito, actualizar_estado_pedido, actualizar_pago_pedido, guardar_producto_admin, eliminar_producto_admin, ajustar_inventario_admin, listar_movimientos_inventario, listar_usuarios_admin, actualizar_usuario_admin, guardar_categoria_admin, eliminar_categoria_admin, enviar_mensaje_contacto, generar_factura_pedido, guardar_configuracion_negocio |
| Funciones privadas | 8: es_admin, es_personal, es_activo, crear_perfil_usuario, snapshot_documento_pedido, crear_cotizacion_pedido, cotizar_pedido_al_confirmar, sincronizar_estado_documentos |
| RLS y políticas | RLS en las 19 tablas públicas; 37 políticas, incluidas 4 de Storage |
| Triggers de aplicación | 3: crear_perfil_al_registrar, crear_cotizacion_al_confirmar_pedido, sincronizar_documentos_al_cambiar_pedido |
| Restricciones, índices, secuencias | Definidos por el instalador; la auditoría registra columnas, claves, checks, valores por defecto, 43 índices y 10 secuencias, sin sus contadores actuales |
| Storage | Bucket portadas público, máximo 5 MiB, JPEG/PNG/WebP; escritura restringida por rol/perfil activo |
| Datos iniciales | Roles, configuración de negocio, sucursal, autores, categorías, 4 libros, inventario y movimientos iniciales |

La comprobación automatizada valida tablas y relaciones seleccionadas, columnas de SELECT,
nombres/parámetros de RPC usados en llamadas literales y bucket. Las llamadas dinámicas de
documentos/historial se registran explícitamente en el auditor. No es un análisis completo de
todas las expresiones JavaScript posibles. Las pruebas funcionales SQL complementan ese control.

## Lo que requiere otros archivos o configuración

El SQL no despliega un servicio de Auth ni una Edge Function. Para reproducir **la aplicación
completa** se necesitan también estos elementos, mantenidos en el mismo repositorio:

| Elemento | Archivo o procedimiento |
| --- | --- |
| Supabase Auth, PostgreSQL y Storage locales | `supabase/config.toml`, iniciar Supabase con Docker; los esquemas de infraestructura los suministra Supabase |
| Código de bright-action y autorización administrativa | `supabase/functions/bright-action/index.ts` |
| Versiones/dependencias de la función | `supabase/functions/deno.json` y `deno.lock` |
| Validación JWT en gateway de Edge | `[functions.bright-action] verify_jwt=false`; la función valida token/rol/perfil internamente |
| Usuarios y actividad ficticia de demostración | `scripts/seed-demo.js`, exclusivamente local; usa Auth Admin para cuentas y RPC para pedidos/documentos/mensajes |
| Variables públicas del servidor y secretos locales | Ejemplos `.env` e instrucciones del README principal; los secretos no se versionan |
| Auth remoto: redirect URLs, confirmación, Google y SMTP | Configurar en Dashboard; no se han exportado ni verificado sus valores remotos actuales |
| Archivos subidos a Storage | Se deben respaldar/exportar aparte. El bucket y sus políticas no incluyen los bytes de las imágenes subidas |
| Usuarios, historial y cambios de datos del proyecto remoto | No están copiados al instalador. No es un respaldo de registros ni de cuentas Auth |

## Comparar el Supabase remoto sin modificarlo

La configuración disponible en esta copia tiene solo URL y clave pública. La solicitud de
metadatos OpenAPI al proyecto respondió **401**. En ese momento no se contaba con una
exportación administrativa del esquema remoto. La usuaria aportó después la exportación: ahora conocemos
las diferencias, pero todavía **no se puede afirmar que database.sql sea una copia
exacta de todo lo instalado en ese proyecto**. No se modificó el proyecto al hacer esta revisión.

1. En **SQL Editor** del proyecto correcto, ejecutar [verificar_esquema.sql](verificar_esquema.sql).
   Contiene únicamente una consulta SELECT de estructura/permisos y configuración de buckets;
   no devuelve registros de clientes, cuentas, pedidos ni claves. Las funciones se identifican
   también por el hash de su cuerpo para detectar cambios de lógica sin exportar sus cuerpos.
2. Exportar la única fila como JSON y guardarla localmente como `database/.schema.remote.json`
   (ignorado por Git). Se acepta el objeto, la fila `schema_snapshot` o el arreglo de filas del editor.
3. Desde la raíz:

```powershell
npm.cmd run db:audit
npm.cmd run db:audit -- database/.schema.remote.json
```

El primer comando comprueba únicamente el instalador local. El segundo añade la comparación
con la exportación real: marca objetos solo locales, solo remotos o diferentes. Devuelve error
si hay diferencias; no aplica cambios ni sincroniza automáticamente. Compara columnas,
restricciones, permisos, RLS, funciones/parámetros/cuerpos, políticas, triggers, índices,
secuencias, vistas y buckets. Las diferencias de formato/versiones o permisos predeterminados
requieren revisión; no equivalen automáticamente a un defecto. Los cambios exclusivamente
locales de Fase 4 son esperables hasta aplicar su migración autorizada.

Si aparecen tablas/funciones/políticas adicionales o distintas en remoto, revisar sus definiciones
antes de incorporarlas al instalador; no borrarlas ni sustituirlas solo para hacer coincidir los archivos.
La configuración remota de Auth/SMTP/OAuth, los despliegues Edge y los archivos de Storage
se verifican por separado siguiendo el README principal.
