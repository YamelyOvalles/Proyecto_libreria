const path = require('node:path');
const { Router, static: serveStatic } = require('express');
function pageRoutes(root) {
    const router = Router();
    router.get('/vendor/supabase.js', (_req, res) => res.sendFile(
        path.join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), { dotfiles: 'allow' }));
    for (const directory of ['assets', 'css', 'js']) {
        router.use(`/${directory}`, serveStatic(path.join(root, directory), { dotfiles: 'deny', index: false }));
    }
    // Los nombres son fijos: permite instalar en un directorio padre oculto (.tmp),
    // sin exponer archivos ocultos pedidos por el cliente.
    router.get('/', (_req, res) => res.sendFile(path.join(root, 'index.html'), { dotfiles: 'allow' }));
    const pages = new Set(['index', 'admin', 'documento', 'formulario', 'informacion', 'login', 'tienda']);
    router.get('/:page', (req, res, next) => {
        const page = req.params.page.replace(/\.html$/i, '');
        if (!pages.has(page)) return next();
        res.sendFile(path.join(root, `${page}.html`), { dotfiles: 'allow' });
    });
    router.use((_req, res) => res.status(404).type('text').send('Página no encontrada.'));
    return router;
}
module.exports = { pageRoutes };
