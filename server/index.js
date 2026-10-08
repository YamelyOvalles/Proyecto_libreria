const { createApp } = require('./app');
const { loadConfig } = require('./config');
const config = loadConfig();
const server = createApp({ config }).listen(config.port, '0.0.0.0', () => {
    console.log(`Librería Quisqueya disponible en http://localhost:${config.port}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
