-- Migración incremental Fase 4. Revisar y respaldar antes de aplicar en un proyecto existente.
-- Exportación remota recibida: conciliar cuerpos de RPC/triggers antes de aplicarla.
-- Ver database/conciliacion-remota.md. No se ha aplicado al remoto.

-- No crea demos, no reinicia tablas y no cambia la información comercial.

begin;

-- Restricciones antiguas de la exportación remota contradicen los CHECK actuales:
-- pedidos_metodo_pago_check permite efectivo/tarjeta y pedidos_estado_check permite devuelto.
-- Se conservan los CHECK actuales; se retiran solo las versiones antiguas duplicadas.
alter table public.pedidos drop constraint if exists pedidos_pago_valido;
alter table public.pedidos drop constraint if exists pedidos_estado_valido;

-- La exportación remota contiene políticas ALL antiguas. Las políticas permisivas
-- se combinan con OR: deben retirarse para que es_activo no pueda eludirse.
drop policy if exists carrito_propio on public.carritos;
drop policy if exists carrito_detalles_propios on public.carrito_detalles;

-- La aplicación cambia perfiles mediante RPC/Edge. Un cliente no debe poder
-- reactivar su propia cuenta con UPDATE directo (incluye permisos por columna).
revoke update on public.perfiles from authenticated;
do $$
declare v_columnas text;
begin
    select string_agg(quote_ident(attname), ', ' order by attnum) into v_columnas
    from pg_attribute where attrelid='public.perfiles'::regclass
      and attnum>0 and not attisdropped;
    execute format('revoke update (%s) on public.perfiles from authenticated', v_columnas);
end;
$$;

create or replace function private.es_activo()
returns boolean language sql stable security definer set search_path = ''
as $$
    select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

revoke all on function private.es_activo() from public, anon;

grant execute on function private.es_activo() to authenticated;

drop policy if exists carritos_creacion on public.carritos;
create policy carritos_creacion on public.carritos for insert to authenticated with check (perfil_id = auth.uid() and private.es_activo());

drop policy if exists carritos_actualizacion on public.carritos;
create policy carritos_actualizacion on public.carritos for update to authenticated using (perfil_id = auth.uid() and private.es_activo()) with check (perfil_id = auth.uid() and private.es_activo());

drop policy if exists carritos_eliminacion on public.carritos;
create policy carritos_eliminacion on public.carritos for delete to authenticated using (perfil_id = auth.uid() and private.es_activo());

drop policy if exists carrito_detalles_creacion on public.carrito_detalles;
create policy carrito_detalles_creacion on public.carrito_detalles for insert to authenticated with check (
    private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid())
);

drop policy if exists carrito_detalles_actualizacion on public.carrito_detalles;
create policy carrito_detalles_actualizacion on public.carrito_detalles for update to authenticated
using (private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid()))
with check (private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid()));

drop policy if exists carrito_detalles_eliminacion on public.carrito_detalles;
create policy carrito_detalles_eliminacion on public.carrito_detalles for delete to authenticated using (
    private.es_activo() and exists (select 1 from public.carritos c where c.id = carrito_id and c.perfil_id = auth.uid())
);

create or replace function public.crear_pedido_desde_carrito(
    p_metodo_entrega text,
    p_metodo_pago text,
    p_sucursal_id bigint default null,
    p_direccion jsonb default null,
    p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_usuario uuid := auth.uid();
    v_carrito uuid;
    v_pedido uuid;
    v_numero text;
    v_nombre text;
    v_correo text;
    v_subtotal numeric(12,2);
    v_descuento numeric(12,2);
    v_itbis numeric(12,2) := 0;
    v_aplicar_itbis boolean;
    v_itbis_pct numeric(5,2);
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
     where c.perfil_id = v_usuario;

    if v_carrito is null or not exists (
        select 1 from public.carrito_detalles where carrito_id = v_carrito
    ) then
        raise exception 'El carrito está vacío.';
    end if;

    -- Serializa dos checkout del mismo usuario; evita dos pedidos con el mismo carrito.
    perform 1 from public.carritos where id = v_carrito for update;
    if not exists (select 1 from public.carrito_detalles where carrito_id = v_carrito) then
        raise exception 'El carrito está vacío.';
    end if;

    -- Evita compras simultaneas sin stock.
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
    select cotizacion_mostrar_itbis, cotizacion_itbis_pct
      into v_aplicar_itbis, v_itbis_pct
      from public.configuracion_negocio
     where id = 1;

    v_itbis := case
        when coalesce(v_aplicar_itbis, false) and coalesce(v_itbis_pct, 0) > 0
        then round((v_subtotal - v_descuento) * v_itbis_pct / 100, 2)
        else 0
    end;
    v_total := v_subtotal - v_descuento + v_itbis + v_envio;

    insert into public.pedidos (
        cliente_id, cliente_nombre, cliente_correo, cliente_documento, cliente_telefono,
        metodo_entrega, sucursal_id, metodo_pago,
        subtotal, descuento, itbis, costo_envio, total, notas
    ) values (
        v_usuario, v_nombre, v_correo,
        nullif(btrim(p_direccion ->> 'documento'), ''),
        nullif(btrim(p_direccion ->> 'telefono_cliente'), ''),
        p_metodo_entrega, p_sucursal_id, p_metodo_pago,
        v_subtotal, v_descuento, v_itbis, v_envio, v_total, nullif(btrim(p_notas), '')
    ) returning id, numero into v_pedido, v_numero;

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
        'itbis', v_itbis,
        'costo_envio', v_envio,
        'total', v_total,
        'estado', 'pendiente',
        'estado_pago', 'pendiente'
    );
end;
$$;

notify pgrst, 'reload schema';

commit;
