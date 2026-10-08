const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');
const { HttpError } = require('../server/middleware/errors');
const { createSupabaseGateway } = require('../server/services/supabase');
const { validPublicConfig } = require('../server/public-config');
const config = { url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_test' };
let server, base, lastCall;
const gateway = {
    async getUser(token) { if (token === 'expired') throw new HttpError(401, 'Sesión vencida.'); return { id: token }; },
    async getProfile(_token, id) { return id === 'missing' ? null : { activo: id !== 'inactive' }; },
    async createOrder(token, args) {
        if (token === 'outage') throw new Error('PASSWORD secreto');
        lastCall = { token, args }; return { id: 'pedido-demo', numero: 'LQ-DEMO' };
    }
};
before(async () => { server = createApp({ config, gateway }).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
const post = (token, data = { p_metodo_entrega: 'retiro', p_metodo_pago: 'efectivo', p_sucursal_id: 1 }) => fetch(`${base}/api/pedidos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data)
});
test('páginas y assets disponibles; secretos y archivos internos no se sirven', async () => {
    for (const route of ['/', '/admin', '/admin.html', '/tienda.html', '/login.html', '/css/styles.css', '/js/auth.js', '/vendor/supabase.js', '/api/health']) {
        const response = await fetch(base + route); assert.equal(response.status, 200, route); await response.body.cancel();
    }
    for (const route of ['/server/.env', '/.git/config', '/database/database.sql', '/scripts/.env.demo', '/api/no-existe']) {
        const response = await fetch(base + route); assert.equal(response.status, 404, route); await response.body.cancel();
    }
});
test('configuración pública valida local, rechaza service_role y URL arbitraria', async () => {
    assert.equal(validPublicConfig(config), true);
    assert.equal(validPublicConfig({ ...config, anonKey: 'sb_secret_secret' }), false);
    assert.equal(validPublicConfig({ ...config, url: 'http://example.test' }), false);
    const response = await fetch(`${base}/js/supabase-config.js`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /Object.freeze/);
});
test('checkout deniega sesión ausente, vencida y cuentas inactivas o sin perfil', async () => {
    for (const [token, status] of [[null, 401], ['expired', 401], ['inactive', 403], ['missing', 403]]) {
        const response = await post(token); assert.equal(response.status, status); await response.body.cancel();
    }
});
test('checkout rechaza identidad/precio del navegador y dirección inválida', async () => {
    for (const data of [{ cliente_id: 'otro' }, { p_metodo_entrega: 'domicilio', p_metodo_pago: 'efectivo', p_direccion: {} },
        { p_metodo_entrega: 'retiro', p_metodo_pago: 'efectivo', p_sucursal_id: -1 }]) {
        const response = await post('cliente', data); assert.equal(response.status, 400); await response.body.cancel();
    }
});
test('checkout HTTP entrega JWT y parámetros explícitos a la RPC', async () => {
    const response = await post('cliente'); assert.equal(response.status, 201);
    assert.equal((await response.json()).id, 'pedido-demo');
    assert.equal(lastCall.token, 'cliente'); assert.equal(lastCall.args.p_sucursal_id, 1);
    assert.equal(lastCall.args.p_direccion, null);
});
test('errores async y JSON inválido se devuelven sin filtrar detalles', async () => {
    const response = await post('outage'); assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /PASSWORD|secreto/);
    const bad = await fetch(`${base}/api/pedidos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(bad.status, 400); await bad.body.cancel();
});
test('gateway usa clave pública, JWT y timeout; traduce rechazo de Auth', async () => {
    let received;
    const adapter = createSupabaseGateway(config, async (url, opts) => {
        received = { url, opts }; return new Response(JSON.stringify({ id: 'user' }), { status: 200 });
    });
    await adapter.getUser('jwt'); assert.equal(received.opts.headers.apikey, config.anonKey);
    assert.equal(received.opts.headers.Authorization, 'Bearer jwt'); assert.ok(received.opts.signal);
    const denied = createSupabaseGateway(config, async () => new Response('{}', { status: 401 }));
    await assert.rejects(denied.getUser('jwt'), error => error.status === 401);
});
