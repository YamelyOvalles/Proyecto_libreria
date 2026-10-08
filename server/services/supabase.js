const { HttpError } = require('../middleware/errors');
// Usa exclusivamente la clave pública y el JWT del usuario, conservando RLS.
function createSupabaseGateway(config, fetchImpl = fetch) {
    async function request(endpoint, token, options = {}) {
        let response;
        try {
            response = await fetchImpl(`${config.url}${endpoint}`, {
                ...options, signal: AbortSignal.timeout(15000),
                headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json' }
            });
        } catch { throw new HttpError(503, 'Supabase no está disponible. Intenta nuevamente.'); }
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const status = response.status === 401 ? 401 : response.status === 403 ? 403 :
                response.status >= 500 ? 502 : 400;
            throw new HttpError(status, body?.code === 'P0001' ? body.message :
                status === 401 ? 'Sesión inválida o vencida.' : status === 403 ? 'Acceso denegado.' : 'Supabase rechazó la operación.');
        }
        return body;
    }
    return {
        getUser: token => request('/auth/v1/user', token),
        getProfile: async (token, id) => (await request(`/rest/v1/perfiles?id=eq.${encodeURIComponent(id)}&select=activo`, token))?.[0],
        createOrder: (token, args) => request('/rest/v1/rpc/crear_pedido_desde_carrito', token,
            { method: 'POST', body: JSON.stringify(args) })
    };
}
module.exports = { createSupabaseGateway };
