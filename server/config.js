const path = require('node:path');
const dotenv = require('dotenv');
const { validPublicConfig } = require('./public-config');
function loadConfig(env = process.env) {
    if (env === process.env) dotenv.config({ path: path.join(__dirname,
        env.LIBRERIA_ENV_FILE === '.env.local' ? '.env.local' : '.env'), quiet: true });
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
    const config = { port, url: env.SUPABASE_URL || '', anonKey: env.SUPABASE_ANON_KEY || '' };
    if (!validPublicConfig(config)) throw new Error('Configura SUPABASE_URL y una clave pública en server/.env (ver README).');
    return Object.freeze(config);
}
module.exports = { loadConfig };
