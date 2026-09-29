-- Migra una instalacion existente: los precios de los libros no incluyen ITBIS.
-- Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.pedidos
    add column if not exists itbis numeric(12,2) not null default 0
    check (itbis >= 0);

alter table public.pedidos
    drop constraint if exists pedidos_total_check;

-- Algunas instalaciones anteriores usaron este nombre para la misma formula.
alter table public.pedidos
    drop constraint if exists pedidos_importes_validos;

create or replace function private.calcular_totales_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

drop trigger if exists calcular_totales_pedido on public.pedidos;
create trigger calcular_totales_pedido
before insert or update of subtotal, descuento, costo_envio
on public.pedidos
for each row execute function private.calcular_totales_pedido();

-- Recalcula pedidos existentes y luego protege la formula correcta.
update public.pedidos set subtotal = subtotal;

alter table public.pedidos
    add constraint pedidos_importes_validos check (
        subtotal >= 0
        and descuento >= 0
        and descuento <= subtotal
        and itbis >= 0
        and costo_envio >= 0
        and total = subtotal - descuento + itbis + costo_envio
    );

create or replace function private.calcular_totales_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

drop trigger if exists calcular_totales_cotizacion on public.cotizaciones;
create trigger calcular_totales_cotizacion
before insert or update of subtotal, descuento, snapshot
on public.cotizaciones
for each row execute function private.calcular_totales_documento();

drop trigger if exists calcular_totales_factura on public.facturas;
create trigger calcular_totales_factura
before insert or update of subtotal, descuento, snapshot
on public.facturas
for each row execute function private.calcular_totales_documento();

-- Corrige los importes y snapshots que ya estaban almacenados.
update public.cotizaciones set snapshot = snapshot;
update public.facturas set snapshot = snapshot;

commit;
