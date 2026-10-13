-- Librería Quisqueya: INSTALADOR ÚNICO para un Supabase NUEVO.
-- Ejecutar TODO este archivo una vez en SQL Editor, o con Supabase local.
-- No necesita migraciones ni los JSON de auditoría para instalarse.
-- No ejecutar sobre el proyecto existente: no es una migración ni un respaldo de registros.
-- Fuente: esquema remoto 2026-10-07 y 24 definiciones recibidas 2026-10-12.
-- Conserva su estructura; diferencias de seguridad y correcciones: conciliacion-remota.md.
-- Supabase proporciona auth.users, auth.uid(), storage y los roles de infraestructura.
-- No instala contraseñas ni usuarios Auth manualmente: demos mediante npm run demo:seed.
-- Evaluación: ejecutar aquí en SQL Editor de un Supabase nuevo; configurar Express
-- con URL/clave pública y ejecutar bright-action según README. En Supabase LOCAL,
-- supabase start carga este archivo automáticamente y demo:seed crea los roles demo.
-- Probado en PostgreSQL 18.3 WASM. PostgreSQL 17/Supabase completo: pendiente de Docker.
begin;
set local search_path = public, extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;


create sequence "public"."cotizaciones_numero_seq" as bigint increment by 1 minvalue 1 start with 1 no cycle;

create sequence "public"."facturas_numero_seq" as bigint increment by 1 minvalue 1 start with 1 no cycle;

