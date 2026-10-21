const { HttpError } = require('../middleware/errors');
const change = (req, action) => new Promise((resolve, reject) => req.session[action](error => error ? reject(error) : resolve()));
function createApplicationAuth(config, gateway, fetchImpl = fetch) {
    const renewals = new Map();
    const readSession = req => new Promise((resolve, reject) => req.sessionStore.get(req.sessionID, (error, value) => error ? reject(error) : resolve(value)));
    async function upstream(endpoint, token, method = 'GET', body, headers = {}) {
        try {
            return await fetchImpl(`${config.url}${endpoint}`, { method, body,
                signal: AbortSignal.timeout(15000), redirect: 'error',
                headers: { ...headers, apikey: config.anonKey, Authorization: `Bearer ${token || config.anonKey}` } });
        } catch { throw new HttpError(503, 'Supabase no está disponible.'); }
    }
    async function validate(req) {
        let auth = req.session.auth;
        if (!auth || Date.now() - auth.started > 8 * 60 * 60 * 1000) throw new HttpError(401, 'Sesión vencida.');
        if (auth.expires_at * 1000 < Date.now() + 60000) {
            const id = req.sessionID;
            if (!renewals.has(id)) renewals.set(id, (async () => {
                const live = req.sessionStore ? await readSession(req) : req.session;
                if (!live?.auth) throw new HttpError(401, 'La sesión ha sido cerrada.');
                if (live.auth.expires_at * 1000 >= Date.now() + 60000) return live.auth;
                const response = await upstream('/auth/v1/token?grant_type=refresh_token', null, 'POST',
                    JSON.stringify({ refresh_token: live.auth.refresh_token }), { 'Content-Type': 'application/json' });
                if (!response.ok) throw new HttpError(401, 'Sesión vencida.');
                const data = await response.json();
                if (req.sessionStore && !(await readSession(req))?.auth) throw new HttpError(401, 'La sesión ha sido cerrada.');
                const renewed = { ...live.auth, access_token: data.access_token, refresh_token: data.refresh_token,
                    expires_at: data.expires_at, user: data.user };
                // Store.set también verifica la revocación atómicamente; comprobar get por sí solo no basta.
                req.session.auth = renewed;
                try { await change(req, 'save'); } catch (error) { delete req.session.auth; throw error; }
                return renewed;
            })().finally(() => renewals.delete(id)));
            auth = await renewals.get(id);
            req.session.auth = auth;
        }
        if (req.sessionStore && !(await readSession(req))?.auth) { delete req.session.auth; throw new HttpError(401, 'La sesión ha sido cerrada.'); }
        const user = await gateway.getUser(auth.access_token);
        const profile = await gateway.getProfile(auth.access_token, user.id);
        if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
        return { token: auth.access_token, user, profile, role: await gateway.getRole(auth.access_token, user.id) };
    }
    return { upstream, validate };
}
module.exports = { createApplicationAuth, change };
