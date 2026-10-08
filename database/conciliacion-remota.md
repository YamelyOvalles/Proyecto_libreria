# Conciliación del esquema remoto — 7 de octubre de 2026

Fuente: exportación JSON proporcionada por la usuaria desde Supabase. Se conserva en `schema-remoto-2026-10-07.json`, sin registros de negocio ni claves. El SQL local NO es todavía una copia exacta del remoto. No se aplicaron cambios al proyecto.

## Inventario observado

| Objeto | Instalador local | Exportación remota |
| --- | ---: | ---: |
| views | 0 | 0 |
| tables | 19 | 24 |
| buckets | 1 | 1 |
| indexes | 43 | 63 |
| policies | 37 | 58 |
| triggers | 3 | 17 |
| functions | 22 | 24 |
| sequences | 10 | 11 |

## Objetos que faltan en el instalador local

### Tablas completas

- public.direcciones
- public.editoriales
- public.favoritos
- public.libro_categoria
- public.mensajes_contacto

### Columnas adicionales de tablas compartidas

| Tabla | Columnas presentes únicamente en remoto |
| --- | --- |
| autores | `slug` (character varying(200)), `biografia` (text), `activo` (boolean), `actualizado_en` (timestamp with time zone) |
| categorias | `slug` (character varying(140)), `descripcion` (text), `actualizado_en` (timestamp with time zone) |
| contact_messages | `legacy_message_id` (text) |
| inventarios | `stock_minimo` (integer) |
| libro_autor | `orden` (smallint) |
| libros | `editorial_id` (bigint), `anio_publicacion` (smallint) |
| pedido_direcciones_entrega | `direccion_origen_id` (bigint) |
| pedidos | `referencia_transferencia` (character varying(120)) |
| perfiles | `avatar_url` (text) |
| roles | `descripcion` (text) |
| sucursales | `codigo` (character varying(30)), `horario` (text) |
| usuario_roles | `asignado_por` (uuid) |

### Funciones privadas adicionales

- private.calcular_totales_documento()
- private.calcular_totales_pedido()
- private.fijar_actualizado_en()

## Funciones existentes cuyo cuerpo es distinto

Los hashes del cuerpo difieren en estas funciones. Un hash no permite recuperar el código; falta ejecutar `exportar_funciones.sql`.

- private.crear_cotizacion_pedido
- private.crear_perfil_usuario
- private.snapshot_documento_pedido
- public.crear_pedido_desde_carrito
- public.eliminar_producto_admin
- public.generar_factura_pedido

## Otras diferencias relevantes

- El remoto usa una clave primaria compuesta en pedido_detalles y no contiene su columna id ni la secuencia local pedido_detalles_id_seq.
- El remoto no contiene pedidos_numero_seq. El valor por defecto de pedidos.numero y la RPC requieren revisar sus definiciones juntas.
- Hay tipos varchar, longitudes, columnas identity ALWAYS, nombres/definiciones de restricciones e índices diferentes. No son todos simples cambios de nombres.
- El trigger Auth se llama al_crear_usuario_auth en remoto y crear_perfil_al_registrar en local; ambos apuntan a crear_perfil_usuario, cuyo cuerpo difiere.
- El remoto tiene triggers adicionales de actualizado_en y cálculo de totales. No se deben sustituir ni reconstruir sus cuerpos por suposición.
- La función es_activo y las políticas endurecidas de Fase 4 son cambios locales aún no aplicados al remoto.
- El bucket portadas coincide en esta exportación.
- Las restricciones antiguas pedidos_pago_valido y pedidos_estado_valido conviven con las nuevas y rechazan efectivo/tarjeta y devuelto. La migración retira las antiguas; la prueba aislada verifica efectivo y devuelto.
- No se exportaron language/volatility/strict en las funciones. Esos campos añadidos posteriormente al auditor no deben confundirse con modificaciones probadas del código.

## Seguridad y migración

La exportación contiene carrito_propio y carrito_detalles_propios (ALL, permissive). Si se agregan las políticas de Fase 4 sin retirar esas antiguas, se combinan con OR y permiten escrituras de cuentas inactivas. El archivo de migración ahora las retira.

Además, perfiles tiene UPDATE de authenticated y una política propia que permite actualizar activo. Se reprodujo con PostgreSQL aislado que una cuenta inactiva puede reactivarse. La migración revoca UPDATE directo de perfiles, también a nivel de columna. Los cambios administrativos se mantienen mediante RPC/Edge.

**No aplicar todavía la migración al proyecto remoto:** falta revisar el código de las funciones y los triggers exportados y comprobar compatibilidad en una copia aislada. La prueba específica reproduce permisos/políticas; no prueba los cuerpos remotos que aún no tenemos.

## Estado de la conciliación

1. Inventario remoto recibido y conservado: completo para las secciones de la consulta.
2. Diferencias de estructura y permisos identificadas: sí.
3. Definiciones exactas de funciones: pendientes de la segunda exportación de solo lectura.
4. Instalador consolidado fiel al remoto y probado: pendiente; no se inventan funciones faltantes.
5. Auth/SMTP/OAuth, despliegues Edge y archivos Storage: requieren verificación separada; esta exportación solo registra el esquema y la configuración del bucket.