-- 1. Las 24 tablas del inventario remoto (columnas e identidad conservadas).
create table "public"."autores" (
    "id" bigint generated always as identity not null,
    "nombre" character varying(180) not null,
    "slug" character varying(200),
    "biografia" text,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."carrito_detalles" (
    "carrito_id" uuid not null,
    "libro_id" bigint not null,
    "cantidad" integer not null,
    "agregado_en" timestamp with time zone default now() not null
);

create table "public"."carritos" (
    "id" uuid default gen_random_uuid() not null,
    "perfil_id" uuid default auth.uid() not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."categorias" (
    "id" bigint generated always as identity not null,
    "nombre" character varying(120) not null,
    "slug" character varying(140),
    "descripcion" text default ''::text,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."configuracion_negocio" (
    "id" smallint default 1 not null,
    "nombre_comercial" text default 'Libreria Quisqueya'::text not null,
    "razon_social" text default 'Libreria Quisqueya'::text not null,
    "eslogan" text,
    "rnc" text,
    "direccion" text,
    "ciudad" text,
    "provincia" text,
    "pais" text default 'Republica Dominicana'::text not null,
    "telefono" text,
    "correo" text,
    "sitio_web" text,
    "logo_url" text default 'assets/logo-quisqueya-profesional.png'::text not null,
    "atendido_por_default" text,
    "cotizacion_prefijo" text default 'COT'::text not null,
    "cotizacion_validez_dias" integer default 15 not null,
    "cotizacion_tiempo_entrega" text,
    "cotizacion_condiciones" text,
    "cotizacion_notas" text,
    "cotizacion_mostrar_itbis" boolean default true not null,
    "cotizacion_itbis_pct" numeric(5,2) default 18 not null,
    "factura_prefijo" text default 'FAC'::text not null,
    "factura_condicion_pago" text default 'contado'::text not null,
    "factura_dias_credito" integer default 30 not null,
    "factura_condiciones" text,
    "factura_notas" text,
    "factura_mostrar_itbis" boolean default true not null,
    "factura_itbis_pct" numeric(5,2) default 18 not null,
    "actualizado_por" uuid,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."contact_messages" (
    "id" uuid default gen_random_uuid() not null,
    "legacy_message_id" text,
    "user_id" uuid,
    "nombre" text not null,
    "correo" text not null,
    "telefono" text,
    "asunto" text not null,
    "mensaje" text not null,
    "estado" text default 'pendiente'::text not null,
    "created_at" timestamp with time zone default now() not null
);

create table "public"."cotizaciones" (
    "id" uuid default gen_random_uuid() not null,
    "numero" text not null,
    "pedido_id" uuid not null,
    "cliente_id" uuid not null,
    "fecha_emision" date default CURRENT_DATE not null,
    "valida_hasta" date not null,
    "estado" text default 'emitida'::text not null,
    "subtotal" numeric(12,2) not null,
    "descuento" numeric(12,2) default 0 not null,
    "itbis" numeric(12,2) default 0 not null,
    "total" numeric(12,2) not null,
    "snapshot" jsonb not null,
    "creado_por" uuid,
    "creado_en" timestamp with time zone default now() not null
);

create table "public"."direcciones" (
    "id" bigint generated always as identity not null,
    "perfil_id" uuid default auth.uid() not null,
    "alias" character varying(60),
    "destinatario" character varying(160) not null,
    "telefono" character varying(25) not null,
    "linea_1" character varying(200) not null,
    "linea_2" character varying(200),
    "sector" character varying(120),
    "ciudad" character varying(100) not null,
    "provincia" character varying(100) not null,
    "codigo_postal" character varying(15),
    "referencia" text,
    "es_principal" boolean default false not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."editoriales" (
    "id" bigint generated always as identity not null,
    "nombre" character varying(160) not null,
    "slug" character varying(180) not null,
    "sitio_web" text,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."facturas" (
    "id" uuid default gen_random_uuid() not null,
    "numero" text not null,
    "pedido_id" uuid not null,
    "cliente_id" uuid not null,
    "ncf" text,
    "fecha_emision" date default CURRENT_DATE not null,
    "fecha_vencimiento" date,
    "condicion_pago" text not null,
    "estado" text default 'emitida'::text not null,
    "subtotal" numeric(12,2) not null,
    "descuento" numeric(12,2) default 0 not null,
    "itbis" numeric(12,2) default 0 not null,
    "total" numeric(12,2) not null,
    "snapshot" jsonb not null,
    "creado_por" uuid,
    "creado_en" timestamp with time zone default now() not null
);

create table "public"."favoritos" (
    "perfil_id" uuid default auth.uid() not null,
    "libro_id" bigint not null,
    "creado_en" timestamp with time zone default now() not null
);

create table "public"."inventarios" (
    "libro_id" bigint not null,
    "cantidad_existencia" integer default 0 not null,
    "cantidad_reservada" integer default 0 not null,
    "cantidad_disponible" integer generated always as ((cantidad_existencia - cantidad_reservada)) stored,
    "stock_minimo" integer default 0 not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."libro_autor" (
    "libro_id" bigint not null,
    "autor_id" bigint not null,
    "orden" smallint default 1 not null
);

create table "public"."libro_categoria" (
    "libro_id" bigint not null,
    "categoria_id" bigint not null
);

create table "public"."libros" (
    "id" bigint generated always as identity not null,
    "isbn" character varying(13) not null,
    "titulo" character varying(250) not null,
    "descripcion" text,
    "precio" numeric(12,2) not null,
    "formato" character varying(30) not null,
    "idioma" character varying(10) default 'es'::character varying not null,
    "imagen_portada" text,
    "editorial_id" bigint,
    "anio_publicacion" smallint,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null,
    "editorial" text,
    "categoria_id" bigint,
    "stock_minimo" integer default 5 not null,
    "descuento_pct" numeric(5,2) default 0 not null
);

create table "public"."mensajes_contacto" (
    "id" bigint generated always as identity not null,
    "perfil_id" uuid default auth.uid(),
    "nombre" character varying(160) not null,
    "correo" character varying(320) not null,
    "telefono" character varying(25),
    "motivo" character varying(30) not null,
    "mensaje" text not null,
    "estado" character varying(20) default 'nuevo'::character varying not null,
    "respuesta" text,
    "respondido_por" uuid,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."movimientos_inventario" (
    "id" bigint generated always as identity not null,
    "libro_id" bigint not null,
    "pedido_id" uuid,
    "realizado_por" uuid,
    "tipo" character varying(20) not null,
    "cambio_existencia" integer default 0 not null,
    "cambio_reservada" integer default 0 not null,
    "motivo" text not null,
    "creado_en" timestamp with time zone default now() not null
);

create table "public"."pedido_detalles" (
    "pedido_id" uuid not null,
    "libro_id" bigint not null,
    "isbn" character varying(13) not null,
    "titulo" character varying(250) not null,
    "precio_unitario" numeric(12,2) not null,
    "cantidad" integer not null,
    "subtotal" numeric(12,2) generated always as ((precio_unitario * (cantidad)::numeric)) stored,
    "descuento_pct" numeric(5,2) default 0 not null,
    "descuento" numeric(12,2) generated always as (round((((precio_unitario * (cantidad)::numeric) * descuento_pct) / (100)::numeric), 2)) stored,
    "total_linea" numeric(12,2) generated always as (((precio_unitario * (cantidad)::numeric) - round((((precio_unitario * (cantidad)::numeric) * descuento_pct) / (100)::numeric), 2))) stored
);

create table "public"."pedido_direcciones_entrega" (
    "pedido_id" uuid not null,
    "direccion_origen_id" bigint,
    "destinatario" character varying(160) not null,
    "telefono" character varying(25) not null,
    "linea_1" character varying(200) not null,
    "linea_2" character varying(200),
    "sector" character varying(120),
    "ciudad" character varying(100) not null,
    "provincia" character varying(100) not null,
    "codigo_postal" character varying(15),
    "referencia" text
);

create table "public"."pedidos" (
    "id" uuid default gen_random_uuid() not null,
    "numero" character varying(32) default ((('LQ-'::text || to_char(clock_timestamp(), 'YYYYMMDD'::text)) || '-'::text) || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8))) not null,
    "cliente_id" uuid,
    "cliente_nombre" character varying(200) not null,
    "cliente_correo" character varying(320) not null,
    "metodo_entrega" character varying(20) not null,
    "sucursal_id" bigint,
    "metodo_pago" character varying(30) not null,
    "estado_pago" character varying(20) default 'pendiente'::character varying not null,
    "referencia_transferencia" character varying(120),
    "estado" character varying(25) default 'pendiente'::character varying not null,
    "subtotal" numeric(12,2) not null,
    "costo_envio" numeric(12,2) default 0 not null,
    "total" numeric(12,2) not null,
    "notas" text,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null,
    "cliente_documento" text,
    "cliente_telefono" text,
    "descuento" numeric(12,2) default 0 not null,
    "itbis" numeric(12,2) default 0 not null
);

create table "public"."perfiles" (
    "id" uuid not null,
    "nombres" character varying(100) not null,
    "apellidos" character varying(100),
    "telefono" character varying(25),
    "avatar_url" text,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."roles" (
    "id" smallint generated always as identity not null,
    "codigo" character varying(30) not null,
    "nombre" character varying(60) not null,
    "descripcion" text
);

create table "public"."sucursales" (
    "id" bigint generated always as identity not null,
    "codigo" character varying(30) not null,
    "nombre" character varying(120) not null,
    "direccion" text not null,
    "ciudad" character varying(100) not null,
    "provincia" character varying(100) not null,
    "telefono" character varying(25),
    "horario" text,
    "activo" boolean default true not null,
    "creado_en" timestamp with time zone default now() not null,
    "actualizado_en" timestamp with time zone default now() not null
);

create table "public"."usuario_roles" (
    "usuario_id" uuid not null,
    "rol_id" smallint not null,
    "asignado_por" uuid,
    "asignado_en" timestamp with time zone default now() not null
);

-- 2. Restricciones e índices. Solo se omiten los tres CHECK antiguos documentados.
alter table "public"."autores" add constraint "autores_pkey" PRIMARY KEY (id);

alter table "public"."autores" add constraint "autores_slug_key" UNIQUE (slug);

alter table "public"."carrito_detalles" add constraint "carrito_cantidad_valida" CHECK (((cantidad >= 1) AND (cantidad <= 999)));

alter table "public"."carrito_detalles" add constraint "carrito_detalles_pkey" PRIMARY KEY (carrito_id, libro_id);

alter table "public"."carritos" add constraint "carritos_pkey" PRIMARY KEY (id);

alter table "public"."carritos" add constraint "un_carrito_por_cliente" UNIQUE (perfil_id);

alter table "public"."categorias" add constraint "categorias_pkey" PRIMARY KEY (id);

alter table "public"."categorias" add constraint "categorias_slug_key" UNIQUE (slug);

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_cotizacion_itbis_pct_check" CHECK (((cotizacion_itbis_pct >= (0)::numeric) AND (cotizacion_itbis_pct <= (100)::numeric)));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_cotizacion_validez_dias_check" CHECK (((cotizacion_validez_dias >= 1) AND (cotizacion_validez_dias <= 365)));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_factura_condicion_pago_check" CHECK ((factura_condicion_pago = ANY (ARRAY['contado'::text, 'credito'::text])));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_factura_dias_credito_check" CHECK (((factura_dias_credito >= 1) AND (factura_dias_credito <= 365)));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_factura_itbis_pct_check" CHECK (((factura_itbis_pct >= (0)::numeric) AND (factura_itbis_pct <= (100)::numeric)));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_id_check" CHECK ((id = 1));

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_pkey" PRIMARY KEY (id);

alter table "public"."contact_messages" add constraint "contact_messages_asunto_check" CHECK ((char_length(btrim(asunto)) >= 3));

alter table "public"."contact_messages" add constraint "contact_messages_correo_check" CHECK ((correo ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'::text));

alter table "public"."contact_messages" add constraint "contact_messages_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'leido'::text, 'respondido'::text, 'archivado'::text])));

alter table "public"."contact_messages" add constraint "contact_messages_mensaje_check" CHECK ((char_length(btrim(mensaje)) >= 10));

alter table "public"."contact_messages" add constraint "contact_messages_nombre_check" CHECK ((char_length(btrim(nombre)) >= 3));

alter table "public"."contact_messages" add constraint "contact_messages_pkey" PRIMARY KEY (id);

alter table "public"."cotizaciones" add constraint "cotizaciones_descuento_check" CHECK ((descuento >= (0)::numeric));

alter table "public"."cotizaciones" add constraint "cotizaciones_estado_check" CHECK ((estado = ANY (ARRAY['emitida'::text, 'aceptada'::text, 'vencida'::text, 'anulada'::text])));

alter table "public"."cotizaciones" add constraint "cotizaciones_itbis_check" CHECK ((itbis >= (0)::numeric));

alter table "public"."cotizaciones" add constraint "cotizaciones_numero_key" UNIQUE (numero);

alter table "public"."cotizaciones" add constraint "cotizaciones_pedido_id_key" UNIQUE (pedido_id);

alter table "public"."cotizaciones" add constraint "cotizaciones_pkey" PRIMARY KEY (id);

alter table "public"."cotizaciones" add constraint "cotizaciones_subtotal_check" CHECK ((subtotal >= (0)::numeric));

alter table "public"."cotizaciones" add constraint "cotizaciones_total_check" CHECK ((total >= (0)::numeric));

alter table "public"."direcciones" add constraint "direcciones_pkey" PRIMARY KEY (id);

alter table "public"."editoriales" add constraint "editoriales_pkey" PRIMARY KEY (id);

alter table "public"."editoriales" add constraint "editoriales_slug_key" UNIQUE (slug);

alter table "public"."facturas" add constraint "facturas_condicion_pago_check" CHECK ((condicion_pago = ANY (ARRAY['contado'::text, 'credito'::text])));

alter table "public"."facturas" add constraint "facturas_descuento_check" CHECK ((descuento >= (0)::numeric));

alter table "public"."facturas" add constraint "facturas_estado_check" CHECK ((estado = ANY (ARRAY['emitida'::text, 'pagada'::text, 'anulada'::text])));

alter table "public"."facturas" add constraint "facturas_itbis_check" CHECK ((itbis >= (0)::numeric));

alter table "public"."facturas" add constraint "facturas_numero_key" UNIQUE (numero);

alter table "public"."facturas" add constraint "facturas_pedido_id_key" UNIQUE (pedido_id);

alter table "public"."facturas" add constraint "facturas_pkey" PRIMARY KEY (id);

alter table "public"."facturas" add constraint "facturas_subtotal_check" CHECK ((subtotal >= (0)::numeric));

alter table "public"."facturas" add constraint "facturas_total_check" CHECK ((total >= (0)::numeric));

alter table "public"."favoritos" add constraint "favoritos_pkey" PRIMARY KEY (perfil_id, libro_id);

alter table "public"."inventarios" add constraint "inventario_existencia_valida" CHECK ((cantidad_existencia >= 0));

alter table "public"."inventarios" add constraint "inventario_minimo_valido" CHECK ((stock_minimo >= 0));

alter table "public"."inventarios" add constraint "inventario_reserva_valida" CHECK (((cantidad_reservada >= 0) AND (cantidad_reservada <= cantidad_existencia)));

alter table "public"."inventarios" add constraint "inventarios_pkey" PRIMARY KEY (libro_id);

alter table "public"."libro_autor" add constraint "libro_autor_orden_valido" CHECK ((orden > 0));

alter table "public"."libro_autor" add constraint "libro_autor_pkey" PRIMARY KEY (libro_id, autor_id);

alter table "public"."libro_categoria" add constraint "libro_categoria_pkey" PRIMARY KEY (libro_id, categoria_id);

alter table "public"."libros" add constraint "libros_anio_valido" CHECK (((anio_publicacion IS NULL) OR ((anio_publicacion >= 1000) AND (anio_publicacion <= 2200))));

alter table "public"."libros" add constraint "libros_descuento_pct_check" CHECK (((descuento_pct >= (0)::numeric) AND (descuento_pct <= (100)::numeric)));

alter table "public"."libros" add constraint "libros_formato_valido" CHECK (((formato)::text = ANY ((ARRAY['fisico'::character varying, 'digital'::character varying])::text[]))) NOT VALID;

alter table "public"."libros" add constraint "libros_idioma_no_vacio" CHECK ((btrim((idioma)::text) <> ''::text));

alter table "public"."libros" add constraint "libros_isbn_formato" CHECK (((isbn)::text ~ '^([0-9]{13}|[0-9]{9}[0-9X])$'::text));

alter table "public"."libros" add constraint "libros_isbn_key" UNIQUE (isbn);

alter table "public"."libros" add constraint "libros_pkey" PRIMARY KEY (id);

alter table "public"."libros" add constraint "libros_precio_valido" CHECK ((precio >= (0)::numeric));

alter table "public"."libros" add constraint "libros_stock_minimo_check" CHECK ((stock_minimo >= 0));

alter table "public"."libros" add constraint "libros_titulo_no_vacio" CHECK ((btrim((titulo)::text) <> ''::text));

alter table "public"."mensajes_contacto" add constraint "mensaje_estado_valido" CHECK (((estado)::text = ANY ((ARRAY['nuevo'::character varying, 'en_revision'::character varying, 'respondido'::character varying, 'cerrado'::character varying])::text[])));

alter table "public"."mensajes_contacto" add constraint "mensaje_longitud_valida" CHECK (((char_length(btrim(mensaje)) >= 10) AND (char_length(btrim(mensaje)) <= 5000)));

alter table "public"."mensajes_contacto" add constraint "mensaje_motivo_valido" CHECK (((motivo)::text = ANY ((ARRAY['encargo'::character varying, 'existencia'::character varying, 'ayuda'::character varying])::text[])));

alter table "public"."mensajes_contacto" add constraint "mensajes_contacto_pkey" PRIMARY KEY (id);

alter table "public"."movimientos_inventario" add constraint "movimiento_no_vacio" CHECK (((cambio_existencia <> 0) OR (cambio_reservada <> 0)));

alter table "public"."movimientos_inventario" add constraint "movimientos_inventario_pkey" PRIMARY KEY (id);

alter table "public"."movimientos_inventario" add constraint "movimientos_inventario_tipo_check" CHECK (((tipo)::text = ANY ((ARRAY['entrada'::character varying, 'ajuste'::character varying, 'reserva'::character varying, 'liberacion'::character varying, 'salida'::character varying, 'devolucion'::character varying])::text[])));

alter table "public"."pedido_detalles" add constraint "pedido_detalle_cantidad_valida" CHECK (((cantidad >= 1) AND (cantidad <= 999)));

alter table "public"."pedido_detalles" add constraint "pedido_detalle_precio_valido" CHECK ((precio_unitario >= (0)::numeric));

alter table "public"."pedido_detalles" add constraint "pedido_detalles_descuento_pct_check" CHECK (((descuento_pct >= (0)::numeric) AND (descuento_pct <= (100)::numeric)));

alter table "public"."pedido_detalles" add constraint "pedido_detalles_pkey" PRIMARY KEY (pedido_id, libro_id);

alter table "public"."pedido_direcciones_entrega" add constraint "pedido_direcciones_entrega_pkey" PRIMARY KEY (pedido_id);

alter table "public"."pedidos" add constraint "pedidos_descuento_check" CHECK (((descuento >= (0)::numeric) AND (descuento <= subtotal)));

alter table "public"."pedidos" add constraint "pedidos_entrega_valida" CHECK (((((metodo_entrega)::text = 'domicilio'::text) AND (sucursal_id IS NULL)) OR (((metodo_entrega)::text = 'retiro'::text) AND (sucursal_id IS NOT NULL))));

alter table "public"."pedidos" add constraint "pedidos_estado_check" CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'confirmado'::character varying, 'procesando'::character varying, 'listo_retiro'::character varying, 'enviado'::character varying, 'entregado'::character varying, 'cancelado'::character varying, 'devuelto'::character varying])::text[])));

alter table "public"."pedidos" add constraint "pedidos_estado_pago_valido" CHECK (((estado_pago)::text = ANY ((ARRAY['pendiente'::character varying, 'verificando'::character varying, 'pagado'::character varying, 'rechazado'::character varying, 'reembolsado'::character varying])::text[])));

alter table "public"."pedidos" add constraint "pedidos_importes_validos" CHECK (((subtotal >= (0)::numeric) AND (descuento >= (0)::numeric) AND (descuento <= subtotal) AND (itbis >= (0)::numeric) AND (costo_envio >= (0)::numeric) AND (total = (((subtotal - descuento) + itbis) + costo_envio))));

alter table "public"."pedidos" add constraint "pedidos_itbis_check" CHECK ((itbis >= (0)::numeric));

alter table "public"."pedidos" add constraint "pedidos_metodo_pago_check" CHECK (((metodo_pago)::text = ANY ((ARRAY['contra_entrega'::character varying, 'efectivo'::character varying, 'tarjeta'::character varying, 'transferencia'::character varying])::text[])));

alter table "public"."pedidos" add constraint "pedidos_numero_key" UNIQUE (numero);

alter table "public"."pedidos" add constraint "pedidos_pkey" PRIMARY KEY (id);

alter table "public"."perfiles" add constraint "perfiles_nombres_no_vacio" CHECK ((btrim((nombres)::text) <> ''::text));

alter table "public"."perfiles" add constraint "perfiles_pkey" PRIMARY KEY (id);

alter table "public"."roles" add constraint "roles_codigo_key" UNIQUE (codigo);

alter table "public"."roles" add constraint "roles_codigo_valido" CHECK (((codigo)::text = ANY ((ARRAY['cliente'::character varying, 'empleado'::character varying, 'administrador'::character varying])::text[])));

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY (id);

alter table "public"."sucursales" add constraint "sucursales_codigo_key" UNIQUE (codigo);

alter table "public"."sucursales" add constraint "sucursales_pkey" PRIMARY KEY (id);

alter table "public"."usuario_roles" add constraint "usuario_roles_pkey" PRIMARY KEY (usuario_id);

alter table "public"."carrito_detalles" add constraint "carrito_detalles_carrito_id_fkey" FOREIGN KEY (carrito_id) REFERENCES carritos(id) ON DELETE CASCADE;

alter table "public"."carrito_detalles" add constraint "carrito_detalles_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE RESTRICT;

alter table "public"."carritos" add constraint "carritos_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE;

alter table "public"."configuracion_negocio" add constraint "configuracion_negocio_actualizado_por_fkey" FOREIGN KEY (actualizado_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."contact_messages" add constraint "contact_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."cotizaciones" add constraint "cotizaciones_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE RESTRICT;

alter table "public"."cotizaciones" add constraint "cotizaciones_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."cotizaciones" add constraint "cotizaciones_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT;

alter table "public"."direcciones" add constraint "direcciones_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE;

alter table "public"."facturas" add constraint "facturas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE RESTRICT;

alter table "public"."facturas" add constraint "facturas_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."facturas" add constraint "facturas_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT;

alter table "public"."favoritos" add constraint "favoritos_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE;

alter table "public"."favoritos" add constraint "favoritos_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE;

alter table "public"."inventarios" add constraint "inventarios_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE RESTRICT;

alter table "public"."libro_autor" add constraint "libro_autor_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES autores(id) ON DELETE RESTRICT;

alter table "public"."libro_autor" add constraint "libro_autor_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE;

alter table "public"."libro_categoria" add constraint "libro_categoria_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT;

alter table "public"."libro_categoria" add constraint "libro_categoria_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE;

alter table "public"."libros" add constraint "libros_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;

alter table "public"."libros" add constraint "libros_editorial_id_fkey" FOREIGN KEY (editorial_id) REFERENCES editoriales(id) ON DELETE RESTRICT;

alter table "public"."mensajes_contacto" add constraint "mensajes_contacto_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."mensajes_contacto" add constraint "mensajes_contacto_respondido_por_fkey" FOREIGN KEY (respondido_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."movimientos_inventario" add constraint "movimientos_inventario_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE RESTRICT;

alter table "public"."movimientos_inventario" add constraint "movimientos_inventario_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;

alter table "public"."movimientos_inventario" add constraint "movimientos_inventario_realizado_por_fkey" FOREIGN KEY (realizado_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."pedido_detalles" add constraint "pedido_detalles_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE RESTRICT;

alter table "public"."pedido_detalles" add constraint "pedido_detalles_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;

alter table "public"."pedido_direcciones_entrega" add constraint "pedido_direcciones_entrega_direccion_origen_id_fkey" FOREIGN KEY (direccion_origen_id) REFERENCES direcciones(id) ON DELETE SET NULL;

alter table "public"."pedido_direcciones_entrega" add constraint "pedido_direcciones_entrega_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;

alter table "public"."pedidos" add constraint "pedidos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."pedidos" add constraint "pedidos_sucursal_id_fkey" FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE RESTRICT;

alter table "public"."perfiles" add constraint "perfiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."usuario_roles" add constraint "usuario_roles_asignado_por_fkey" FOREIGN KEY (asignado_por) REFERENCES perfiles(id) ON DELETE SET NULL;

alter table "public"."usuario_roles" add constraint "usuario_roles_rol_id_fkey" FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT;

alter table "public"."usuario_roles" add constraint "usuario_roles_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX categorias_nombre_unico ON public.categorias USING btree (lower((nombre)::text));

CREATE INDEX contact_messages_estado_fecha_idx ON public.contact_messages USING btree (estado, created_at DESC);

CREATE UNIQUE INDEX contact_messages_legacy_message_idx ON public.contact_messages USING btree (legacy_message_id) WHERE (legacy_message_id IS NOT NULL);

CREATE INDEX contact_messages_user_fecha_idx ON public.contact_messages USING btree (user_id, created_at DESC);

CREATE INDEX cotizaciones_cliente_fecha ON public.cotizaciones USING btree (cliente_id, creado_en DESC);

CREATE INDEX direcciones_perfil_idx ON public.direcciones USING btree (perfil_id);

CREATE UNIQUE INDEX una_direccion_principal_por_cliente ON public.direcciones USING btree (perfil_id) WHERE (es_principal = true);

CREATE UNIQUE INDEX editoriales_nombre_unico ON public.editoriales USING btree (lower((nombre)::text));

CREATE INDEX facturas_cliente_fecha ON public.facturas USING btree (cliente_id, creado_en DESC);

CREATE UNIQUE INDEX facturas_ncf_unico ON public.facturas USING btree (ncf) WHERE (ncf IS NOT NULL);

CREATE INDEX favoritos_libro_idx ON public.favoritos USING btree (libro_id);

CREATE INDEX inventario_disponible_idx ON public.inventarios USING btree (cantidad_disponible) WHERE (cantidad_disponible > 0);

CREATE INDEX libro_autor_autor_idx ON public.libro_autor USING btree (autor_id);

CREATE INDEX libro_categoria_categoria_idx ON public.libro_categoria USING btree (categoria_id);

CREATE INDEX libros_activos_idx ON public.libros USING btree (activo) WHERE (activo = true);

CREATE INDEX libros_categoria_idx ON public.libros USING btree (categoria_id);

CREATE INDEX libros_editorial_idx ON public.libros USING btree (editorial_id);

CREATE INDEX libros_titulo_busqueda ON public.libros USING btree (lower((titulo)::text));

CREATE INDEX mensajes_estado_idx ON public.mensajes_contacto USING btree (estado, creado_en DESC);

CREATE INDEX mensajes_perfil_fecha_idx ON public.mensajes_contacto USING btree (perfil_id, creado_en DESC);

CREATE INDEX movimientos_fecha_idx ON public.movimientos_inventario USING btree (creado_en DESC);

CREATE INDEX movimientos_libro_fecha_idx ON public.movimientos_inventario USING btree (libro_id, creado_en DESC);

CREATE INDEX movimientos_pedido_idx ON public.movimientos_inventario USING btree (pedido_id);

CREATE INDEX pedido_detalles_libro_idx ON public.pedido_detalles USING btree (libro_id);

CREATE INDEX pedidos_cliente_fecha_idx ON public.pedidos USING btree (cliente_id, creado_en DESC);

CREATE INDEX pedidos_estado_fecha_idx ON public.pedidos USING btree (estado, creado_en DESC);

CREATE INDEX pedidos_estado_pago_idx ON public.pedidos USING btree (estado_pago);

-- 3. Las 24 funciones exportadas; correcciones de tres cuerpos en conciliacion-remota.md.
CREATE OR REPLACE FUNCTION private.calcular_totales_documento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_aplicar_itbis boolean := coalesce((new.snapshot #>> '{documento,mostrar_itbis}')::boolean, false);
    v_itbis_pct numeric(5,2) := coalesce((new.snapshot #>> '{documento,itbis_pct}')::numeric, 0);
    v_envio numeric(12,2) := coalesce((new.snapshot #>> '{totales,costo_envio}')::numeric, 0);
begin
    new.itbis := case
        when v_aplicar_itbis and v_itbis_pct > 0
        then round((new.subtotal - new.descuento) * v_itbis_pct / 100, 2)
        else 0
    end;
    new.total := new.subtotal - new.descuento + new.itbis + v_envio;
    new.snapshot := jsonb_set(
        jsonb_set(new.snapshot, '{totales,itbis}', to_jsonb(new.itbis), true),
        '{totales,total}', to_jsonb(new.total), true
    );
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.calcular_totales_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_aplicar_itbis boolean;
    v_itbis_pct numeric(5,2);
begin
    select cotizacion_mostrar_itbis, cotizacion_itbis_pct
      into v_aplicar_itbis, v_itbis_pct
      from public.configuracion_negocio
     where id = 1;

    new.itbis := case
        when coalesce(v_aplicar_itbis, false) and coalesce(v_itbis_pct, 0) > 0
        then round((new.subtotal - new.descuento) * v_itbis_pct / 100, 2)
        else 0
    end;
    new.total := new.subtotal - new.descuento + new.itbis + new.costo_envio;
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.cotizar_pedido_al_confirmar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    perform private.crear_cotizacion_pedido(new.id, new.cliente_id);
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.crear_cotizacion_pedido(p_pedido_id uuid, p_creado_por uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_existente uuid;
    v_pedido public.pedidos%rowtype;
    v_config public.configuracion_negocio%rowtype;
    v_id uuid;
    v_numero text;
    v_fecha date := current_date;
    v_valida_hasta date;
    v_snapshot jsonb;
begin
    perform pg_advisory_xact_lock(hashtextextended('cotizacion:' || p_pedido_id::text, 0));

    select id into v_existente from public.cotizaciones where pedido_id = p_pedido_id;
    if v_existente is not null then return v_existente; end if;

    select * into v_pedido from public.pedidos where id = p_pedido_id;
    if not found then raise exception 'Pedido no encontrado.'; end if;

    select * into v_config from public.configuracion_negocio where id = 1;
    v_numero := upper(v_config.cotizacion_prefijo) || '-' || lpad(nextval('public.cotizaciones_numero_seq')::text, 4, '0');
    v_valida_hasta := v_fecha + v_config.cotizacion_validez_dias;
    v_snapshot := private.snapshot_documento_pedido(
        p_pedido_id, 'cotizacion', v_numero, v_fecha, v_valida_hasta,
        null, null, null, p_creado_por
    );

    insert into public.cotizaciones (
        numero, pedido_id, cliente_id, fecha_emision, valida_hasta,
        subtotal, descuento, itbis, total, snapshot, creado_por
    ) values (
        v_numero, p_pedido_id, v_pedido.cliente_id, v_fecha, v_valida_hasta,
        v_pedido.subtotal, v_pedido.descuento, (v_snapshot #>> '{totales,itbis}')::numeric,
        v_pedido.total, v_snapshot, p_creado_por
    ) returning id into v_id;

    return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.crear_perfil_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_rol_cliente smallint;
    v_nombres text;
begin
    select id
      into v_rol_cliente
      from public.roles
     where codigo = 'cliente';

    v_nombres := coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'nombres'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
    );

    insert into public.perfiles (
        id,
        nombres,
        apellidos,
        telefono
    )
    values (
        new.id,
        v_nombres,
        nullif(btrim(new.raw_user_meta_data ->> 'apellidos'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'telefono'), '')
    );

    insert into public.usuario_roles (usuario_id, rol_id)
    values (new.id, v_rol_cliente);

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select exists (
        select 1
          from public.usuario_roles ur
          join public.roles r on r.id = ur.rol_id
          join public.perfiles p on p.id = ur.usuario_id
         where ur.usuario_id = auth.uid()
           and r.codigo = 'administrador'
           and p.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION private.es_personal()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select exists (
        select 1
          from public.usuario_roles ur
          join public.roles r on r.id = ur.rol_id
          join public.perfiles p on p.id = ur.usuario_id
         where ur.usuario_id = auth.uid()
           and r.codigo in ('administrador', 'empleado')
           and p.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION private.fijar_actualizado_en()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    new.actualizado_en = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.sincronizar_estado_documentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if new.estado = 'cancelado' and old.estado <> 'cancelado' then
        update public.cotizaciones set estado = 'anulada' where pedido_id = new.id and estado <> 'anulada';
        update public.facturas set estado = 'anulada' where pedido_id = new.id and estado <> 'anulada';
    end if;
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.snapshot_documento_pedido(p_pedido_id uuid, p_tipo text, p_numero text, p_fecha_emision date, p_fecha_limite date DEFAULT NULL::date, p_ncf text DEFAULT NULL::text, p_condicion_pago text DEFAULT NULL::text, p_notas text DEFAULT NULL::text, p_creado_por uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_pedido public.pedidos%rowtype;
    v_config public.configuracion_negocio%rowtype;
    v_articulos jsonb;
    v_entrega jsonb;
    v_sucursal jsonb;
    v_atendido_por text;
    v_mostrar_itbis boolean;
    v_itbis_pct numeric(5,2);
    v_itbis numeric(12,2);
begin
    if p_tipo not in ('cotizacion', 'factura') then
        raise exception 'Tipo de documento invalido.';
    end if;

    select * into v_pedido
      from public.pedidos
     where id = p_pedido_id;

    if not found then
        raise exception 'Pedido no encontrado.';
    end if;

    select * into v_config
      from public.configuracion_negocio
     where id = 1;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'libro_id', pd.libro_id,
                'isbn', pd.isbn,
                'descripcion', pd.titulo,
                'cantidad', pd.cantidad,
                'precio_unitario', pd.precio_unitario,
                'descuento_pct', pd.descuento_pct,
                'descuento', pd.descuento,
                'total', pd.total_linea
            ) order by pd.libro_id
        ),
        '[]'::jsonb
    ) into v_articulos
      from public.pedido_detalles pd
     where pd.pedido_id = p_pedido_id;

    select to_jsonb(d) into v_entrega
      from public.pedido_direcciones_entrega d
     where d.pedido_id = p_pedido_id;

    select jsonb_build_object(
        'nombre', s.nombre,
        'direccion', s.direccion,
        'ciudad', s.ciudad,
        'provincia', s.provincia,
        'telefono', s.telefono
    ) into v_sucursal
      from public.sucursales s
     where s.id = v_pedido.sucursal_id;

    select nullif(btrim(concat_ws(' ', p.nombres, p.apellidos)), '')
      into v_atendido_por
      from public.perfiles p
      join public.usuario_roles ur on ur.usuario_id = p.id
      join public.roles r on r.id = ur.rol_id and r.codigo in ('administrador', 'empleado')
     where p.id = p_creado_por;

    v_atendido_por := coalesce(v_atendido_por, nullif(v_config.atendido_por_default, ''), 'Libreria Quisqueya');
    v_mostrar_itbis := case when p_tipo = 'cotizacion' then v_config.cotizacion_mostrar_itbis else v_config.factura_mostrar_itbis end;
    v_itbis_pct := case when p_tipo = 'cotizacion' then v_config.cotizacion_itbis_pct else v_config.factura_itbis_pct end;

    -- El trigger calcula ITBIS adicional sobre la base neta; el snapshot usa la misma regla.
    v_itbis := case
        when v_mostrar_itbis and v_itbis_pct > 0
        then round((v_pedido.subtotal - v_pedido.descuento) * v_itbis_pct / 100, 2)
        else 0
    end;

    return jsonb_build_object(
        'version', 1,
        'tipo', p_tipo,
        'empresa', jsonb_build_object(
            'nombre_comercial', v_config.nombre_comercial,
            'razon_social', v_config.razon_social,
            'eslogan', v_config.eslogan,
            'rnc', v_config.rnc,
            'direccion', v_config.direccion,
            'ciudad', v_config.ciudad,
            'provincia', v_config.provincia,
            'pais', v_config.pais,
            'telefono', v_config.telefono,
            'correo', v_config.correo,
            'sitio_web', v_config.sitio_web,
            'logo_url', v_config.logo_url
        ),
        'documento', jsonb_build_object(
            'numero', p_numero,
            'fecha_emision', p_fecha_emision,
            'fecha_limite', p_fecha_limite,
            'ncf', p_ncf,
            'condicion_pago', p_condicion_pago,
            'metodo_pago', v_pedido.metodo_pago,
            'atendido_por', v_atendido_por,
            'tiempo_entrega', case when p_tipo = 'cotizacion' then v_config.cotizacion_tiempo_entrega else null end,
            'condiciones', case when p_tipo = 'cotizacion' then v_config.cotizacion_condiciones else v_config.factura_condiciones end,
            'notas', coalesce(p_notas, case when p_tipo = 'cotizacion' then v_config.cotizacion_notas else v_config.factura_notas end),
            'mostrar_itbis', v_mostrar_itbis,
            'itbis_pct', v_itbis_pct
        ),
        'pedido', jsonb_build_object(
            'id', v_pedido.id,
            'numero', v_pedido.numero,
            'metodo_entrega', v_pedido.metodo_entrega,
            'notas', v_pedido.notas
        ),
        'cliente', jsonb_build_object(
            'id', v_pedido.cliente_id,
            'nombre', v_pedido.cliente_nombre,
            'correo', v_pedido.cliente_correo,
            'telefono', coalesce(v_pedido.cliente_telefono, v_entrega ->> 'telefono'),
            'documento', v_pedido.cliente_documento,
            'direccion', case
                when v_pedido.metodo_entrega = 'domicilio' then concat_ws(', ',
                    nullif(v_entrega ->> 'linea_1', ''),
                    nullif(v_entrega ->> 'linea_2', ''),
                    nullif(v_entrega ->> 'sector', ''),
                    nullif(v_entrega ->> 'ciudad', ''),
                    nullif(v_entrega ->> 'provincia', '')
                )
                else concat_ws(', ', v_sucursal ->> 'direccion', v_sucursal ->> 'ciudad', v_sucursal ->> 'provincia')
            end
        ),
        'entrega', coalesce(v_entrega, v_sucursal, '{}'::jsonb),
        'articulos', v_articulos,
        'totales', jsonb_build_object(
            'subtotal', v_pedido.subtotal,
            'descuento', v_pedido.descuento,
            'itbis', v_itbis,
            'costo_envio', v_pedido.costo_envio,
            'total', v_pedido.total
        )
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_estado_pedido(p_pedido_id uuid, p_estado text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_usuario uuid := auth.uid();
    v_estado_anterior text;
begin
    if v_usuario is null or not private.es_personal() then
        raise exception 'Acceso de personal requerido.';
    end if;
    if p_estado not in ('pendiente', 'confirmado', 'procesando', 'listo_retiro',
                        'enviado', 'entregado', 'cancelado', 'devuelto') then
        raise exception 'Estado de pedido inválido.';
    end if;

    select estado into v_estado_anterior
      from public.pedidos
     where id = p_pedido_id
     for update;
    if v_estado_anterior is null then raise exception 'Pedido no encontrado.'; end if;
    if v_estado_anterior = p_estado then return; end if;
    if not (
        (v_estado_anterior = 'pendiente' and p_estado in ('confirmado', 'procesando', 'cancelado')) or
        (v_estado_anterior = 'confirmado' and p_estado in ('procesando', 'listo_retiro', 'enviado', 'cancelado')) or
        (v_estado_anterior = 'procesando' and p_estado in ('listo_retiro', 'enviado', 'cancelado')) or
        (v_estado_anterior = 'listo_retiro' and p_estado in ('entregado', 'cancelado')) or
        (v_estado_anterior = 'enviado' and p_estado in ('entregado', 'devuelto')) or
        (v_estado_anterior = 'entregado' and p_estado = 'devuelto')
    ) then
        raise exception 'Transición de estado no permitida: % a %.', v_estado_anterior, p_estado;
    end if;

    perform i.libro_id
      from public.inventarios i
      join public.pedido_detalles pd on pd.libro_id = i.libro_id
     where pd.pedido_id = p_pedido_id
     for update of i;

    if p_estado = 'cancelado' then
        if v_estado_anterior in ('enviado', 'entregado') then
            raise exception 'Un pedido despachado debe registrarse como devuelto.';
        end if;
        if exists (
            select 1 from public.pedido_detalles pd
            join public.inventarios i on i.libro_id = pd.libro_id
            where pd.pedido_id = p_pedido_id and i.cantidad_reservada < pd.cantidad
        ) then
            raise exception 'La reserva del pedido es inconsistente.';
        end if;

        update public.inventarios i
           set cantidad_reservada = i.cantidad_reservada - pd.cantidad,
               actualizado_en = now()
          from public.pedido_detalles pd
         where pd.pedido_id = p_pedido_id and pd.libro_id = i.libro_id;

        insert into public.movimientos_inventario
            (libro_id, pedido_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo)
        select libro_id, p_pedido_id, v_usuario, 'liberacion', 0, -cantidad,
               'Reserva liberada por cancelación del pedido'
          from public.pedido_detalles where pedido_id = p_pedido_id;
    elsif p_estado in ('enviado', 'entregado')
          and v_estado_anterior not in ('enviado', 'entregado') then
        if exists (
            select 1 from public.pedido_detalles pd
            join public.inventarios i on i.libro_id = pd.libro_id
            where pd.pedido_id = p_pedido_id
              and (i.cantidad_reservada < pd.cantidad or i.cantidad_existencia < pd.cantidad)
        ) then
            raise exception 'El inventario reservado del pedido es inconsistente.';
        end if;

        update public.inventarios i
           set cantidad_existencia = i.cantidad_existencia - pd.cantidad,
               cantidad_reservada = i.cantidad_reservada - pd.cantidad,
               actualizado_en = now()
          from public.pedido_detalles pd
         where pd.pedido_id = p_pedido_id and pd.libro_id = i.libro_id;

        insert into public.movimientos_inventario
            (libro_id, pedido_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo)
        select libro_id, p_pedido_id, v_usuario, 'salida', -cantidad, -cantidad,
               'Salida de inventario al despachar el pedido'
          from public.pedido_detalles where pedido_id = p_pedido_id;
    elsif p_estado = 'devuelto' then
        if v_estado_anterior not in ('enviado', 'entregado') then
            raise exception 'Solo se pueden devolver pedidos enviados o entregados.';
        end if;

        update public.inventarios i
           set cantidad_existencia = i.cantidad_existencia + pd.cantidad,
               actualizado_en = now()
          from public.pedido_detalles pd
         where pd.pedido_id = p_pedido_id and pd.libro_id = i.libro_id;

        insert into public.movimientos_inventario
            (libro_id, pedido_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo)
        select libro_id, p_pedido_id, v_usuario, 'devolucion', cantidad, 0,
               'Inventario restaurado por devolución del pedido'
          from public.pedido_detalles where pedido_id = p_pedido_id;
    end if;

    update public.pedidos
       set estado = p_estado, actualizado_en = now()
     where id = p_pedido_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_pago_pedido(p_pedido_id uuid, p_estado_pago text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_estado_anterior text;
begin
    if auth.uid() is null or not private.es_personal() then
        raise exception 'Acceso de personal requerido.';
    end if;
    if p_estado_pago not in ('pendiente', 'verificando', 'pagado', 'rechazado', 'reembolsado') then
        raise exception 'Estado de pago inválido.';
    end if;

    select estado_pago into v_estado_anterior
      from public.pedidos
     where id = p_pedido_id
     for update;
    if v_estado_anterior is null then raise exception 'Pedido no encontrado.'; end if;
    if v_estado_anterior = p_estado_pago then return; end if;
    if not (
        (v_estado_anterior = 'pendiente' and p_estado_pago in ('verificando', 'pagado', 'rechazado')) or
        (v_estado_anterior = 'verificando' and p_estado_pago in ('pagado', 'rechazado')) or
        (v_estado_anterior = 'rechazado' and p_estado_pago in ('pendiente', 'verificando')) or
        (v_estado_anterior = 'pagado' and p_estado_pago = 'reembolsado')
    ) then
        raise exception 'Transición de pago no permitida: % a %.', v_estado_anterior, p_estado_pago;
    end if;

    update public.pedidos
       set estado_pago = p_estado_pago, actualizado_en = now()
     where id = p_pedido_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_usuario_admin(p_usuario_id uuid, p_nombres text, p_apellidos text, p_activo boolean, p_rol text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_rol_id smallint;
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;
    if p_usuario_id = auth.uid() and (not p_activo or p_rol <> 'administrador') then
        raise exception 'No puedes retirar tu propio acceso administrativo.';
    end if;
    if coalesce(btrim(p_nombres), '') = '' then
        raise exception 'El nombre es obligatorio.';
    end if;

    select id into v_rol_id from public.roles where codigo = p_rol;
    if v_rol_id is null then raise exception 'Rol inválido.'; end if;

    update public.perfiles
       set nombres = btrim(p_nombres),
           apellidos = coalesce(btrim(p_apellidos), ''),
           activo = p_activo,
           actualizado_en = now()
     where id = p_usuario_id;
    if not found then raise exception 'Usuario no encontrado.'; end if;

    insert into public.usuario_roles (usuario_id, rol_id)
    values (p_usuario_id, v_rol_id)
    on conflict (usuario_id) do update set rol_id = excluded.rol_id, asignado_en = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_inventario_admin(p_producto_id bigint, p_tipo text, p_cantidad integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_actual integer;
    v_reservada integer;
    v_nueva integer;
    v_cambio integer;
begin
    if auth.uid() is null or not private.es_personal() then
        raise exception 'Acceso de personal requerido.';
    end if;
    if p_tipo not in ('entrada', 'salida', 'ajuste') then
        raise exception 'Tipo de movimiento inválido.';
    end if;
    if p_cantidad is null or p_cantidad < 0 or (p_tipo <> 'ajuste' and p_cantidad = 0) then
        raise exception 'Cantidad inválida.';
    end if;
    if coalesce(btrim(p_motivo), '') = '' then
        raise exception 'El motivo es obligatorio.';
    end if;

    select cantidad_existencia, cantidad_reservada
      into v_actual, v_reservada
      from public.inventarios
     where libro_id = p_producto_id
     for update;
    if v_actual is null then raise exception 'Inventario no encontrado.'; end if;

    v_nueva := case p_tipo
        when 'entrada' then v_actual + p_cantidad
        when 'salida' then v_actual - p_cantidad
        else p_cantidad
    end;
    if v_nueva < v_reservada then
        raise exception 'La existencia no puede ser menor que la cantidad reservada.';
    end if;
    v_cambio := v_nueva - v_actual;
    if v_cambio = 0 then raise exception 'El ajuste no produce ningún cambio.'; end if;

    update public.inventarios
       set cantidad_existencia = v_nueva, actualizado_en = now()
     where libro_id = p_producto_id;

    insert into public.movimientos_inventario (
        libro_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo
    ) values (
        p_producto_id, auth.uid(), p_tipo, v_cambio, 0, btrim(p_motivo)
    );

    return jsonb_build_object(
        'cantidad_existencia', v_nueva,
        'cantidad_reservada', v_reservada,
        'cantidad_disponible', v_nueva - v_reservada
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.crear_pedido_desde_carrito(p_metodo_entrega text, p_metodo_pago text, p_sucursal_id bigint DEFAULT NULL::bigint, p_direccion jsonb DEFAULT NULL::jsonb, p_notas text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_usuario uuid := auth.uid();
    v_carrito uuid;
    v_pedido uuid;
    v_numero text;
    v_nombre text;
    v_correo text;
    v_subtotal numeric(12,2);
    v_descuento numeric(12,2);
    v_envio numeric(12,2) := 0;
    v_total numeric(12,2);
begin
    if v_usuario is null then
        raise exception 'Debes iniciar sesión para realizar un pedido.';
    end if;

    if p_metodo_entrega not in ('domicilio', 'retiro') then
        raise exception 'Método de entrega inválido.';
    end if;
    if p_metodo_pago not in ('contra_entrega', 'efectivo', 'tarjeta', 'transferencia') then
        raise exception 'Método de pago inválido.';
    end if;

    select concat_ws(' ', p.nombres, p.apellidos), u.email
      into v_nombre, v_correo
      from public.perfiles p
      join auth.users u on u.id = p.id
     where p.id = v_usuario and p.activo = true;

    if v_nombre is null then
        raise exception 'El perfil no existe o está inactivo.';
    end if;

    select c.id into v_carrito
      from public.carritos c
     where c.perfil_id = v_usuario
     for update;

    if v_carrito is null or not exists (
        select 1 from public.carrito_detalles where carrito_id = v_carrito
    ) then
        raise exception 'El carrito está vacío.';
    end if;

    -- Bloqueo de las existencias involucradas para evitar compras simultáneas.
    perform i.libro_id
      from public.inventarios i
      join public.carrito_detalles cd on cd.libro_id = i.libro_id
     where cd.carrito_id = v_carrito
     order by i.libro_id
     for update of i;

    if exists (
        select 1
          from public.carrito_detalles cd
          left join public.libros l on l.id = cd.libro_id
          left join public.inventarios i on i.libro_id = cd.libro_id
         where cd.carrito_id = v_carrito
           and (l.id is null or not l.activo or i.libro_id is null
                or cd.cantidad > i.cantidad_disponible)
    ) then
        raise exception 'Uno o más libros ya no tienen existencias suficientes.';
    end if;

    if p_metodo_entrega = 'retiro' then
        if p_sucursal_id is null or not exists (
            select 1 from public.sucursales
             where id = p_sucursal_id and activo = true
        ) then
            raise exception 'Selecciona una sucursal activa.';
        end if;
    else
        p_sucursal_id := null;
        if p_direccion is null
           or coalesce(btrim(p_direccion ->> 'destinatario'), '') = ''
           or coalesce(btrim(p_direccion ->> 'telefono'), '') = ''
           or coalesce(btrim(p_direccion ->> 'linea_1'), '') = ''
           or coalesce(btrim(p_direccion ->> 'ciudad'), '') = ''
           or coalesce(btrim(p_direccion ->> 'provincia'), '') = '' then
            raise exception 'La dirección de entrega está incompleta.';
        end if;

        v_envio := case
            when lower(p_direccion ->> 'provincia') in ('distrito nacional', 'santo domingo') then 150
            when lower(p_direccion ->> 'provincia') = 'santiago' then 225
            else 300
        end;
    end if;

    select sum(l.precio * cd.cantidad),
           sum(round(l.precio * cd.cantidad * l.descuento_pct / 100, 2))
      into v_subtotal, v_descuento
      from public.carrito_detalles cd
      join public.libros l on l.id = cd.libro_id
     where cd.carrito_id = v_carrito;

    v_descuento := coalesce(v_descuento, 0);
    v_total := v_subtotal - v_descuento + v_envio;

    insert into public.pedidos (
        cliente_id, cliente_nombre, cliente_correo, cliente_documento, cliente_telefono,
        metodo_entrega, sucursal_id, metodo_pago,
        subtotal, descuento, costo_envio, total, notas
    ) values (
        v_usuario, v_nombre, v_correo,
        nullif(btrim(p_direccion ->> 'documento'), ''),
        nullif(btrim(p_direccion ->> 'telefono_cliente'), ''),
        p_metodo_entrega, p_sucursal_id, p_metodo_pago,
        v_subtotal, v_descuento, v_envio, v_total, nullif(btrim(p_notas), '')
    ) returning id, numero, total into v_pedido, v_numero, v_total;

    insert into public.pedido_detalles (
        pedido_id, libro_id, isbn, titulo, precio_unitario, cantidad, descuento_pct
    )
    select v_pedido, l.id, l.isbn, l.titulo, l.precio, cd.cantidad, l.descuento_pct
      from public.carrito_detalles cd
      join public.libros l on l.id = cd.libro_id
     where cd.carrito_id = v_carrito;

    if p_metodo_entrega = 'domicilio' then
        insert into public.pedido_direcciones_entrega (
            pedido_id, destinatario, telefono, linea_1, linea_2,
            sector, ciudad, provincia, codigo_postal, referencia
        ) values (
            v_pedido,
            btrim(p_direccion ->> 'destinatario'),
            btrim(p_direccion ->> 'telefono'),
            btrim(p_direccion ->> 'linea_1'),
            nullif(btrim(p_direccion ->> 'linea_2'), ''),
            nullif(btrim(p_direccion ->> 'sector'), ''),
            btrim(p_direccion ->> 'ciudad'),
            btrim(p_direccion ->> 'provincia'),
            nullif(btrim(p_direccion ->> 'codigo_postal'), ''),
            nullif(btrim(p_direccion ->> 'referencia'), '')
        );
    end if;

    update public.inventarios i
       set cantidad_reservada = i.cantidad_reservada + cd.cantidad,
           actualizado_en = now()
      from public.carrito_detalles cd
     where cd.carrito_id = v_carrito
       and cd.libro_id = i.libro_id;

    insert into public.movimientos_inventario (
        libro_id, pedido_id, realizado_por, tipo,
        cambio_existencia, cambio_reservada, motivo
    )
    select cd.libro_id, v_pedido, v_usuario, 'reserva', 0, cd.cantidad,
           'Reserva automática al confirmar el pedido'
      from public.carrito_detalles cd
     where cd.carrito_id = v_carrito;

    delete from public.carrito_detalles where carrito_id = v_carrito;

    return jsonb_build_object(
        'id', v_pedido,
        'numero', v_numero,
        'subtotal', v_subtotal,
        'descuento', v_descuento,
        'costo_envio', v_envio,
        'total', v_total,
        'estado', 'pendiente',
        'estado_pago', 'pendiente'
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_categoria_admin(p_categoria_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;

    if exists (select 1 from public.libros where categoria_id = p_categoria_id) then
        update public.categorias set activo = false where id = p_categoria_id;
        if not found then raise exception 'Categoría no encontrada.'; end if;
        return 'desactivada';
    end if;

    delete from public.categorias where id = p_categoria_id;
    if not found then raise exception 'Categoría no encontrada.'; end if;
    return 'eliminada';
end;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_producto_admin(p_producto_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_tiene_historial boolean;
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;

    perform id from public.libros where id = p_producto_id for update;
    if not found then raise exception 'Producto no encontrado.'; end if;

    select exists (
        select 1 from public.pedido_detalles where libro_id = p_producto_id
        union all
        select 1 from public.movimientos_inventario where libro_id = p_producto_id
    ) into v_tiene_historial;

    if v_tiene_historial then
        update public.libros set activo = false, actualizado_en = now()
         where id = p_producto_id;
        if not found then raise exception 'Producto no encontrado.'; end if;
        return 'desactivado';
    end if;

    delete from public.carrito_detalles where libro_id = p_producto_id;
    delete from public.inventarios where libro_id = p_producto_id;
    delete from public.libros where id = p_producto_id;
    if not found then raise exception 'Producto no encontrado.'; end if;
    return 'eliminado';
end;
$function$;

CREATE OR REPLACE FUNCTION public.enviar_mensaje_contacto(p_nombre text, p_correo text, p_asunto text, p_mensaje text, p_telefono text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_id uuid;
    v_user_id uuid := auth.uid();
    v_nombre text := btrim(coalesce(p_nombre, ''));
    v_correo text := lower(btrim(coalesce(p_correo, '')));
    v_asunto text := btrim(coalesce(p_asunto, ''));
    v_mensaje text := btrim(coalesce(p_mensaje, ''));
    v_telefono text := nullif(btrim(coalesce(p_telefono, '')), '');
begin
    if char_length(v_nombre) not between 3 and 160 then
        raise exception 'El nombre debe tener entre 3 y 160 caracteres.';
    end if;
    if char_length(v_correo) > 320
       or v_correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'El correo electrónico no es válido.';
    end if;
    if char_length(v_asunto) not between 3 and 160 then
        raise exception 'El asunto debe tener entre 3 y 160 caracteres.';
    end if;
    if char_length(v_mensaje) not between 10 and 5000 then
        raise exception 'El mensaje debe tener entre 10 y 5000 caracteres.';
    end if;
    if v_telefono is not null and char_length(v_telefono) > 25 then
        raise exception 'El teléfono es demasiado largo.';
    end if;
    if v_user_id is not null and not exists (
        select 1 from public.perfiles
        where id = v_user_id and activo
    ) then
        raise exception 'La cuenta no está activa.';
    end if;

    insert into public.contact_messages (
        user_id, nombre, correo, telefono, asunto, mensaje
    ) values (
        v_user_id, v_nombre, v_correo, v_telefono, v_asunto, v_mensaje
    )
    returning id into v_id;

    return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generar_factura_pedido(p_pedido_id uuid, p_ncf text DEFAULT NULL::text, p_condicion_pago text DEFAULT NULL::text, p_fecha_vencimiento date DEFAULT NULL::date, p_notas text DEFAULT NULL::text)
 RETURNS facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_usuario uuid := auth.uid();
    v_existente public.facturas%rowtype;
    v_pedido public.pedidos%rowtype;
    v_config public.configuracion_negocio%rowtype;
    v_factura public.facturas%rowtype;
    v_numero text;
    v_fecha date := current_date;
    v_condicion text;
    v_ncf text := upper(nullif(btrim(p_ncf), ''));
    v_snapshot jsonb;
begin
    if v_usuario is null or not private.es_personal() then
        raise exception 'Acceso de personal requerido.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('factura:' || p_pedido_id::text, 0));
    select * into v_existente from public.facturas where pedido_id = p_pedido_id;
    if found then return v_existente; end if;

    select * into v_pedido from public.pedidos where id = p_pedido_id for update;
    if not found then raise exception 'Pedido no encontrado.'; end if;
    if v_pedido.estado not in ('procesando', 'listo_retiro', 'enviado', 'entregado') then
        raise exception 'La factura solo puede generarse cuando el pedido esta listo para procesarse o entregarse.';
    end if;

    select * into v_config from public.configuracion_negocio where id = 1;
    v_condicion := coalesce(nullif(p_condicion_pago, ''), v_config.factura_condicion_pago);
    if v_condicion not in ('contado', 'credito') then
        raise exception 'Condicion de pago invalida.';
    end if;
    if v_condicion = 'credito' then
        p_fecha_vencimiento := coalesce(p_fecha_vencimiento, v_fecha + v_config.factura_dias_credito);
        if p_fecha_vencimiento < v_fecha then raise exception 'La fecha de vencimiento no puede ser anterior a la emision.'; end if;
    else
        p_fecha_vencimiento := null;
    end if;

    v_numero := upper(v_config.factura_prefijo) || '-' || lpad(nextval('public.facturas_numero_seq')::text, 4, '0');
    v_snapshot := private.snapshot_documento_pedido(
        p_pedido_id, 'factura', v_numero, v_fecha, p_fecha_vencimiento,
        v_ncf, v_condicion, nullif(btrim(p_notas), ''), v_usuario
    );

    insert into public.facturas (
        numero, pedido_id, cliente_id, ncf, fecha_emision, fecha_vencimiento,
        condicion_pago, subtotal, descuento, itbis, total, snapshot, creado_por
    ) values (
        v_numero, p_pedido_id, v_pedido.cliente_id, v_ncf, v_fecha, p_fecha_vencimiento,
        v_condicion, v_pedido.subtotal, v_pedido.descuento, (v_snapshot #>> '{totales,itbis}')::numeric,
        v_pedido.total, v_snapshot, v_usuario
    ) returning * into v_factura;

    return v_factura;
exception
    when unique_violation then
        if v_ncf is not null and exists (select 1 from public.facturas where ncf = v_ncf) then
            raise exception 'El NCF indicado ya esta asociado a otra factura.';
        end if;
        select * into v_factura from public.facturas where pedido_id = p_pedido_id;
        if found then return v_factura; end if;
        raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guardar_categoria_admin(p_categoria_id bigint, p_nombre text, p_activo boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_categoria_id bigint;
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;
    if coalesce(btrim(p_nombre), '') = '' then
        raise exception 'El nombre de la categoría es obligatorio.';
    end if;
    if exists (
        select 1 from public.categorias
         where lower(nombre) = lower(btrim(p_nombre))
           and id <> coalesce(p_categoria_id, -1)
    ) then
        raise exception 'Ya existe una categoría con ese nombre.';
    end if;

    if p_categoria_id is null then
        insert into public.categorias (nombre, activo)
        values (btrim(p_nombre), coalesce(p_activo, true))
        returning id into v_categoria_id;
    else
        update public.categorias
           set nombre = btrim(p_nombre), activo = coalesce(p_activo, true)
         where id = p_categoria_id
        returning id into v_categoria_id;
        if v_categoria_id is null then raise exception 'Categoría no encontrada.'; end if;
    end if;

    return v_categoria_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guardar_configuracion_negocio(p_datos jsonb)
 RETURNS configuracion_negocio
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_resultado public.configuracion_negocio%rowtype;
    v_cot_prefijo text := upper(coalesce(nullif(btrim(p_datos ->> 'cotizacion_prefijo'), ''), 'COT'));
    v_fac_prefijo text := upper(coalesce(nullif(btrim(p_datos ->> 'factura_prefijo'), ''), 'FAC'));
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso de administrador requerido.';
    end if;
    if v_cot_prefijo !~ '^[A-Z0-9]{2,8}$' or v_fac_prefijo !~ '^[A-Z0-9]{2,8}$' then
        raise exception 'Los prefijos deben tener entre 2 y 8 letras o numeros.';
    end if;

    update public.configuracion_negocio set
        nombre_comercial = coalesce(nullif(btrim(p_datos ->> 'nombre_comercial'), ''), nombre_comercial),
        razon_social = coalesce(nullif(btrim(p_datos ->> 'razon_social'), ''), razon_social),
        eslogan = nullif(btrim(p_datos ->> 'eslogan'), ''),
        rnc = nullif(btrim(p_datos ->> 'rnc'), ''),
        direccion = nullif(btrim(p_datos ->> 'direccion'), ''),
        ciudad = nullif(btrim(p_datos ->> 'ciudad'), ''),
        provincia = nullif(btrim(p_datos ->> 'provincia'), ''),
        pais = coalesce(nullif(btrim(p_datos ->> 'pais'), ''), pais),
        telefono = nullif(btrim(p_datos ->> 'telefono'), ''),
        correo = nullif(btrim(p_datos ->> 'correo'), ''),
        sitio_web = nullif(btrim(p_datos ->> 'sitio_web'), ''),
        logo_url = coalesce(nullif(btrim(p_datos ->> 'logo_url'), ''), logo_url),
        atendido_por_default = nullif(btrim(p_datos ->> 'atendido_por_default'), ''),
        cotizacion_prefijo = v_cot_prefijo,
        cotizacion_validez_dias = coalesce((p_datos ->> 'cotizacion_validez_dias')::integer, cotizacion_validez_dias),
        cotizacion_tiempo_entrega = nullif(btrim(p_datos ->> 'cotizacion_tiempo_entrega'), ''),
        cotizacion_condiciones = nullif(btrim(p_datos ->> 'cotizacion_condiciones'), ''),
        cotizacion_notas = nullif(btrim(p_datos ->> 'cotizacion_notas'), ''),
        cotizacion_mostrar_itbis = coalesce((p_datos ->> 'cotizacion_mostrar_itbis')::boolean, cotizacion_mostrar_itbis),
        cotizacion_itbis_pct = coalesce((p_datos ->> 'cotizacion_itbis_pct')::numeric, cotizacion_itbis_pct),
        factura_prefijo = v_fac_prefijo,
        factura_condicion_pago = coalesce(nullif(p_datos ->> 'factura_condicion_pago', ''), factura_condicion_pago),
        factura_dias_credito = coalesce((p_datos ->> 'factura_dias_credito')::integer, factura_dias_credito),
        factura_condiciones = nullif(btrim(p_datos ->> 'factura_condiciones'), ''),
        factura_notas = nullif(btrim(p_datos ->> 'factura_notas'), ''),
        factura_mostrar_itbis = coalesce((p_datos ->> 'factura_mostrar_itbis')::boolean, factura_mostrar_itbis),
        factura_itbis_pct = coalesce((p_datos ->> 'factura_itbis_pct')::numeric, factura_itbis_pct),
        actualizado_por = auth.uid(),
        actualizado_en = now()
    where id = 1
    returning * into v_resultado;

    return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guardar_producto_admin(p_producto_id bigint, p_isbn text, p_titulo text, p_autor text, p_categoria text, p_editorial text, p_descripcion text, p_precio numeric, p_descuento_pct numeric, p_formato text, p_idioma text, p_imagen_portada text, p_stock_inicial integer, p_stock_minimo integer, p_activo boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_producto_id bigint;
    v_autor_id bigint;
    v_categoria_id bigint;
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;
    if coalesce(btrim(p_titulo), '') = '' then
        raise exception 'El nombre es obligatorio.';
    end if;
    if p_precio is null or p_precio < 0 then
        raise exception 'El precio no es válido.';
    end if;
    if p_descuento_pct is null or p_descuento_pct < 0 or p_descuento_pct > 100 then
        raise exception 'El descuento debe estar entre 0 y 100.';
    end if;
    if p_stock_minimo is null or p_stock_minimo < 0 then
        raise exception 'El stock mínimo no es válido.';
    end if;
    if p_formato not in ('fisico', 'digital') then
        raise exception 'El formato no es válido.';
    end if;

    if coalesce(btrim(p_categoria), '') <> '' then
        select id into v_categoria_id
          from public.categorias
         where lower(nombre) = lower(btrim(p_categoria))
         order by id
         limit 1;
        if v_categoria_id is null then
            insert into public.categorias (nombre)
            values (btrim(p_categoria))
            returning id into v_categoria_id;
        else
            update public.categorias set activo = true where id = v_categoria_id;
        end if;
    end if;

    if p_producto_id is null then
        if p_stock_inicial is null or p_stock_inicial < 0 then
            raise exception 'El inventario inicial no es válido.';
        end if;

        insert into public.libros (
            isbn, titulo, descripcion, precio, descuento_pct, formato, idioma, editorial,
            categoria_id, stock_minimo, imagen_portada, activo
        ) values (
            nullif(btrim(p_isbn), ''), btrim(p_titulo), coalesce(btrim(p_descripcion), ''),
            p_precio, p_descuento_pct, p_formato, coalesce(nullif(btrim(p_idioma), ''), 'Español'),
            nullif(btrim(p_editorial), ''), v_categoria_id, p_stock_minimo,
            nullif(btrim(p_imagen_portada), ''), coalesce(p_activo, true)
        ) returning id into v_producto_id;

        insert into public.inventarios (libro_id, cantidad_existencia)
        values (v_producto_id, p_stock_inicial);

        if p_stock_inicial > 0 then
            insert into public.movimientos_inventario (
                libro_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo
            ) values (
                v_producto_id, auth.uid(), 'entrada', p_stock_inicial, 0, 'Inventario inicial'
            );
        end if;
    else
        update public.libros
           set isbn = nullif(btrim(p_isbn), ''),
               titulo = btrim(p_titulo),
               descripcion = coalesce(btrim(p_descripcion), ''),
               precio = p_precio,
               descuento_pct = p_descuento_pct,
               formato = p_formato,
               idioma = coalesce(nullif(btrim(p_idioma), ''), 'Español'),
               editorial = nullif(btrim(p_editorial), ''),
               categoria_id = v_categoria_id,
               stock_minimo = p_stock_minimo,
               imagen_portada = nullif(btrim(p_imagen_portada), ''),
               activo = coalesce(p_activo, true),
               actualizado_en = now()
         where id = p_producto_id
         returning id into v_producto_id;

        if v_producto_id is null then
            raise exception 'Producto no encontrado.';
        end if;
    end if;

    delete from public.libro_autor where libro_id = v_producto_id;
    if coalesce(btrim(p_autor), '') <> '' then
        select id into v_autor_id
          from public.autores
         where lower(nombre) = lower(btrim(p_autor))
         order by id
         limit 1;
        if v_autor_id is null then
            insert into public.autores (nombre)
            values (btrim(p_autor))
            returning id into v_autor_id;
        end if;

        insert into public.libro_autor (libro_id, autor_id)
        values (v_producto_id, v_autor_id);
    end if;

    return v_producto_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_movimientos_inventario(p_limite integer DEFAULT 40)
 RETURNS TABLE(id bigint, producto text, tipo text, cambio_existencia integer, cambio_reservada integer, motivo text, responsable text, creado_en timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if auth.uid() is null or not private.es_personal() then
        raise exception 'Acceso de personal requerido.';
    end if;

    return query
    select m.id::bigint,
           l.titulo::text,
           m.tipo::text,
           m.cambio_existencia::integer,
           m.cambio_reservada::integer,
           m.motivo::text,
           nullif(btrim(concat_ws(' ', p.nombres, p.apellidos)), '')::text,
           m.creado_en::timestamptz
      from public.movimientos_inventario m
      join public.libros l on l.id = m.libro_id
      left join public.perfiles p on p.id = m.realizado_por
     order by m.creado_en desc
     limit least(greatest(coalesce(p_limite, 40), 1), 200);
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_usuarios_admin()
 RETURNS TABLE(id uuid, correo text, nombres text, apellidos text, activo boolean, rol text, creado_en timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if auth.uid() is null or not private.es_admin() then
        raise exception 'Acceso administrativo requerido.';
    end if;

    return query
    select p.id::uuid, u.email::text, p.nombres::text, p.apellidos::text, p.activo::boolean,
           coalesce(r.codigo::text, 'cliente'::text), p.creado_en::timestamptz
      from public.perfiles p
      join auth.users u on u.id = p.id
      left join public.usuario_roles ur on ur.usuario_id = p.id
      left join public.roles r on r.id = ur.rol_id
     order by p.creado_en desc;
end;
$function$;

create or replace function private.es_activo()
returns boolean language sql stable security definer set search_path = ''
as $$
    select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- 4. Los 17 triggers del remoto, incluido registro Auth y cotización diferida.
CREATE TRIGGER al_crear_usuario_auth AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.crear_perfil_usuario();

CREATE TRIGGER actualizar_autores BEFORE UPDATE ON public.autores FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_carritos BEFORE UPDATE ON public.carritos FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_categorias BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER calcular_totales_cotizacion BEFORE INSERT OR UPDATE OF subtotal, descuento, snapshot ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION private.calcular_totales_documento();

CREATE TRIGGER actualizar_direcciones BEFORE UPDATE ON public.direcciones FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_editoriales BEFORE UPDATE ON public.editoriales FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER calcular_totales_factura BEFORE INSERT OR UPDATE OF subtotal, descuento, snapshot ON public.facturas FOR EACH ROW EXECUTE FUNCTION private.calcular_totales_documento();

CREATE TRIGGER actualizar_inventarios BEFORE UPDATE ON public.inventarios FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_libros BEFORE UPDATE ON public.libros FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_mensajes_contacto BEFORE UPDATE ON public.mensajes_contacto FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_pedidos BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER calcular_totales_pedido BEFORE INSERT OR UPDATE OF subtotal, descuento, costo_envio ON public.pedidos FOR EACH ROW EXECUTE FUNCTION private.calcular_totales_pedido();

CREATE CONSTRAINT TRIGGER crear_cotizacion_al_confirmar_pedido AFTER INSERT ON public.pedidos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.cotizar_pedido_al_confirmar();

CREATE TRIGGER sincronizar_documentos_al_cambiar_pedido AFTER UPDATE OF estado ON public.pedidos FOR EACH ROW EXECUTE FUNCTION private.sincronizar_estado_documentos();

CREATE TRIGGER actualizar_perfiles BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

CREATE TRIGGER actualizar_sucursales BEFORE UPDATE ON public.sucursales FOR EACH ROW EXECUTE FUNCTION private.fijar_actualizado_en();

-- 5. RLS en todas las tablas y políticas de autorización.
alter table "public"."autores" enable row level security;

alter table "public"."carrito_detalles" enable row level security;

alter table "public"."carritos" enable row level security;

alter table "public"."categorias" enable row level security;

alter table "public"."configuracion_negocio" enable row level security;

alter table "public"."contact_messages" enable row level security;

alter table "public"."cotizaciones" enable row level security;

alter table "public"."direcciones" enable row level security;

alter table "public"."editoriales" enable row level security;

alter table "public"."facturas" enable row level security;

alter table "public"."favoritos" enable row level security;

alter table "public"."inventarios" enable row level security;

alter table "public"."libro_autor" enable row level security;

alter table "public"."libro_categoria" enable row level security;

alter table "public"."libros" enable row level security;

alter table "public"."mensajes_contacto" enable row level security;

alter table "public"."movimientos_inventario" enable row level security;

alter table "public"."pedido_detalles" enable row level security;

alter table "public"."pedido_direcciones_entrega" enable row level security;

alter table "public"."pedidos" enable row level security;

alter table "public"."perfiles" enable row level security;

alter table "public"."roles" enable row level security;

alter table "public"."sucursales" enable row level security;

alter table "public"."usuario_roles" enable row level security;

create policy "autores_activos_lectura" on "public"."autores" as PERMISSIVE for SELECT to "authenticated" using ((activo OR ( SELECT private.es_admin() AS es_admin)));

create policy "autores_admin_gestion" on "public"."autores" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "autores_lectura_publica" on "public"."autores" as PERMISSIVE for SELECT to "anon" using (true);

create policy "categorias_activas_lectura" on "public"."categorias" as PERMISSIVE for SELECT to "authenticated" using ((activo OR ( SELECT private.es_admin() AS es_admin)));

create policy "categorias_admin_gestion" on "public"."categorias" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "categorias_lectura" on "public"."categorias" as PERMISSIVE for SELECT to "authenticated" using ((activo OR private.es_personal()));

create policy "categorias_lectura_publica" on "public"."categorias" as PERMISSIVE for SELECT to "anon" using (activo);

create policy "Configuracion visible para usuarios autenticados" on "public"."configuracion_negocio" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "contact_messages_actualizar_admin" on "public"."contact_messages" as PERMISSIVE for UPDATE to "authenticated" using (private.es_admin()) with check (private.es_admin());

create policy "contact_messages_lectura" on "public"."contact_messages" as PERMISSIVE for SELECT to "authenticated" using (((user_id = auth.uid()) OR private.es_admin()));

create policy "Cotizaciones visibles para propietario o personal" on "public"."cotizaciones" as PERMISSIVE for SELECT to "authenticated" using (((cliente_id = auth.uid()) OR private.es_personal()));

create policy "direcciones_propias" on "public"."direcciones" as PERMISSIVE for ALL to "authenticated" using ((perfil_id = ( SELECT auth.uid() AS uid))) with check ((perfil_id = ( SELECT auth.uid() AS uid)));

create policy "editoriales_activas_lectura" on "public"."editoriales" as PERMISSIVE for SELECT to "authenticated" using ((activo OR ( SELECT private.es_admin() AS es_admin)));

create policy "editoriales_admin_gestion" on "public"."editoriales" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "Facturas visibles para propietario o personal" on "public"."facturas" as PERMISSIVE for SELECT to "authenticated" using (((cliente_id = auth.uid()) OR private.es_personal()));

create policy "favoritos_propios" on "public"."favoritos" as PERMISSIVE for ALL to "authenticated" using ((perfil_id = ( SELECT auth.uid() AS uid))) with check ((perfil_id = ( SELECT auth.uid() AS uid)));

create policy "inventario_admin_gestion" on "public"."inventarios" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "inventario_catalogo_lectura" on "public"."inventarios" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM libros l
  WHERE ((l.id = inventarios.libro_id) AND l.activo))) OR ( SELECT private.es_admin() AS es_admin)));

create policy "inventario_lectura" on "public"."inventarios" as PERMISSIVE for SELECT to "authenticated" using ((private.es_personal() OR (EXISTS ( SELECT 1
   FROM libros l
  WHERE ((l.id = inventarios.libro_id) AND l.activo)))));

create policy "inventario_lectura_publica" on "public"."inventarios" as PERMISSIVE for SELECT to "anon" using ((EXISTS ( SELECT 1
   FROM libros
  WHERE ((libros.id = inventarios.libro_id) AND libros.activo))));

create policy "libro_autor_admin_gestion" on "public"."libro_autor" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "libro_autor_lectura" on "public"."libro_autor" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM libros l
  WHERE ((l.id = libro_autor.libro_id) AND l.activo))) OR ( SELECT private.es_admin() AS es_admin)));

create policy "libro_autor_lectura_publica" on "public"."libro_autor" as PERMISSIVE for SELECT to "anon" using ((EXISTS ( SELECT 1
   FROM libros
  WHERE ((libros.id = libro_autor.libro_id) AND libros.activo))));

create policy "libro_categoria_admin_gestion" on "public"."libro_categoria" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "libro_categoria_lectura" on "public"."libro_categoria" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM libros l
  WHERE ((l.id = libro_categoria.libro_id) AND l.activo))) OR ( SELECT private.es_admin() AS es_admin)));

create policy "libros_activos_lectura" on "public"."libros" as PERMISSIVE for SELECT to "authenticated" using ((activo OR ( SELECT private.es_admin() AS es_admin)));

create policy "libros_admin_gestion" on "public"."libros" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "libros_lectura" on "public"."libros" as PERMISSIVE for SELECT to "authenticated" using ((activo OR private.es_personal()));

create policy "libros_lectura_publica" on "public"."libros" as PERMISSIVE for SELECT to "anon" using (activo);

create policy "mensajes_admin_gestion" on "public"."mensajes_contacto" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "mensajes_propios_creacion" on "public"."mensajes_contacto" as PERMISSIVE for INSERT to "authenticated" with check ((perfil_id = ( SELECT auth.uid() AS uid)));

create policy "mensajes_propios_lectura" on "public"."mensajes_contacto" as PERMISSIVE for SELECT to "authenticated" using ((perfil_id = ( SELECT auth.uid() AS uid)));

create policy "movimientos_lectura_admin" on "public"."movimientos_inventario" as PERMISSIVE for SELECT to "authenticated" using (private.es_personal());

create policy "movimientos_solo_admin" on "public"."movimientos_inventario" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "detalles_pedido_admin_gestion" on "public"."pedido_detalles" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "detalles_pedido_propios_lectura" on "public"."pedido_detalles" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE ((p.id = pedido_detalles.pedido_id) AND (p.cliente_id = ( SELECT auth.uid() AS uid))))));

create policy "pedido_detalles_lectura" on "public"."pedido_detalles" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE ((p.id = pedido_detalles.pedido_id) AND ((p.cliente_id = auth.uid()) OR private.es_personal())))));

create policy "direccion_pedido_admin_gestion" on "public"."pedido_direcciones_entrega" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "direccion_pedido_propia_lectura" on "public"."pedido_direcciones_entrega" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE ((p.id = pedido_direcciones_entrega.pedido_id) AND (p.cliente_id = ( SELECT auth.uid() AS uid))))));

create policy "direcciones_pedido_lectura" on "public"."pedido_direcciones_entrega" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE ((p.id = pedido_direcciones_entrega.pedido_id) AND ((p.cliente_id = auth.uid()) OR private.es_personal())))));

create policy "pedidos_actualizacion_admin" on "public"."pedidos" as PERMISSIVE for UPDATE to "authenticated" using (private.es_personal()) with check (private.es_personal());

create policy "pedidos_admin_gestion" on "public"."pedidos" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "pedidos_lectura" on "public"."pedidos" as PERMISSIVE for SELECT to "authenticated" using (((cliente_id = auth.uid()) OR private.es_personal()));

create policy "pedidos_propios_lectura" on "public"."pedidos" as PERMISSIVE for SELECT to "authenticated" using ((cliente_id = ( SELECT auth.uid() AS uid)));

create policy "perfil_admin_gestion" on "public"."perfiles" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "perfil_propio_o_admin_actualizacion" on "public"."perfiles" as PERMISSIVE for UPDATE to "authenticated" using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.es_admin() AS es_admin))) with check (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.es_admin() AS es_admin)));

