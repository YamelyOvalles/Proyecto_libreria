const { createApp } = require('./app');
const { loadConfig } = require('./config');
const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Librería Quisqueya disponible en http://localhost:${config.port}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => {
    app.locals.closeSessions().catch(() => { process.exitCode = 1; });
}));
