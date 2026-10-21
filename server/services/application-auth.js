const { HttpError } = require('../middleware/errors');
const change = (req, action) => new Promise((resolve, reject) => req.session[action](error => error ? reject(error) : resolve()));
function createApplicationAuth(config, gateway, fetchImpl = fetch) {
    async function upstream(endpoint, token, method = 'GET', body, headers = {}) {
        try {
            return await fetchImpl(`${config.url}${endpoint}`, { method, body,
                signal: AbortSignal.timeout(15000), redirect: 'error',
                headers: { ...headers, apikey: config.anonKey, Authorization: `Bearer ${token || config.anonKey}` } });
        } catch { throw new HttpError(503, 'Supabase no está disponible.'); }
    }
    async function validate(req) {
        const auth = req.session.auth;
        if (!auth || Date.now() - auth.started > 8 * 60 * 60 * 1000) throw new HttpError(401, 'Sesión vencida.');
        if (auth.expires_at * 1000 < Date.now() + 60000) {
            const response = await upstream('/auth/v1/token?grant_type=refresh_token', null, 'POST',
                JSON.stringify({ refresh_token: auth.refresh_token }), { 'Content-Type': 'application/json' });
            if (!response.ok) throw new HttpError(401, 'Sesión vencida.');
            const data = await response.json();
            Object.assign(auth, { access_token: data.access_token, refresh_token: data.refresh_token,
                expires_at: data.expires_at, user: data.user });
            await change(req, 'save');
        }
        const user = await gateway.getUser(auth.access_token);
        const profile = await gateway.getProfile(auth.access_token, user.id);
        if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
        return { token: auth.access_token, user, role: await gateway.getRole(auth.access_token, user.id) };
    }
    return { upstream, validate };
}
module.exports = { createApplicationAuth, change };