create policy "perfil_propio_o_admin_lectura" on "public"."perfiles" as PERMISSIVE for SELECT to "authenticated" using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.es_admin() AS es_admin)));

create policy "roles_lectura" on "public"."roles" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "sucursales_activas_lectura" on "public"."sucursales" as PERMISSIVE for SELECT to "authenticated" using ((activo OR ( SELECT private.es_admin() AS es_admin)));

create policy "sucursales_admin_gestion" on "public"."sucursales" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "rol_propio_o_admin_lectura" on "public"."usuario_roles" as PERMISSIVE for SELECT to "authenticated" using (((usuario_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.es_admin() AS es_admin)));

create policy "roles_usuario_admin_gestion" on "public"."usuario_roles" as PERMISSIVE for ALL to "authenticated" using (( SELECT private.es_admin() AS es_admin)) with check (( SELECT private.es_admin() AS es_admin));

create policy "portadas_admin_actualizar" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'portadas'::text) AND private.es_admin())) with check (((bucket_id = 'portadas'::text) AND private.es_admin()));

create policy "portadas_admin_eliminar" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'portadas'::text) AND private.es_admin()));

create policy "portadas_admin_insertar" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'portadas'::text) AND private.es_admin()));

create policy "portadas_admin_lectura" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'portadas'::text) AND private.es_admin()));

