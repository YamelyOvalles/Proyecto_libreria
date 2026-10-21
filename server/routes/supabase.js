const { Router, raw } = require('express');
const { rateLimit } = require('express-rate-limit');
const { HttpError } = require('../middleware/errors');
const { csrf } = require('../middleware/sessions');
const { createApplicationAuth, change } = require('../services/application-auth');

const tables = new Set(['libros', 'categorias', 'editoriales', 'autores', 'libro_autor', 'libro_categoria',
    'perfiles', 'usuario_roles', 'roles', 'configuracion_negocio', 'sucursales', 'carritos', 'carrito_detalles',
    'cotizaciones', 'cotizacion_detalles', 'facturas', 'factura_detalles', 'pedidos', 'pedido_detalles',
    'inventarios', 'movimientos_inventario', 'contact_messages', 'direcciones', 'favoritos']);
const rpcs = new Set(['listar_movimientos_inventario', 'listar_usuarios_admin', 'guardar_producto_admin',
    'guardar_configuracion_negocio', 'eliminar_categoria_admin', 'guardar_categoria_admin', 'ajustar_inventario_admin',
    'generar_factura_pedido', 'actualizar_estado_pedido', 'actualizar_pago_pedido', 'actualizar_usuario_admin', 'enviar_mensaje_contacto']);
const adminRpcs = new Set(['listar_usuarios_admin', 'guardar_producto_admin', 'guardar_configuracion_negocio',
    'eliminar_categoria_admin', 'guardar_categoria_admin', 'ajustar_inventario_admin', 'actualizar_usuario_admin']);
