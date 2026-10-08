const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { freshDatabase, seedIdentities, asUser, ids } = require('./helpers/database');
let db;
let order;
let bookId;
before(async () => {
    db = await freshDatabase(); await seedIdentities(db);
    bookId = (await db.query("select id from libros where isbn='9780451524935'")).rows[0].id;
});
after(async () => { await db?.close(); });
const q = (sql, values) => db.query(sql, values);
const run = (role, action) => asUser(db, ids[role], action);

test('instalación SQL desde cero, datos, bucket y RLS en todas las tablas públicas', async () => {
    assert.equal((await q('select count(*)::int as n from libros')).rows[0].n, 4);
    assert.equal((await q("select file_size_limit from storage.buckets where id='portadas'")).rows[0].file_size_limit, 5242880);
    assert.deepEqual((await q("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity")).rows, []);
});
test('registro asigna cliente aunque los metadatos soliciten administrador', async () => {
    const role = await run('cliente', () => q('select r.codigo from usuario_roles ur join roles r on r.id=ur.rol_id where usuario_id=$1', [ids.cliente]));
    assert.equal(role.rows[0].codigo, 'cliente');
});
test('visitante lee catálogo e inventario, no perfiles ni RPC administrativas', async () => {
    await asUser(db, null, async () => {
        assert.equal((await q('select id,titulo,precio from libros')).rows.length, 4);
        assert.equal((await q('select libro_id,cantidad_disponible from inventarios')).rows.length, 4);
        await assert.rejects(q('select * from perfiles'), /permission denied/);
        await assert.rejects(q('select listar_usuarios_admin()'), /permission denied/);
    });
});
test('cliente y empleado no pueden escalar roles ni modificar productos directamente', async () => {
    for (const role of ['cliente', 'empleado']) await run(role, async () => {
        await assert.rejects(q("update usuario_roles set rol_id=3 where usuario_id=$1", [ids[role]]), /permission denied/);
        await assert.rejects(q('update perfiles set activo=true where id=$1', [ids[role]]), /permission denied/);
        await assert.rejects(q("update libros set precio=1"), /permission denied/);
        await assert.rejects(q("select guardar_categoria_admin(null,'Ataque',true)"), /administrativo/);
        await assert.rejects(q('select listar_usuarios_admin()'), /administrativo/);
    });
});
test('carrito CRUD propio y aislamiento frente a otro cliente', async () => {
    await run('cliente', async () => {
        await q('insert into carritos(perfil_id) values($1)', [ids.cliente]);
        await q('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,$1,1 from carritos', [bookId]);
        await q('update carrito_detalles set cantidad=2');
        assert.equal((await q('select cantidad from carrito_detalles')).rows[0].cantidad, 2);
        await q('delete from carrito_detalles');
        await q('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,$1,2 from carritos', [bookId]);
        await assert.rejects(q('insert into carritos(perfil_id) values($1)', [ids.otro]), /row-level security/);
    });
    await run('otro', async () => {
        assert.equal((await q('select * from carritos')).rows.length, 0);
        assert.equal((await q('select * from carrito_detalles')).rows.length, 0);
        assert.equal((await q('delete from carrito_detalles')).affectedRows, 0);
    });
});
test('checkout calcula precios, reserva stock, vacía carrito y genera cotización atómicamente', async () => {
    const result = await run('cliente', () => q("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null) as pedido"));
    order = result.rows[0].pedido;
    assert.ok(order.id);
    const inventory = (await q('select * from inventarios where libro_id=$1', [bookId])).rows[0];
    assert.equal(inventory.cantidad_reservada, 2);
    assert.equal((await q('select * from carrito_detalles')).rows.length, 0);
    assert.equal((await q('select * from cotizaciones where pedido_id=$1', [order.id])).rows.length, 1);
    const detail = (await q('select subtotal,total from pedidos where id=$1', [order.id])).rows[0];
    assert.equal(Number(detail.subtotal), 1700);
    assert.ok(Number(detail.total) >= 1700);
    await run('cliente', () => assert.rejects(q("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null)"), /vacío/));
    await run('otro', async () => {
        assert.equal((await q('select * from pedidos')).rows.length, 0);
        assert.equal((await q('select * from cotizaciones')).rows.length, 0);
        assert.equal((await q('select * from pedido_detalles')).rows.length, 0);
    });
});
test('sin stock, checkout revierte sin crear pedido ni modificar inventario', async () => {
    await run('otro', async () => {
        await q('insert into carritos(perfil_id) values($1)', [ids.otro]);
        await q('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,$1,999 from carritos', [bookId]);
        await assert.rejects(q("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null)"), /existencias/);
    });
    assert.equal((await q('select count(*)::int n from pedidos')).rows[0].n, 1);
    assert.equal((await q('select cantidad_reservada from inventarios where libro_id=$1', [bookId])).rows[0].cantidad_reservada, 2);
});
test('personal procesa pedido, pago, factura única, despacho y devolución sin duplicar stock', async () => {
    await run('cliente', () => assert.rejects(q("select actualizar_estado_pedido($1,'procesando')", [order.id]), /personal/));
    await run('empleado', async () => {
        await assert.rejects(q("update pedidos set estado='entregado' where id=$1", [order.id]), /permission denied/);
        await q("select actualizar_estado_pedido($1,'procesando')", [order.id]);
        await q("select actualizar_pago_pedido($1,'pagado')", [order.id]);
        const invoice = await q('select (generar_factura_pedido($1)).id', [order.id]);
        assert.equal((await q('select (generar_factura_pedido($1)).id', [order.id])).rows[0].id, invoice.rows[0].id);
        await q("select actualizar_estado_pedido($1,'enviado')", [order.id]);
        await q("select actualizar_estado_pedido($1,'entregado')", [order.id]);
    });
    assert.equal((await q('select cantidad_existencia from inventarios where libro_id=$1', [bookId])).rows[0].cantidad_existencia, 10);
    await run('empleado', () => q("select actualizar_estado_pedido($1,'devuelto')", [order.id]));
    assert.equal((await q('select cantidad_existencia from inventarios where libro_id=$1', [bookId])).rows[0].cantidad_existencia, 12);
    await run('otro', () => q('select * from facturas').then(result => assert.equal(result.rows.length, 0)));
    await run('administrador', () => assert.rejects(q('select eliminar_producto_admin($1)', [bookId]), /ventas/));
});
test('administrador ejecuta CRUD categorías/productos e inventario con trazabilidad', async () => {
    await run('administrador', async () => {
        const category = (await q("select guardar_categoria_admin(null,'Demo CRUD',true) id")).rows[0].id;
        await q("select guardar_categoria_admin($1,'Demo CRUD editada',true)", [category]);
        const product = (await q(`select guardar_producto_admin(null,'DEMO-CRUD','Libro demo','Autor demo','Demo CRUD editada',
            'Editorial demo','Descripción',100,10,'fisico','Español',null,5,1,true) id`)).rows[0].id;
        await q("select ajustar_inventario_admin($1,'entrada',2,'Compra demo')", [product]);
        await assert.rejects(q("select ajustar_inventario_admin($1,'salida',999,'Imposible')", [product]), /reservada/);
        assert.ok((await q('select * from listar_movimientos_inventario(40)')).rows.length);
        await q('select eliminar_producto_admin($1)', [product]);
        assert.equal((await q('select * from libros where id=$1', [product])).rows.length, 0);
        await q('select eliminar_categoria_admin($1)', [category]);
    });
});
test('administrador gestiona usuarios y configuración, no puede quitarse su acceso', async () => {
    await run('administrador', async () => {
        assert.equal((await q('select * from listar_usuarios_admin()')).rows.length, 5);
        await assert.rejects(q("select actualizar_usuario_admin($1,'Ana','Demo',false,'cliente')", [ids.administrador]), /propio/);
        await q("select actualizar_usuario_admin($1,'Otro','Demo',false,'cliente')", [ids.otro]);
        await q(`select guardar_configuracion_negocio('{"nombre_comercial":"Librería demo"}')`);
    });
    await run('inactivo', async () => {
        await assert.rejects(q('insert into carritos(perfil_id) values($1)', [ids.inactivo]), /row-level security/);
        await assert.rejects(q("select guardar_categoria_admin(null,'Ataque',true)"), /administrativo/);
        await assert.rejects(q("select crear_pedido_desde_carrito('retiro','efectivo',1,null,null)"), /inactivo/);
    });
});
test('contacto público validado, lectura y cambio de estado solo autorizado', async () => {
    let message;
    await asUser(db, null, async () => {
        await assert.rejects(q("select enviar_mensaje_contacto('x','bad','x','x',null)"), /nombre/);
        message = (await q("select enviar_mensaje_contacto('Cliente Demo','demo@example.test','Consulta','Mensaje ficticio de prueba',null) id")).rows[0].id;
    });
    await run('cliente', () => q('select * from contact_messages').then(result => assert.equal(result.rows.length, 0)));
    await run('empleado', () => q('select * from contact_messages').then(result => assert.equal(result.rows.length, 0)));
    await run('administrador', async () => {
        await q("update contact_messages set estado='leido' where id=$1", [message]);
        assert.equal((await q('select estado from contact_messages where id=$1', [message])).rows[0].estado, 'leido');
    });
});
test('Storage impide escrituras a cliente/empleado y permite CRUD de administrador', async () => {
    for (const role of ['cliente', 'empleado']) await run(role, () =>
        assert.rejects(q("insert into storage.objects(bucket_id,name) values('portadas','ataque.png')"), /row-level security/));
    await run('administrador', async () => {
        await q("insert into storage.objects(bucket_id,name) values('portadas','demo.png')");
        await q("update storage.objects set name='demo-editada.png' where name='demo.png'");
        await q("delete from storage.objects where name='demo-editada.png'");
    });
});
test('migración incremental se aplica sin perder libros, usuarios ni historial', async () => {
    const before = (await q('select count(*)::int n from pedidos')).rows[0].n;
    await db.exec(fs.readFileSync('database/migrations/004_security_checkout.sql', 'utf8'));
    assert.equal((await q('select count(*)::int n from pedidos')).rows[0].n, before);
    assert.equal((await q('select count(*)::int n from perfiles')).rows[0].n, 5);
    assert.equal((await q('select count(*)::int n from libros')).rows[0].n, 4);
});
test('todas las RPC privilegiadas rechazan llamadas directas de cliente/empleado según su rol', async () => {
    const adminOnly = [
        "select guardar_producto_admin(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)",
        'select eliminar_producto_admin(1)',
        'select listar_usuarios_admin()', "select actualizar_usuario_admin(null,'x','x',true,'administrador')",
        "select guardar_categoria_admin(null,'Ataque',true)", 'select eliminar_categoria_admin(1)',
        "select guardar_configuracion_negocio('{}')"
    ];
    for (const role of ['cliente', 'empleado']) await run(role, async () => {
        for (const sql of adminOnly) await assert.rejects(q(sql), /administrador|administrativo/);
    });
    await run('cliente', async () => {
        await assert.rejects(q('select listar_movimientos_inventario(40)'), /personal/);
        await assert.rejects(q("select actualizar_pago_pedido($1,'pagado')", [order.id]), /personal/);
        await assert.rejects(q('select generar_factura_pedido($1)', [order.id]), /personal/);
        await assert.rejects(q("select ajustar_inventario_admin($1,'entrada',1,'Ataque')", [bookId]), /personal/);
    });
    await run('empleado', async () => {
        await q("select ajustar_inventario_admin($1,'entrada',1,'Entrada autorizada')", [bookId]);
        await q("select ajustar_inventario_admin($1,'salida',1,'Salida autorizada')", [bookId]);
    });
});
test('administrador desactivado pierde privilegios con el mismo claim de sesión', async () => {
    await q('update perfiles set activo=false where id=$1', [ids.administrador]);
    try {
        await run('administrador', async () => {
            await assert.rejects(q('select listar_usuarios_admin()'), /administrativo/);
            await assert.rejects(q("select ajustar_inventario_admin($1,'entrada',1,'Ataque')", [bookId]), /personal/);
            await assert.rejects(q("insert into storage.objects(bucket_id,name) values('portadas','inactivo.png')"), /row-level security/);
        });
    } finally { await q('update perfiles set activo=true where id=$1', [ids.administrador]); }
});
