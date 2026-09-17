-- Ejecutar después del script principal de tablas y RLS.
-- Crea el pedido en una sola transacción, usando precios e inventario del servidor.

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
    v_envio numeric(12,2) := 0;
    v_total numeric(12,2);
begin
    if v_usuario is null then
        raise exception 'Debes iniciar sesión para realizar un pedido.';
    end if;

    if p_metodo_entrega not in ('domicilio', 'retiro') then
        raise exception 'Método de entrega inválido.';
    end if;
    if p_metodo_pago not in ('contra_entrega', 'transferencia') then
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

    -- Bloqueo de las existencias involucradas para evitar compras simultáneas.
    perform i.libro_id
      from public.inventarios i
      join public.carrito_detalles cd on cd.libro_id = i.libro_id
     where cd.carrito_id = v_carrito
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

    select sum(l.precio * cd.cantidad)
      into v_subtotal
      from public.carrito_detalles cd
      join public.libros l on l.id = cd.libro_id
     where cd.carrito_id = v_carrito;

    v_total := v_subtotal + v_envio;

    insert into public.pedidos (
        cliente_id, cliente_nombre, cliente_correo,
        metodo_entrega, sucursal_id, metodo_pago,
        subtotal, costo_envio, total, notas
    ) values (
        v_usuario, v_nombre, v_correo,
        p_metodo_entrega, p_sucursal_id, p_metodo_pago,
        v_subtotal, v_envio, v_total, nullif(btrim(p_notas), '')
    ) returning id, numero into v_pedido, v_numero;

    insert into public.pedido_detalles (
        pedido_id, libro_id, isbn, titulo, precio_unitario, cantidad
    )
    select v_pedido, l.id, l.isbn, l.titulo, l.precio, cd.cantidad
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
        'costo_envio', v_envio,
        'total', v_total,
        'estado', 'pendiente',
        'estado_pago', 'pendiente'
    );
end;
$$;

revoke all on function public.crear_pedido_desde_carrito(text, text, bigint, jsonb, text)
from public, anon;

grant execute on function public.crear_pedido_desde_carrito(text, text, bigint, jsonb, text)
to authenticated;

-- Cambia el estado y mantiene las reservas del inventario consistentes.
create or replace function public.actualizar_estado_pedido(
    p_pedido_id uuid,
    p_estado text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    if v_estado_anterior in ('cancelado', 'devuelto') then
        raise exception 'No se puede reabrir un pedido finalizado.';
    end if;
    if v_estado_anterior = 'entregado' and p_estado <> 'devuelto' then
        raise exception 'Un pedido entregado solo puede marcarse como devuelto.';
    end if;
    if v_estado_anterior = 'enviado' and p_estado not in ('entregado', 'devuelto') then
        raise exception 'Un pedido enviado solo puede entregarse o devolverse.';
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
$$;

revoke all on function public.actualizar_estado_pedido(uuid, text) from public, anon;
grant execute on function public.actualizar_estado_pedido(uuid, text) to authenticated;