// Valores de compatibilidad para el SDK. Nunca son JWT de Supabase ni otorgan acceso a la base.
function browserSession(auth) {
    if (!auth) return null;
    const payload = Buffer.from(JSON.stringify({ sub: auth.user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    return { access_token: `e30.${payload}.server-session`, refresh_token: 'server-session',
        token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: auth.user };
}

function supabaseRoutes(config, gateway, fetchImpl = fetch) {
    const router = Router();
    const { upstream, validate } = createApplicationAuth(config, gateway, fetchImpl);
    router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.get('/session', async (req, res) => {
        if (!req.session.auth) return res.json(null);
        try { await validate(req); res.json(browserSession(req.session.auth)); }
        catch (error) { if ([401, 403].includes(error.status)) { await change(req, 'destroy'); return res.json(null); } throw error; }
    });
    router.use(csrf);
    router.use('/auth/v1', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
        skip: req => req.method === 'GET' || req.path === '/logout',
        message: { error: 'Demasiados intentos. Intenta más tarde.' } }));
    router.use('/auth', raw({ type: () => true, limit: '100kb' }));
    router.use('/exchange', raw({ type: () => true, limit: '100kb' }));
    router.use('/storage', raw({ type: () => true, limit: '6mb' }));
    router.use(raw({ type: () => true, limit: '100kb' }));
    router.post('/exchange', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, legacyHeaders: false }), async (req, res) => {
        let data;
        try { data = JSON.parse(req.body.toString()); } catch { throw new HttpError(400, 'Datos inválidos.'); }
        if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw new HttpError(400, 'Datos inválidos.');
        const user = await gateway.getUser(data.access_token);
        const response = await upstream('/auth/v1/token?grant_type=refresh_token', null, 'POST',
            JSON.stringify({ refresh_token: data.refresh_token }), { 'Content-Type': 'application/json' });
        if (!response.ok) throw new HttpError(401, 'Enlace vencido.');
        const auth = await response.json();
        if (auth.user?.id !== user.id || !(await gateway.getProfile(auth.access_token, user.id))?.activo) throw new HttpError(403, 'Acceso denegado.');
        await change(req, 'regenerate'); req.session.auth = { access_token: auth.access_token, refresh_token: auth.refresh_token, expires_at: auth.expires_at, user: auth.user, started: Date.now() };
        await change(req, 'save'); res.json(browserSession(req.session.auth));
    });

    router.use(async (req, res) => {
        const url = new URL(req.originalUrl.replace(/^\/api\/supabase/, ''), 'http://internal');
        const route = url.pathname;
        if (route.includes('%') || route.includes('..')) throw new HttpError(400, 'Ruta inválida.');
        const authEndpoint = /^\/auth\/v1\/(token|signup|recover|user|logout|verify)$/.exec(route)?.[1];
        let identity;
        if (authEndpoint) {
            if (!(authEndpoint === 'user' ? ['GET', 'PUT'] : ['POST']).includes(req.method)) throw new HttpError(405, 'Método no permitido.');
            if (['token', 'signup', 'recover'].includes(authEndpoint) && url.searchParams.get('grant_type') !== 'refresh_token') {
                let data;
                try { data = JSON.parse(req.body.toString()); } catch { throw new HttpError(400, 'JSON inválido.'); }
                if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
                    (authEndpoint !== 'recover' && (typeof data.password !== 'string' || data.password.length < 8 || data.password.length > 1024))) throw new HttpError(400, 'Correo o contraseña inválidos.');
            }
            if (authEndpoint === 'logout') {
                // La indisponibilidad del proveedor no impide destruir la sesión propia.
                if (req.session.auth) {
                    try { await upstream('/auth/v1/logout?scope=local', req.session.auth.access_token, 'POST'); } catch { /* Se invalida igualmente en Express. */ }
                }
                await change(req, 'destroy');
                res.clearCookie('lq.sid', { httpOnly: true, secure: Boolean(config.production || req.secure), sameSite: 'lax' });
                return res.json({});
            }
            if (authEndpoint === 'user') identity = await validate(req);
            if (authEndpoint === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
                await validate(req); return res.json(browserSession(req.session.auth));
            }
            if (authEndpoint === 'token' && url.searchParams.get('grant_type') !== 'password') throw new HttpError(400, 'Acceso no permitido.');
        } else {
            const table = /^\/rest\/v1\/([a-z_]+)$/.exec(route)?.[1];
            const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(route)?.[1];
            const storage = /^\/storage\/v1\/(object|object\/public)\/portadas(?:\/.*)?$/.test(route);
            const edge = route === '/functions/v1/bright-action';
            if ((!tables.has(table) && !rpcs.has(rpc) && !storage && !edge) || !['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) throw new HttpError(404, 'Operación no disponible.');
            const publicRead = (rpc === 'enviar_mensaje_contacto' && req.method === 'POST') || ['GET', 'HEAD'].includes(req.method) && (['libros', 'categorias', 'editoriales', 'autores', 'configuracion_negocio', 'sucursales'].includes(table) || storage);
            if (!publicRead || req.session.auth) identity = await validate(req);
            if ((adminRpcs.has(rpc) || edge || (storage && !['GET', 'HEAD'].includes(req.method))) && identity?.role !== 'administrador') throw new HttpError(403, 'Se requiere administrador.');
            if (rpc && rpc !== 'enviar_mensaje_contacto' && !adminRpcs.has(rpc) && !['administrador', 'empleado'].includes(identity?.role)) throw new HttpError(403, 'Se requiere personal autorizado.');
            // Las políticas RLS y las RPC siguen siendo la autoridad sobre filas, argumentos y transacciones.
        }
        let body = req.body;
        if (body && !Buffer.isBuffer(body)) body = JSON.stringify(body);
        const headers = {};
        for (const key of ['content-type', 'prefer', 'accept', 'range', 'x-upsert']) if (req.get(key)) headers[key] = req.get(key);
        const response = await upstream(route + url.search, identity?.token, req.method, ['GET', 'HEAD'].includes(req.method) ? undefined : body, headers);
        if (!response.ok) {
            // No reenviar errores de PostgreSQL, tokens ni detalles internos del proveedor.
            return res.status(response.status >= 500 ? 502 : response.status).json({ error: 'Operación rechazada.', message: 'No se pudo completar la operación.', code: 'request_rejected' });
        }
        if (authEndpoint) {
            const data = await response.json();
            if (data.access_token && data.refresh_token) {
                const user = await gateway.getUser(data.access_token);
                const profile = await gateway.getProfile(data.access_token, user.id);
                if (!profile?.activo) throw new HttpError(403, 'La cuenta no está activa.');
                await change(req, 'regenerate');
                req.session.auth = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, user, started: Date.now() };
                await change(req, 'save');
                return res.json(browserSession(req.session.auth));
            }
            return res.json(data);
        }
        for (const key of ['content-type', 'content-range']) if (response.headers.has(key)) res.set(key, response.headers.get(key));
        res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
    });
    return router;
}
module.exports = { supabaseRoutes, browserSession };