create policy carritos_lectura on public.carritos for select to authenticated using (perfil_id = auth.uid() or private.es_admin());

create policy carritos_creacion on public.carritos for insert to authenticated with check (perfil_id = auth.uid() and private.es_activo());

create policy carritos_actualizacion on public.carritos for update to authenticated using (perfil_id = auth.uid() and private.es_activo()) with check (perfil_id = auth.uid() and private.es_activo());

create policy carritos_eliminacion on public.carritos for delete to authenticated using (perfil_id = auth.uid() and private.es_activo());

create policy carrito_detalles_lectura on public.carrito_detalles for select to authenticated using (
    exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid()) or private.es_admin()
);

create policy carrito_detalles_creacion on public.carrito_detalles for insert to authenticated with check (
    private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid())
);

create policy carrito_detalles_actualizacion on public.carrito_detalles for update to authenticated
using (private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid()))
with check (private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid()));

create policy carrito_detalles_eliminacion on public.carrito_detalles for delete to authenticated using (
    private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid())
);

-- 6. Permisos explícitos: los privilegios comerciales se ejercen mediante RPC/Edge.
revoke all on all tables in schema public from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

revoke all on all functions in schema public, private from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public, private to service_role;

grant execute on function "private"."es_admin"() to authenticated;

grant execute on function "private"."es_personal"() to authenticated;

