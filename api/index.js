const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
module.exports = createApp({ config: loadConfig() });
