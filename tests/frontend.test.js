const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function clientContext(config, auth) {
    const storage = new Map();
    const window = { LIBRERIA_SUPABASE_CONFIG: config, sessionStorage: storage,
        supabase: { createClient: (_url, _key, options) => { window.options = options; return { auth }; } } };
    vm.runInNewContext(fs.readFileSync('js/supabase-client.js', 'utf8'), { window, atob, console });
    return window;
}
test('cliente acepta Supabase local y mantiene sesión en sessionStorage', () => {
    const window = clientContext({ url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_test' }, {});
    assert.equal(window.libreriaSupabaseConfigurado, true);
    assert.equal(window.options.auth.storage, window.sessionStorage);
    assert.equal(window.options.auth.persistSession, true);
});
test('cliente rechaza claves administrativas y origen ajeno', () => {
    assert.equal(clientContext({ url: 'https://test.supabase.co', anonKey: 'sb_secret_test' }, {}).libreriaSupabaseConfigurado, false);
    assert.equal(clientContext({ url: 'http://evil.test', anonKey: 'sb_publishable_test' }, {}).libreriaSupabaseConfigurado, false);
});
test('sesión almacenada se confirma con getUser y se rechaza identidad distinta', async () => {
    const window = clientContext({ url: 'http://localhost:54321', anonKey: 'sb_publishable_test' }, {
        getSession: async () => ({ data: { session: { user: { id: 'a' }, access_token: 'jwt' } } }),
        getUser: async () => ({ data: { user: { id: 'b' } } })
    });
    assert.equal(await window.obtenerSesionLibreria(), null);
});
async function guard(pathname, { profile, role = 'cliente', user = { id: 'demo' } } = {}) {
    const redirects = [];
    let signedOut = false;
    const window = {
        location: { pathname, replace: url => redirects.push(url) },
        libreriaSupabaseConfigurado: true,
        obtenerSesionLibreria: async () => user ? { user } : null,
        obtenerRolLibreria: async () => role,
        obtenerPerfilLibreria: async () => profile,
        libreriaSupabase: { auth: { signOut: async () => { signedOut = true; }, onAuthStateChange: () => {} } }
    };
    const document = { documentElement: { style: {} }, dispatchEvent: () => {} };
    vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), {
        window, document, console, sessionStorage: { setItem: () => {}, removeItem: () => {} },
        CustomEvent: class { constructor(name, detail) { this.name = name; this.detail = detail; } }
    });
    await new Promise(resolve => setImmediate(resolve));
    return { redirects, signedOut, window };
}
test('guard protege admin con y sin extensión para cliente y visitante', async () => {
    for (const pathname of ['/admin', '/admin.html']) {
        assert.deepEqual((await guard(pathname, { profile: { activo: true } })).redirects, ['tienda.html']);
        assert.deepEqual((await guard(pathname, { user: null })).redirects, ['login.html']);
    }
});
test('guard cierra sesión de perfil ausente o inactivo, incluso si el rol es administrador', async () => {
    for (const profile of [null, { activo: false }]) {
        const result = await guard('/admin.html', { profile, role: 'administrador' });
        assert.equal(result.signedOut, true); assert.deepEqual(result.redirects, ['login.html?auth=inactivo']);
    }
});
