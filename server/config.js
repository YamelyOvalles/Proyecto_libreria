const path = require('node:path');
const dotenv = require('dotenv');
const { validPublicConfig } = require('./public-config');
function loadConfig(env = process.env) {
    if (env === process.env) dotenv.config({ path: path.join(__dirname,
        ['.env.local','.env.remote'].includes(env.LIBRERIA_ENV_FILE) ? env.LIBRERIA_ENV_FILE : '.env'), quiet: true });
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
    const config = { port, url: env.SUPABASE_URL || '', anonKey: env.SUPABASE_ANON_KEY || '',
        production: env.NODE_ENV === 'production' || Boolean(env.VERCEL),
        sessionSecret: env.SESSION_SECRET, databaseUrl: env.SESSION_DATABASE_URL,
        authAdminKey: env.SUPABASE_AUTH_ADMIN_KEY };
    if (!validPublicConfig(config)) throw new Error('Configura SUPABASE_URL y una clave pública en server/.env (ver README).');
    if (config.sessionSecret && /^(REEMPLAZAR|GENERAR|TU_|CHANGE)/i.test(config.sessionSecret)) throw new Error('Genera un SESSION_SECRET privado; no uses el marcador del ejemplo.');
    if (config.databaseUrl && config.production) {
        const database = new URL(config.databaseUrl);
        if (!['localhost','127.0.0.1'].includes(database.hostname) && database.searchParams.get('sslmode') !== 'verify-full') throw new Error('La conexión de sesiones remota requiere sslmode=verify-full.');
    }
    return Object.freeze(config);
}
module.exports = { loadConfig };
