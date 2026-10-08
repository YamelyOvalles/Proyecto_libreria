const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { freshDatabase, seedIdentities, asUser, ids } = require('./helpers/database');
test('migración retira políticas remotas antiguas y permisos para reactivar la propia cuenta', async () => {
    const db = await freshDatabase();
    try {
        await seedIdentities(db);
        await db.exec(`
            create policy carrito_propio on public.carritos for all to authenticated
              using (perfil_id=auth.uid()) with check (perfil_id=auth.uid());
            create policy carrito_detalles_propios on public.carrito_detalles for all to authenticated
              using (exists(select 1 from public.carritos c where c.id=carrito_id and c.perfil_id=auth.uid()))
              with check (exists(select 1 from public.carritos c where c.id=carrito_id and c.perfil_id=auth.uid()));
            grant update on public.perfiles to authenticated;
            grant update (activo) on public.perfiles to authenticated;
            alter table public.pedidos add constraint pedidos_pago_valido
              check (metodo_pago in ('contra_entrega','transferencia'));
            alter table public.pedidos add constraint pedidos_estado_valido
              check (estado in ('pendiente','confirmado','procesando','listo_retiro','enviado','entregado','cancelado'));
        `);
        await asUser(db, ids.inactivo, async () => {
            await db.query('insert into carritos(perfil_id) values($1)', [ids.inactivo]);
            await db.query('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,1,1 from carritos');
            assert.equal((await db.query('update perfiles set activo=true where id=$1', [ids.inactivo])).affectedRows, 1);
        });
        await db.query('update perfiles set activo=false where id=$1', [ids.inactivo]);
        await asUser(db, ids.cliente, async () => {
            await db.query('insert into carritos(perfil_id) values($1)', [ids.cliente]);
            await db.query('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,1,1 from carritos');
            await assert.rejects(db.query("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null)"), /pedidos_pago_valido/);
        });
        await db.exec(fs.readFileSync('database/migrations/004_security_checkout.sql','utf8'));
        await asUser(db, ids.inactivo, async () => {
            await assert.rejects(db.query('update perfiles set activo=true where id=$1', [ids.inactivo]), /permission denied/);
            assert.equal((await db.query('update carrito_detalles set cantidad=2')).affectedRows, 0);
            assert.equal((await db.query('delete from carrito_detalles')).affectedRows, 0);
            await assert.rejects(db.query('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,2,1 from carritos'), /row-level security/);
            assert.equal((await db.query('update carritos set actualizado_en=now()')).affectedRows, 0);
        });
        const result = await asUser(db, ids.cliente, () => db.query("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null) as pedido"));
        await asUser(db, ids.empleado, async () => {
            for (const state of ['procesando','enviado','devuelto']) {
                await db.query('select actualizar_estado_pedido($1,$2)', [result.rows[0].pedido.id,state]);
            }
        });
    } finally { await db.close(); }
});
