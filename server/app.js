const path = require('node:path');
const express = require('express');
const { apiRoutes } = require('./routes/api');
const { pageRoutes } = require('./routes/pages');
const { errorHandler } = require('./middleware/errors');
const { publicConfigHandler } = require('./public-config');
const { createSupabaseGateway } = require('./services/supabase');
const { applicationSession, csrf } = require('./middleware/sessions');
const { supabaseRoutes } = require('./routes/supabase');
const helmet = require('helmet');
const { createApplicationAuth } = require('./services/application-auth');
const { authenticationRoutes } = require('./routes/authentication');
const { businessRoutes } = require('./routes/business');
function createApp({ config, gateway = createSupabaseGateway(config), fetchImpl = fetch, root = path.resolve(__dirname, '..') }) {
    const app = express();
    app.disable('x-powered-by');
    if (config.production) app.set('trust proxy', 1);
    app.use((req,res,next) => {
        if (config.production && !req.secure) return res.status(426).set('Cache-Control','no-store').json({error:'HTTPS es obligatorio en producción.'});
        next();
    });
    app.use(helmet({ contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'sha256-5HJQ770BY/irQosyt7PVonuMOqT64Szmf8BVR61GNas='"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:', 'https:', config.url],
        connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.production ? [] : null
    } }, crossOriginEmbedderPolicy: false }));
    const sessions = applicationSession(config);
    app.use(sessions);
    app.locals.closeSessions = sessions.close;
    app.use('/api/supabase', supabaseRoutes(config, gateway, fetchImpl));
    app.use(express.json({ limit: '100kb' }));
    app.use('/api', csrf);
    const authentication = createApplicationAuth(config, gateway, fetchImpl);
    app.use('/api/auth', authenticationRoutes(config, gateway, authentication));
    app.use('/api', businessRoutes(config, authentication));
    app.use('/api', apiRoutes(config, gateway, authentication.validate));
    app.get('/js/supabase-config.js', publicConfigHandler(config));
    app.get(['/admin', '/admin.html', '/documento', '/documento.html'], async (req, res, next) => {
        const auth = req.session.auth;
        const privatePath = req.path.toLowerCase();
        const login = '/login.html' + (privatePath.startsWith('/documento') ? '?returnTo=' + encodeURIComponent(req.originalUrl) : '');
        if (!auth || Date.now() - auth.started > 8 * 60 * 60 * 1000) return res.redirect(login);
        try {
            const identity = await authentication.validate(req);
            if (privatePath.startsWith('/admin') && !['administrador', 'empleado'].includes(identity.role)) return res.status(403).send('Acceso denegado.');
            res.set('Cache-Control', 'no-store'); next();
        } catch { res.redirect(login); }
    });
    app.use(pageRoutes(root));
    app.use(errorHandler);
    return app;
}
module.exports = { createApp };
