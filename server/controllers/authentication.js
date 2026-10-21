const v = require('../middleware/validation');
const { HttpError } = require('../middleware/errors');
const { createAuthenticationService } = require('../services/authentication');
function createAuthenticationController(config, gateway, applicationAuth) {
    const auth = createAuthenticationService(applicationAuth, gateway);
    return { session: async (req, res) => {
        if (!req.session.auth) return res.json(null);
        try { const identity = await applicationAuth.validate(req); res.json({ user: identity.user, profile: identity.profile, role: identity.role }); }
        catch (error) { if ([401, 403].includes(error.status)) { await auth.logout(req); return res.json(null); } throw error; }
    }, login: async (req, res) => {
        res.json(await auth.establish(req, await auth.request('token?grant_type=password', v.credentials(req.body))));
    }, register: async (req, res) => {
        const data = await auth.request('signup', v.credentials(req.body));
        if (data.access_token) return res.status(201).json({ session: await auth.establish(req, data), user: data.user });
        res.status(201).json({ session: null, user: data.user || data });
    }, logout: async (req, res) => {
        await auth.logout(req);
        res.clearCookie('lq.sid', { httpOnly: true, secure: Boolean(config.production || req.secure), sameSite: 'lax' });
        res.json({ ok: true });
    }, recover: async (req, res) => {
        v.fields(req.body, ['email']);
        const target = encodeURIComponent(`${req.protocol}://${req.get('host')}/login.html`);
        await auth.request('recover?redirect_to=' + target, { email: v.email(req.body.email) });
        res.json({ ok: true });
    }, password: async (req, res) => {
        v.fields(req.body, ['password']); v.credentials({ email: 'validation@example.test', password: req.body.password });
        const identity = await applicationAuth.validate(req);
        const user = await auth.request('user', { password: req.body.password }, identity.token, 'PUT');
        res.json({ user });
    }, exchange: async (req, res) => {
        v.fields(req.body, ['access_token', 'refresh_token', 'type']);
        const token = v.text(req.body.access_token, 'Token', 16000);
        const refresh = v.text(req.body.refresh_token, 'Renovación', 16000);
        const user = await gateway.getUser(token);
        const data = await auth.request('token?grant_type=refresh_token', { refresh_token: refresh });
        if (data.user?.id !== user.id) throw new HttpError(403, 'Identidad incompatible.');
        res.json(await auth.establish(req, data, req.body.type === 'recovery'));
    }, oauth: async (req, res) => {
        v.fields(req.body, ['provider']);
        if (req.body.provider !== 'google') throw new HttpError(400, 'Proveedor inválido.');
        const redirect = `${req.protocol}://${req.get('host')}/login.html`;
        res.json({ url: `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}` });
    } };
}
module.exports = { createAuthenticationController };