grant execute on function "public"."actualizar_estado_pedido"(p_pedido_id uuid, p_estado text) to authenticated;

grant execute on function "public"."actualizar_pago_pedido"(p_pedido_id uuid, p_estado_pago text) to authenticated;

grant execute on function "public"."actualizar_usuario_admin"(p_usuario_id uuid, p_nombres text, p_apellidos text, p_activo boolean, p_rol text) to authenticated;

grant execute on function "public"."ajustar_inventario_admin"(p_producto_id bigint, p_tipo text, p_cantidad integer, p_motivo text) to authenticated;

grant execute on function "public"."crear_pedido_desde_carrito"(p_metodo_entrega text, p_metodo_pago text, p_sucursal_id bigint, p_direccion jsonb, p_notas text) to authenticated;

grant execute on function "public"."eliminar_categoria_admin"(p_categoria_id bigint) to authenticated;

grant execute on function "public"."eliminar_producto_admin"(p_producto_id bigint) to authenticated;

grant execute on function "public"."enviar_mensaje_contacto"(p_nombre text, p_correo text, p_asunto text, p_mensaje text, p_telefono text) to authenticated;

grant execute on function "public"."generar_factura_pedido"(p_pedido_id uuid, p_ncf text, p_condicion_pago text, p_fecha_vencimiento date, p_notas text) to authenticated;

