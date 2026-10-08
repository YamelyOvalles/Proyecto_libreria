const { test } = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { createApp } = require('../server/app');
const { validPublicConfig } = require('../server/public-config');
dotenv.config({ path: 'server/.env.local', quiet: true });
const config = { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY };
const checked = async promise => { const result = await promise; assert.equal(result.error, null, result.error?.message); return result.data; };
const sdk = () => createClient(config.url, config.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const productArgs = title => ({
    p_producto_id: null, p_isbn: null, p_titulo: title, p_autor: 'Autor ficticio', p_categoria: 'Pruebas locales',
    p_editorial: 'Editorial demo', p_descripcion: 'Producto ficticio de integración', p_precio: 100,
    p_descuento_pct: 10, p_formato: 'fisico', p_idioma: 'Español', p_imagen_portada: null,
    p_stock_inicial: 10, p_stock_minimo: 1, p_activo: true
});
test('flujos reales con Auth/PostgREST/Storage/bright-action y Express en Supabase LOCAL', async t => {
    assert.ok(validPublicConfig(config) && /^http:\/\/(127\.0\.0\.1|localhost):/.test(config.url || ''),
        'Falta server/.env.local: ejecuta Supabase local, npm run local:config y npm run demo:seed. No se aceptan proyectos remotos.');
    const health = await fetch(`${config.url}/auth/v1/health`, { headers: { apikey: config.anonKey } });
    assert.equal(health.status, 200, 'Auth local debe estar disponible.');
    const clients = {};
    for (const role of ['admin', 'empleado', 'cliente', 'otro', 'inactivo']) {
        const client = sdk();
        const session = await checked(client.auth.signInWithPassword({ email: `${role}@demo.local`, password: 'DemoLocal-306!' }));
        clients[role] = { client, ...session };
    }
    const admin = clients.admin.client, customer = clients.cliente.client, other = clients.otro.client;
    const server = createApp({ config }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await Promise.all(Object.values(clients).map(item => item.client.auth.signOut({ scope: 'local' }))); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const edge = async (token, body) => fetch(`${config.url}/functions/v1/bright-action`, {
        method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    const orderRequest = (token, body) => fetch(`${base}/api/pedidos`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    await t.test('login, validación de sesión, credenciales incorrectas y refresh real', async () => {
        const denied = await sdk().auth.signInWithPassword({ email: 'cliente@demo.local', password: 'incorrecta' });
        assert.ok(denied.error);
        assert.equal((await checked(customer.auth.getUser())).user.id, clients.cliente.user.id);
        const refresh = await checked(customer.auth.refreshSession());
        clients.cliente.session = refresh.session;
        assert.ok(refresh.session.access_token);
    });
    await t.test('sin token, token inválido, cliente, empleado e inactivo no administran cuentas', async () => {
        for (const [token, expected] of [[null, 401], ['invalid', 401],
            [clients.cliente.session.access_token, 403], [clients.empleado.session.access_token, 403], [clients.inactivo.session.access_token, 403]]) {
            const result = await edge(token, { accion: 'crear' }); assert.equal(result.status, expected); await result.body.cancel();
        }
        const inactive = await orderRequest(clients.inactivo.session.access_token, {});
        assert.equal(inactive.status, 403); await inactive.body.cancel();
    });
    await t.test('Edge Function crea usuario, RPC edita perfil/rol y Edge Function elimina usuario sin historial', async () => {
        const email = `test-${Date.now()}@demo.local`;
        const result = await edge(clients.admin.session.access_token, { accion: 'crear', correo: email,
            password: 'DemoLocal-306!', nombres: 'Usuario ficticio', apellidos: 'Prueba', rol: 'empleado', activo: true });
        assert.equal(result.status, 201); const { id } = await result.json(); assert.ok(id);
        const created = sdk(); await checked(created.auth.signInWithPassword({ email, password: 'DemoLocal-306!' }));
        await checked(admin.rpc('actualizar_usuario_admin', { p_usuario_id: id, p_nombres: 'Editado', p_apellidos: 'Prueba', p_activo: true, p_rol: 'cliente' }));
        const role = await checked(created.from('usuario_roles').select('roles(codigo)').eq('usuario_id', id).single());
        assert.equal(role.roles.codigo, 'cliente');
        const deleted = await edge(clients.admin.session.access_token, { accion: 'eliminar', usuario_id: id });
        assert.equal(deleted.status, 200); await deleted.body.cancel();
        assert.ok((await created.auth.getUser()).error); await created.auth.signOut({ scope: 'local' });
    });
    let product;
    await t.test('CRUD categoría/producto, lectura del catálogo y ajuste de inventario', async () => {
        const category = await checked(admin.rpc('guardar_categoria_admin', { p_categoria_id: null, p_nombre: `Categoría ${Date.now()}`, p_activo: true }));
        await checked(admin.rpc('guardar_categoria_admin', { p_categoria_id: category, p_nombre: `Editada ${Date.now()}`, p_activo: true }));
        await checked(admin.rpc('eliminar_categoria_admin', { p_categoria_id: category }));
        product = await checked(admin.rpc('guardar_producto_admin', productArgs(`Libro integración ${Date.now()}`)));
        const item = await checked(customer.from('libros').select('titulo,precio').eq('id', product).single()); assert.equal(Number(item.precio), 100);
        await checked(admin.rpc('guardar_producto_admin', { ...productArgs('Libro integración editado'), p_producto_id: product }));
        await checked(admin.rpc('ajustar_inventario_admin', { p_producto_id: product, p_tipo: 'entrada', p_cantidad: 2, p_motivo: 'Prueba integración' }));
        assert.ok((await customer.rpc('guardar_producto_admin', productArgs('Ataque'))).error);
        const disposable = await checked(admin.rpc('guardar_producto_admin', productArgs('Producto a eliminar')));
        const deleted = await edge(clients.admin.session.access_token, { accion: 'eliminar_producto', producto_id: disposable });
        assert.equal(deleted.status, 200); await deleted.body.cancel();
    });
    await t.test('Storage sube, descarga y elimina una portada; cliente no puede escribir', async () => {
        const file = `test-${Date.now()}.png`;
        const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
        assert.ok((await customer.storage.from('portadas').upload(file, bytes, { contentType: 'image/png' })).error);
        await checked(admin.storage.from('portadas').upload(file, bytes, { contentType: 'image/png' }));
        const download = await checked(admin.storage.from('portadas').download(file)); assert.equal(download.size, bytes.length);
        await checked(admin.storage.from('portadas').remove([file]));
    });
    let order;
    await t.test('carrito propio, aislamiento, checkout HTTP y cotización', async () => {
        assert.ok(product, 'La prueba de producto debe haber pasado.');
        const cart = await checked(customer.from('carritos').upsert({ perfil_id: clients.cliente.user.id }, { onConflict: 'perfil_id' }).select('id').single());
        await checked(customer.from('carrito_detalles').delete().eq('carrito_id', cart.id));
        await checked(customer.from('carrito_detalles').upsert({ carrito_id: cart.id, libro_id: product, cantidad: 2 }));
        assert.deepEqual(await checked(other.from('carrito_detalles').select('*').eq('carrito_id', cart.id)), []);
        const branch = (await checked(customer.from('sucursales').select('id').eq('activo', true).limit(1)))[0];
        const body = { p_metodo_entrega: 'retiro', p_metodo_pago: 'efectivo', p_sucursal_id: branch.id };
        const forged = await orderRequest(clients.cliente.session.access_token, { ...body, total: 1 }); assert.equal(forged.status, 400); await forged.body.cancel();
        const response = await orderRequest(clients.cliente.session.access_token, body); assert.equal(response.status, 201); order = await response.json();
        const saved = await checked(customer.from('pedidos').select('subtotal,descuento').eq('id', order.id).single());
        assert.equal(Number(saved.subtotal), 200); assert.equal(Number(saved.descuento), 20);
        assert.equal((await checked(customer.from('carrito_detalles').select('*').eq('carrito_id', cart.id))).length, 0);
        assert.equal((await checked(customer.from('cotizaciones').select('id').eq('pedido_id', order.id))).length, 1);
        assert.deepEqual(await checked(other.from('pedidos').select('id').eq('id', order.id)), []);
    });
    await t.test('personal procesa, factura, pago y entrega; historial no se elimina', async () => {
        assert.ok(order, 'La prueba de checkout debe haber pasado.');
        const staff = clients.empleado.client;
        assert.ok((await customer.rpc('actualizar_estado_pedido', { p_pedido_id: order.id, p_estado: 'procesando' })).error);
        await checked(staff.rpc('actualizar_estado_pedido', { p_pedido_id: order.id, p_estado: 'procesando' }));
        await checked(staff.rpc('actualizar_pago_pedido', { p_pedido_id: order.id, p_estado_pago: 'pagado' }));
        await checked(staff.rpc('generar_factura_pedido', { p_pedido_id: order.id }));
        assert.equal((await checked(customer.from('facturas').select('id').eq('pedido_id', order.id))).length, 1);
        assert.deepEqual(await checked(other.from('facturas').select('id').eq('pedido_id', order.id)), []);
        await checked(staff.rpc('actualizar_estado_pedido', { p_pedido_id: order.id, p_estado: 'listo_retiro' }));
        await checked(staff.rpc('actualizar_estado_pedido', { p_pedido_id: order.id, p_estado: 'entregado' }));
        const denied = await edge(clients.admin.session.access_token, { accion: 'eliminar_producto', producto_id: product }); assert.equal(denied.status, 400); await denied.body.cancel();
        const history = await edge(clients.admin.session.access_token, { accion: 'eliminar', usuario_id: clients.cliente.user.id }); assert.equal(history.status, 409); await history.body.cancel();
    });
    await t.test('contacto, lectura administrativa y actualización del estado', async () => {
        const id = await checked(customer.rpc('enviar_mensaje_contacto', { p_nombre: 'Cliente Demo', p_correo: 'cliente@demo.local',
            p_asunto: 'Prueba local', p_mensaje: 'Mensaje ficticio para integración' }));
        assert.deepEqual(await checked(other.from('contact_messages').select('id').eq('id', id)), []);
        await checked(admin.from('contact_messages').update({ estado: 'leido' }).eq('id', id));
        assert.equal((await checked(customer.from('contact_messages').select('estado').eq('id', id).single())).estado, 'leido');
    });
    await t.test('logout borra la sesión del SDK y Express deniega nuevas solicitudes sin token', async () => {
        await checked(customer.auth.signOut({ scope: 'local' }));
        assert.equal((await checked(customer.auth.getSession())).session, null);
        const response = await orderRequest(null, {}); assert.equal(response.status, 401); await response.body.cancel();
    });
});
