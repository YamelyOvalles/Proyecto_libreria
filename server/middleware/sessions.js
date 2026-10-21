const session = require('express-session');
const { randomBytes } = require('node:crypto');
const { HttpError } = require('./errors');

function applicationSession(config) {
    const production = config.production;
    if (production && (!config.sessionSecret || !config.databaseUrl)) {
        throw new Error('Producción requiere SESSION_SECRET y SESSION_DATABASE_URL.');
    }
    if (config.sessionSecret && config.sessionSecret.length < 32) throw new Error('SESSION_SECRET requiere al menos 32 caracteres.');
    const store = config.databaseUrl ? new (require('connect-pg-simple')(session))({
        conString: config.databaseUrl, tableName: 'application_sessions', createTableIfMissing: false,
        errorLog: () => console.error('No se pudo acceder al almacén de sesiones.')
    }) : undefined;
    const middleware = session({ name: 'lq.sid', secret: config.sessionSecret || randomBytes(48).toString('hex'),
        store, resave: false, saveUninitialized: false, rolling: true,
        cookie: { httpOnly: true, secure: production ? true : 'auto', sameSite: 'lax', maxAge: 30 * 60 * 1000 } });
    let closed = false;
    middleware.close = async () => { if (store && !closed) { closed = true; await store.close(); } };
    return middleware;
}

// Un encabezado propio obliga a preflight en solicitudes de otros sitios. No se habilita CORS.
function csrf(req, _res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    if (req.get('X-Libreria-Request') !== '1' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`) || req.get('Sec-Fetch-Site') === 'cross-site') {
        throw new HttpError(403, 'Origen de solicitud no permitido.');
    }
    next();
}
module.exports = { applicationSession, csrf };