grant execute on function "public"."guardar_categoria_admin"(p_categoria_id bigint, p_nombre text, p_activo boolean) to authenticated;

grant execute on function "public"."guardar_configuracion_negocio"(p_datos jsonb) to authenticated;

grant execute on function "public"."guardar_producto_admin"(p_producto_id bigint, p_isbn text, p_titulo text, p_autor text, p_categoria text, p_editorial text, p_descripcion text, p_precio numeric, p_descuento_pct numeric, p_formato text, p_idioma text, p_imagen_portada text, p_stock_inicial integer, p_stock_minimo integer, p_activo boolean) to authenticated;

grant execute on function "public"."listar_movimientos_inventario"(p_limite integer) to authenticated;

grant execute on function "public"."listar_usuarios_admin"() to authenticated;

grant execute on function private.es_activo() to authenticated;

grant execute on function public.enviar_mensaje_contacto(text,text,text,text,text) to anon;

grant select on public.roles, public.perfiles, public.usuario_roles to authenticated;
grant select on public.autores, public.categorias, public.libros, public.libro_autor,
    public.inventarios, public.sucursales to authenticated;
grant select, insert, update, delete on public.carritos, public.carrito_detalles to authenticated;
grant select on public.pedidos, public.pedido_detalles, public.pedido_direcciones_entrega,
    public.movimientos_inventario, public.contact_messages, public.configuracion_negocio,
    public.cotizaciones, public.facturas to authenticated;
