const path = require('node:path');
const express = require('express');
const { apiRoutes } = require('./routes/api');
const { pageRoutes } = require('./routes/pages');
const { errorHandler } = require('./middleware/errors');
const { publicConfigHandler } = require('./public-config');
const { createSupabaseGateway } = require('./services/supabase');
function createApp({ config, gateway = createSupabaseGateway(config), root = path.resolve(__dirname, '..') }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '100kb' }));
    app.use('/api', apiRoutes(config, gateway));
    app.get('/js/supabase-config.js', publicConfigHandler(config));
    app.use(pageRoutes(root));
    app.use(errorHandler);
    return app;
}
module.exports = { createApp };
