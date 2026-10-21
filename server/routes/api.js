const { Router } = require('express');
const { requireSession } = require('../middleware/auth');
const { createOrderController } = require('../controllers/orders');
const { publicConfigHandler, validPublicConfig } = require('../public-config');
function apiRoutes(config, gateway, validate) {
    const router = Router();
    router.get('/health', (_req, res) => res.set('Cache-Control', 'no-store').json({
        status: 'ok', service: 'libreria-quisqueya', supabaseConfigured: validPublicConfig(config)
    }));
    router.get('/supabase-config', publicConfigHandler(config));
    router.post('/pedidos', requireSession(gateway, validate), createOrderController(gateway));
    router.use((_req, res) => res.status(404).json({ error: 'Ruta API no encontrada.' }));
    return router;
}
module.exports = { apiRoutes };