grant update (estado) on public.contact_messages to authenticated;
grant select (id, nombre) on public.autores to anon;
grant select (id, nombre, activo) on public.categorias to anon;
grant select (id, isbn, titulo, descripcion, precio, descuento_pct, formato, idioma,
    editorial, categoria_id, imagen_portada, activo) on public.libros to anon;
grant select (libro_id, autor_id) on public.libro_autor to anon;
grant select (libro_id, cantidad_disponible) on public.inventarios to anon;



grant select, insert, update, delete on public.direcciones, public.favoritos, public.editoriales, public.libro_categoria, public.mensajes_contacto to authenticated;
grant usage, select on sequence public.direcciones_id_seq,
    public.editoriales_id_seq, public.mensajes_contacto_id_seq to authenticated;

create policy direcciones_insert_activo on public.direcciones as restrictive for insert to authenticated with check (private.es_activo());

create policy direcciones_update_activo on public.direcciones as restrictive for update to authenticated using (private.es_activo()) with check (private.es_activo());

create policy direcciones_delete_activo on public.direcciones as restrictive for delete to authenticated using (private.es_activo());

create policy favoritos_insert_activo on public.favoritos as restrictive for insert to authenticated with check (private.es_activo());

create policy favoritos_update_activo on public.favoritos as restrictive for update to authenticated using (private.es_activo()) with check (private.es_activo());

