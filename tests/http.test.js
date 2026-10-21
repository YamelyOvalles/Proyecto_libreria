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
    async getRole(_token, id) { return id === 'admin' ? 'administrador' : id === 'staff' ? 'empleado' : 'cliente'; },
    async createOrder(token, args) {
        if (token === 'outage') throw new Error('PASSWORD secreto');
        lastCall = { token, args }; return { id: 'pedido-demo', numero: 'LQ-DEMO' };
    }
};
const upstream = async (url, options) => {
    if (url.includes('/auth/v1/token')) {
        const user = JSON.parse(options.body).email.split('@')[0];
        return Response.json({ access_token: user, refresh_token: 'PRIVATE_REFRESH', expires_at: Math.floor(Date.now()/1000)+3600, user: { id: user } });
    }
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: options.headers.Authorization.slice(7) });
    return Response.json([]);
};
before(async () => { server = createApp({ config, gateway, fetchImpl: upstream }).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
async function login(token) {
    return fetch(`${base}/api/supabase/auth/v1/token?grant_type=password`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1' },
        body: JSON.stringify({ email: `${token}@test.local`, password: 'fictional-test-password' }) });
}
async function cookieFor(token) {
    if (!token) return '';
    const response = await login(token);
    const cookie = response.headers.get('set-cookie')?.split(';')[0] || '';
    await response.body.cancel(); return cookie;
}
const post = async (token, data = { p_metodo_entrega: 'retiro', p_metodo_pago: 'efectivo', p_sucursal_id: 1 }) => fetch(`${base}/api/pedidos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1', Cookie: await cookieFor(token) }, body: JSON.stringify(data)
});
test('páginas y assets disponibles; secretos y archivos internos no se sirven', async () => {
    for (const route of ['/', '/tienda.html', '/login.html', '/css/styles.css', '/js/auth.js', '/vendor/supabase.js', '/api/health']) {
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
    assert.equal((await post(null)).status, 401);
    for (const [token, status] of [['expired', 401], ['inactive', 403], ['missing', 403]]) {
        const response = await login(token); assert.equal(response.status, status); await response.body.cancel();
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

test('sesión usa cookie HttpOnly, rota ID y oculta credenciales de Supabase', async () => {
    const first = await login('cliente');
    const cookie = first.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(await first.text(), /PRIVATE_REFRESH|"access_token":"cliente"/);
    const second = await fetch(`${base}/api/supabase/auth/v1/token?grant_type=password`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1', Cookie: cookie.split(';')[0] },
        body: JSON.stringify({ email: 'cliente@test.local', password: 'fictional-test-password' }) });
    assert.notEqual(second.headers.get('set-cookie').split(';')[0], cookie.split(';')[0]);
    await second.body.cancel();
    const stale = await fetch(`${base}/api/supabase/session`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(await stale.json(), null);
});

test('CSRF bloquea encabezado ausente y origen ajeno; bearer aislado no autentica', async () => {
    for (const headers of [{}, { 'X-Libreria-Request': '1', Origin: 'https://evil.test' }]) {
        const response = await fetch(`${base}/api/pedidos`, { method: 'POST', headers });
        assert.equal(response.status, 403); await response.body.cancel();
    }
    const forged = await fetch(`${base}/api/pedidos`, { method: 'POST', headers: { 'X-Libreria-Request': '1', Authorization: 'Bearer cliente' } });
    assert.equal(forged.status, 401); await forged.body.cancel();
});

test('páginas privadas y RPC administrativas verifican rol en el servidor', async () => {
    const guest = await fetch(base + '/admin', { redirect: 'manual' });
    assert.equal(guest.status, 302);
    for (const [user, expected] of [['cliente', 403], ['staff', 200], ['admin', 200]]) {
        const cookie = await cookieFor(user);
        const page = await fetch(base + '/admin.html', { headers: { Cookie: cookie }, redirect: 'manual' });
        assert.equal(page.status, expected); await page.body.cancel();
        const uppercase = await fetch(base + '/ADMIN.HTML', { headers: { Cookie: cookie }, redirect: 'manual' });
        assert.equal(uppercase.status, expected === 200 ? 404 : expected); await uppercase.body.cancel();
        const rpc = await fetch(base + '/api/supabase/rest/v1/rpc/guardar_categoria_admin', { method: 'POST',
            headers: { Cookie: cookie, 'X-Libreria-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(rpc.status, user === 'admin' ? 200 : 403); await rpc.body.cancel();
    }
});

test('logout invalida la sesión almacenada y bloquea reutilizar la cookie', async () => {
    const cookie = await cookieFor('cliente');
    const response = await fetch(base + '/api/supabase/auth/v1/logout', { method: 'POST', headers: { Cookie: cookie, 'X-Libreria-Request': '1' } });
    assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    await response.body.cancel();
    const session = await fetch(base + '/api/supabase/session', { headers: { Cookie: cookie } });
    assert.equal(await session.json(), null);
});

test('SDK real inicia sesión y restaura desde cookie sin recibir JWT de Supabase', async () => {
    const { createClient } = require('@supabase/supabase-js');
    let cookie = '';
    const adapter = async (url, options = {}) => {
        const headers = new Headers(options.headers); headers.set('X-Libreria-Request', '1'); headers.set('Cookie', cookie);
        const remote = new URL(url);
        const response = await fetch(base + '/api/supabase' + remote.pathname + remote.search, { ...options, headers });
        if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        return response;
    };
    const sdk = () => createClient(config.url, config.anonKey, { global: { fetch: adapter }, auth: { persistSession: false, autoRefreshToken: false } });
    const first = sdk();
    const result = await first.auth.signInWithPassword({ email: 'cliente@test.local', password: 'fictional-test-password' });
    assert.equal(result.error, null); assert.match(result.data.session.access_token, /server-session$/);
    const stored = await fetch(base + '/api/supabase/session', { headers: { Cookie: cookie } });
    const second = sdk(); const restored = await second.auth.setSession(await stored.json());
    assert.equal(restored.error, null); assert.equal(restored.data.user.id, 'cliente');
    assert.equal((await second.auth.signOut()).error, null);
});

test('producción rechaza MemoryStore y secretos cortos', () => {
    assert.throws(() => createApp({ config: { ...config, production: true }, gateway }), /SESSION_SECRET/);
    assert.throws(() => createApp({ config: { ...config, sessionSecret: 'short' }, gateway }), /32/);
});

test('sesión expira en ocho horas y renueva tokens solo en el servidor', async () => {
    const { createApplicationAuth } = require('../server/services/application-auth');
    let saved = false;
    const req = { session: { auth: { access_token: 'expired', refresh_token: 'private', expires_at: 1, started: Date.now(), user: { id: 'cliente' } },
        save: done => { saved = true; done(); } } };
    const auth = createApplicationAuth(config, gateway, async (_url, options) => {
        assert.equal(JSON.parse(options.body).refresh_token, 'private');
        return Response.json({ access_token: 'cliente', refresh_token: 'new-private', expires_at: Math.floor(Date.now()/1000)+3600, user: { id: 'cliente' } });
    });
    assert.equal((await auth.validate(req)).user.id, 'cliente'); assert.equal(saved, true);
    assert.equal(req.session.auth.refresh_token, 'new-private');
    req.session.auth.started = Date.now() - 9 * 60 * 60 * 1000;
    await assert.rejects(auth.validate(req), error => error.status === 401);
    req.session.auth.started = Date.now(); req.session.auth.access_token = 'inactive';
    await assert.rejects(auth.validate(req), error => error.status === 403);
});
