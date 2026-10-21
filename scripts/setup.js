const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
function cli(args) {
    return spawnSync(process.execPath, [path.resolve('node_modules/supabase/dist/supabase.js'), ...args], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
}
function appendMissing(file, values) {
    const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const present = dotenv.parse(original);
    const missing = Object.entries(values).filter(([key]) => !present[key]);
    if (missing.length) fs.appendFileSync(file, (original.endsWith('\n') || !original ? '' : '\n') + missing.map(([key,value]) => `${key}=${value}\n`).join(''), { mode: 0o600 });
}
function setupLocal() {
    let status = cli(['status', '-o', 'json']);
    if (status.status !== 0) {
        console.log('Iniciando Supabase local con Docker; la primera descarga puede tardar.');
        if (cli(['start']).status !== 0) throw new Error('No se pudo iniciar Supabase. Comprueba Docker Desktop.');
        status = cli(['status', '-o', 'json']);
    }
    if (status.status !== 0) throw new Error('Supabase local no responde.');
    const local = JSON.parse(status.stdout);
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(local.API_URL || '') || !['localhost','127.0.0.1'].includes(new URL(local.DB_URL).hostname)) throw new Error('La CLI no devolvió una pila local válida.');
    const file = 'server/.env.local';
    const current = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
    if (current.SUPABASE_URL && current.SUPABASE_URL !== local.API_URL) throw new Error('La configuración existente corresponde a otro destino; no se sobrescribió.');
    const common = { SUPABASE_URL: local.API_URL, SUPABASE_ANON_KEY: local.ANON_KEY };
    appendMissing(file, { ...common, PORT: 3000, SESSION_SECRET: randomBytes(48).toString('base64url'),
        SESSION_DATABASE_URL: local.DB_URL, SUPABASE_AUTH_ADMIN_KEY: local.SERVICE_ROLE_KEY });
    appendMissing('scripts/.env.demo', { ...common, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
        DEMO_PASSWORD: randomBytes(24).toString('base64url') });
    const migration = spawnSync(process.execPath, ['scripts/migrate-sessions.js','--local'], { stdio: 'inherit', windowsHide: true });
    if (migration.status !== 0) throw new Error('No se pudo preparar el almacén de sesiones.');
    const seed = spawnSync(process.execPath, ['scripts/seed-demo.js'], { stdio: 'inherit', windowsHide: true });
    if (seed.status !== 0) throw new Error('No se pudieron preparar los datos demo locales.');
    console.log('Entorno local preparado. Los valores privados permanecen en archivos ignorados por Git.');
}
function main() {
    if (process.argv.includes('--remote')) {
        const target = 'server/.env.remote';
        if (!fs.existsSync(target)) fs.copyFileSync('server/.env.example', target, fs.constants.COPYFILE_EXCL);
        console.log('Completa server/.env.remote con el proyecto demo autorizado, conexión de sesiones y clave privada de Auth. No se creó ni modificó ningún proyecto remoto.');
        return;
    }
    setupLocal();
}
if (require.main === module) { try { main(); } catch(error) { console.error(error.message); process.exitCode=1; } }
module.exports={appendMissing,setupLocal,localStatus:()=>cli(['status','-o','json']).status===0};
