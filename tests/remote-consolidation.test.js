const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const schemaQuery = require('../scripts/schema-query');
const { freshDatabase, seedIdentities, asUser, ids } = require('./helpers/database');
const remote = require('./fixtures/schema-remoto-2026-10-07.json');
const definitions = require('./fixtures/funciones-remoto-2026-10-12.json');

test('instalador único conserva las 24 tablas, columnas, claves, índices y triggers del remoto', async () => {
    const db = await freshDatabase();
    try {
        const local = (await db.query(schemaQuery)).rows[0].schema_snapshot;
        assert.equal(local.tables.length, remote.tables.length);
        const removed = ['pedidos_pago_valido','pedidos_estado_valido','movimiento_tipo_valido'];
        for (const table of remote.tables) {
            const installed = local.tables.find(t => t.schema===table.schema && t.name===table.name);
            assert.ok(installed, table.name);
            const columns = values => values.map(({ privileges, ...column }) => column);
            assert.deepEqual(columns(installed.columns), columns(table.columns), table.name);
            // Deparsear los CHECK originales en el mismo motor: PG17/18 escriben casts de ARRAY de forma distinta.
            await db.exec(`create temporary table normalizar_checks (like public."${table.name}")`);
            const expected = [];
            for (const constraint of table.constraints.filter(c=>!removed.includes(c.name))) {
                if (!constraint.definition.startsWith('CHECK')) { expected.push(constraint); continue; }
                await db.exec(`alter table normalizar_checks add constraint "${constraint.name}" ${constraint.definition}`);
                const result = await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='normalizar_checks'::regclass and conname=$1",[constraint.name]);
                expected.push({name:constraint.name,definition:result.rows[0].definition});
            }
            await db.exec('drop table normalizar_checks');
            assert.deepEqual(installed.constraints, expected, table.name);
            assert.equal(installed.rls, true);
        }
        assert.deepEqual(local.indexes, remote.indexes);
        assert.deepEqual(local.triggers, remote.triggers);
        assert.deepEqual(local.sequences, remote.sequences);
        assert.deepEqual(local.buckets, remote.buckets);
        const changed = ['crear_pedido_desde_carrito','eliminar_producto_admin','snapshot_documento_pedido'];
        for (const fn of definitions) {
            const original = fn.definition.match(/AS \$function\$([\s\S]*)\$function\$/)[1].replaceAll('\r','');
            assert.equal(crypto.createHash('md5').update(original).digest('hex'), fn.body_md5, fn.name);
            assert.equal(fn.body_md5, remote.functions.find(f=>f.schema===fn.schema&&f.name===fn.name).body_md5);
            const installed = local.functions.find(f=>f.schema===fn.schema&&f.name===fn.name);
            assert.ok(installed, fn.name);
            assert.equal(installed.identity_arguments, fn.identity_arguments);
            if (!changed.includes(fn.name)) assert.equal(installed.body_md5, fn.body_md5, fn.name);
        }
        assert.equal(local.functions.length, 25); // 24 exportadas y es_activo de Fase 4.
    } finally { await db.close(); }
});

test('direcciones, favoritos, editoriales y mensajes heredados aplican RLS e identidad', async () => {
    const db = await freshDatabase();
    try {
        await seedIdentities(db);
        await asUser(db,ids.cliente,async () => {
            await db.query("insert into direcciones(destinatario,telefono,linea_1,ciudad,provincia) values('Demo','8090000000','Calle ficticia','Ciudad','Provincia')");
            await db.query('insert into favoritos(libro_id) values(1)');
            await db.query("insert into mensajes_contacto(nombre,correo,motivo,mensaje) values('Demo','demo@example.test','ayuda','Mensaje ficticio de prueba')");
            await assert.rejects(db.query('insert into favoritos(perfil_id,libro_id) values($1,2)',[ids.otro]),/row-level security/);
            await assert.rejects(db.query("insert into editoriales(nombre,slug) values('Ataque','ataque')"),/row-level security/);
        });
        await asUser(db,ids.otro,async () => {
            for (const table of ['direcciones','favoritos','mensajes_contacto']) {
                assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
            }
        });
        await db.query('update perfiles set activo=false where id=$1',[ids.cliente]);
        await asUser(db,ids.cliente,async () => {
            await assert.rejects(db.query('insert into favoritos(libro_id) values(2)'),/row-level security/);
            assert.equal((await db.query('delete from direcciones')).affectedRows,0);
        });
        await asUser(db,ids.administrador,async () => {
            const result = await db.query("insert into editoriales(nombre,slug) values('Editorial ficticia','editorial-ficticia') returning id");
            await db.query('delete from editoriales where id=$1',[result.rows[0].id]);
            assert.equal((await db.query('select * from mensajes_contacto')).rows.length,1);
        });
    } finally { await db.close(); }
});

test('checkout y documentos mantienen ITBIS, envío y totales coherentes con los triggers exportados', async () => {
    const db = await freshDatabase();
    try {
        await seedIdentities(db);
        await db.query('update configuracion_negocio set cotizacion_mostrar_itbis=true, cotizacion_itbis_pct=18, factura_mostrar_itbis=true, factura_itbis_pct=18');
        const bookId = (await db.query("select id from libros where isbn='9780451524935'")).rows[0].id;
        const result = await asUser(db,ids.cliente,async () => {
            await db.query('insert into carritos(perfil_id) values($1)',[ids.cliente]);
            await db.query('insert into carrito_detalles(carrito_id,libro_id,cantidad) select id,$1,2 from carritos',[bookId]);
            return db.query(`select crear_pedido_desde_carrito('domicilio','tarjeta',null,
                '{"destinatario":"Demo","telefono":"8090000000","linea_1":"Calle ficticia","ciudad":"Santo Domingo","provincia":"Distrito Nacional"}',null) pedido`);
        });
        const order = result.rows[0].pedido;
        assert.equal(Number(order.total),2156); // 1700 + 306 ITBIS + 150 envío.
        const quote = (await db.query('select * from cotizaciones where pedido_id=$1',[order.id])).rows[0];
        assert.equal(Number(quote.itbis),306);
        assert.equal(Number(quote.total),2156);
        assert.equal(Number(quote.snapshot.totales.itbis),306);
        assert.equal(quote.snapshot.articulos.length,1);
        const invoice = await asUser(db,ids.empleado,async () => {
            await db.query("select actualizar_estado_pedido($1,'procesando')",[order.id]);
            return db.query('select (generar_factura_pedido($1)).*',[order.id]);
        });
        assert.equal(Number(invoice.rows[0].total),2156);
        assert.equal(Number(invoice.rows[0].snapshot.totales.total),2156);
    } finally { await db.close(); }
});
