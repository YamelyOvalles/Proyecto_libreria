const { HttpError } = require('../middleware/errors');
const { change } = require('./application-auth');
function createAuthenticationService(applicationAuth, gateway) {
    const { upstream } = applicationAuth;
    async function request(path, body, token, method = 'POST') {
        const response = await upstream('/auth/v1/' + path, token, method, JSON.stringify(body), { 'Content-Type': 'application/json' });
        if (!response.ok) throw new HttpError(response.status >= 500 ? 502 : response.status, 'Supabase rechazó la autenticación. Revisa los datos o intenta nuevamente.');
        return response.status === 204 ? null : response.json();
    }
    async function establish(req, data, recovery = false) {
        const user = await gateway.getUser(data.access_token);
        const profile = await gateway.getProfile(data.access_token, user.id);
        if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
        await change(req, 'regenerate');
        req.session.auth = { access_token: data.access_token, refresh_token: data.refresh_token,
            expires_at: data.expires_at, user, started: Date.now(), recovery };
        await change(req, 'save');
        return { user, profile, role: await gateway.getRole(data.access_token, user.id) };
    }
    async function logout(req) {
        const token = req.session?.auth?.access_token;
        // Revocar primero: una renovación lenta no debe retrasar la invalidación propia.
        await change(req, 'destroy');
        if (token) { try { await upstream('/auth/v1/logout?scope=local', token, 'POST'); } catch { /* La sesión propia ya está revocada. */ } }
    }
    return { request, establish, logout };
}
module.exports = { createAuthenticationService };