create policy favoritos_delete_activo on public.favoritos as restrictive for delete to authenticated using (private.es_activo());

create policy mensajes_contacto_insert_activo on public.mensajes_contacto as restrictive for insert to authenticated with check (private.es_activo());

create policy mensajes_contacto_update_activo on public.mensajes_contacto as restrictive for update to authenticated using (private.es_activo()) with check (private.es_activo());

create policy mensajes_contacto_delete_activo on public.mensajes_contacto as restrictive for delete to authenticated using (private.es_activo());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('portadas','portadas',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- Datos ficticios para evaluación; no se copian registros ni cuentas del remoto.
insert into public.roles(codigo,nombre) values ('cliente','Cliente'),('empleado','Empleado'),('administrador','Administrador');
insert into public.configuracion_negocio(id) values (1);
insert into public.sucursales(codigo,nombre,direccion,ciudad,provincia)
values ('DEMO-01','Sucursal Principal','Calle ficticia 306','Santo Domingo','Distrito Nacional');

insert into public.categorias (nombre)
select datos.nombre
from (values
    ('Novela'), ('Clásicos'), ('Literatura infantil'), ('Ciencia ficción')
) as datos(nombre)
where not exists (
    select 1 from public.categorias c where lower(c.nombre) = lower(datos.nombre)
);

insert into public.autores (nombre)
select datos.nombre
from (values
    ('George Orwell'), ('Antoine de Saint-Exupéry'),
    ('Miguel de Cervantes'), ('Gabriel García Márquez')
) as datos(nombre)
where not exists (
    select 1 from public.autores a where lower(a.nombre) = lower(datos.nombre)
);

insert into public.libros (
    isbn, titulo, descripcion, precio, formato, idioma, editorial,
    categoria_id, stock_minimo, imagen_portada, activo
)
select datos.isbn, datos.titulo, datos.descripcion, datos.precio,
       'fisico', 'Español', datos.editorial, c.id,
       datos.stock_minimo, datos.imagen, true
from (values
    ('9780451524935', '1984', 'Una novela sobre vigilancia, poder y libertad individual.', 850.00, 'Debolsillo', 4, 'assets/portadas/1984.jpg', 'Ciencia ficción'),
    ('9780156012195', 'El Principito', 'Un relato sobre la amistad, el crecimiento y lo verdaderamente importante.', 750.00, 'Salamandra', 4, 'assets/portadas/el-principito.jpg', 'Literatura infantil'),
    ('9788420412146', 'Don Quijote de la Mancha', 'Las aventuras de don Quijote y Sancho Panza.', 1350.00, 'Alfaguara', 3, 'assets/portadas/don-quijote.jpg', 'Clásicos'),
    ('9780307474728', 'Cien años de soledad', 'La historia de la familia Buendía y el pueblo de Macondo.', 1100.00, 'Vintage Español', 3, 'assets/portadas/cien-anos-de-soledad.jpg', 'Novela')
) as datos(isbn, titulo, descripcion, precio, editorial, stock_minimo, imagen, categoria)
join lateral (
    select id from public.categorias
    where lower(nombre) = lower(datos.categoria)
    order by id limit 1
) c on true
where not exists (
    select 1 from public.libros l where l.isbn = datos.isbn
);

insert into public.libro_autor (libro_id, autor_id)
select l.id, a.id
from (values
    ('9780451524935', 'George Orwell'),
    ('9780156012195', 'Antoine de Saint-Exupéry'),
    ('9788420412146', 'Miguel de Cervantes'),
    ('9780307474728', 'Gabriel García Márquez')
) as datos(isbn, autor)
join lateral (
    select id from public.libros where isbn = datos.isbn order by id limit 1
) l on true
join lateral (
    select id from public.autores
    where lower(nombre) = lower(datos.autor) order by id limit 1
) a on true
where not exists (
    select 1 from public.libro_autor la
    where la.libro_id = l.id and la.autor_id = a.id
);

with inventario_nuevo as (
    insert into public.inventarios (libro_id, cantidad_existencia)
    select l.id, datos.cantidad
    from (values
        ('9780451524935', 12),
        ('9780156012195', 10),
        ('9788420412146', 7),
        ('9780307474728', 5)
    ) as datos(isbn, cantidad)
    join lateral (
        select id from public.libros where isbn = datos.isbn order by id limit 1
    ) l on true
    where not exists (
        select 1 from public.inventarios i where i.libro_id = l.id
    )
    returning libro_id, cantidad_existencia
)
insert into public.movimientos_inventario (
    libro_id, realizado_por, tipo, cambio_existencia, cambio_reservada, motivo
)
select libro_id, null, 'entrada', cantidad_existencia, 0,
       'Inventario inicial'
from inventario_nuevo
where cantidad_existencia > 0;



insert into public.editoriales(nombre,slug) select distinct editorial,lower(replace(editorial,' ','-')) from public.libros where editorial is not null;
update public.libros l set editorial_id=e.id from public.editoriales e where e.nombre=l.editorial;
insert into public.libro_categoria(libro_id,categoria_id) select id,categoria_id from public.libros where categoria_id is not null;
notify pgrst, 'reload schema';
commit;
