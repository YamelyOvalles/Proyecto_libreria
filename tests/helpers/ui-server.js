const { createApp } = require('../../server/app');
// La prueba visual sin credenciales verifica estados públicos; no pretende probar Auth.
const config = { url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_ui_test' };
// Proveedor simulado para verificar el navegador sin Docker. No representa Supabase real.
const user = () => ({ id: '00000000-0000-4000-8000-000000000001', email: 'lector@example.test', user_metadata: {} });
const gateway = {
    getUser: async token => user(token),
    getProfile: async () => ({ activo: true, nombres: 'Lector' }),
    getRole: async () => 'cliente'
};
async function fetchImpl(url, options) {
    const path = new URL(url).pathname;
    if (path === '/auth/v1/token') return Response.json({ access_token: 'internal-provider-test-token', refresh_token: 'internal-provider-test-refresh',
        expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: user('internal-provider-test-token') });
    if (path === '/auth/v1/user') return Response.json(user('internal-provider-test-token'));
    if (path === '/rest/v1/perfiles') return Response.json({ activo: true, nombres: 'Lector' });
    if (path === '/rest/v1/usuario_roles') return Response.json({ roles: { codigo: 'cliente' } });
    return Response.json([]);
}
createApp({ config, gateway, fetchImpl }).listen(3106, '127.0.0.1');
