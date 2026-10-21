const { HttpError } = require('./errors');
function requireSession(gateway, validate) {
    return async (req, _res, next) => {
        const auth = req.session?.auth;
        if (!auth || Date.now() - auth.started > 8 * 60 * 60 * 1000) throw new HttpError(401, 'Debes iniciar sesión.');
        if (validate) { req.identity = await validate(req); return next(); }
        const user = await gateway.getUser(auth.access_token);
        if (!user?.id) throw new HttpError(401, 'Sesión inválida.');
        const profile = await gateway.getProfile(auth.access_token, user.id);
        if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
        req.identity = { token: auth.access_token, user };
        next();
    };
}
module.exports = { requireSession };
