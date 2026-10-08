const { HttpError } = require('./errors');
function requireSession(gateway) {
    return async (req, _res, next) => {
        const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
        if (!match) throw new HttpError(401, 'Debes iniciar sesión.');
        const user = await gateway.getUser(match[1]);
        if (!user?.id) throw new HttpError(401, 'Sesión inválida.');
        const profile = await gateway.getProfile(match[1], user.id);
        if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
        req.session = { token: match[1], user };
        next();
    };
}
module.exports = { requireSession };
