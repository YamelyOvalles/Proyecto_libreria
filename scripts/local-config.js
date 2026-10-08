const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validPublicConfig } = require('../server/public-config');
// No enlaza ni reinicia proyectos remotos. Lee exclusivamente la pila CLI local.
const result = spawnSync(process.execPath, [path.resolve('node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error('Inicia primero Supabase local: npx supabase start.');
const status = JSON.parse(result.stdout);
const config = { url: status.API_URL, anonKey: status.ANON_KEY };
if (!validPublicConfig(config) || !/^http:\/\/127\.0\.0\.1:/.test(config.url) || !status.SERVICE_ROLE_KEY) {
    throw new Error('La CLI no devolvió una configuración local válida.');
}
// Protege server/.env existente: escribe archivos alternativos, ignorados.
const publicEnv = `SUPABASE_URL=${config.url}\nSUPABASE_ANON_KEY=${config.anonKey}\nPORT=3000\n`;
const adminEnv = publicEnv + `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\n`;
for (const [file, content] of [['server/.env.local', publicEnv], ['scripts/.env.demo', adminEnv]]) {
    if (fs.existsSync(file)) throw new Error(`${file} ya existe; consérvalo o elimínalo explícitamente antes de regenerar.`);
}
fs.writeFileSync('server/.env.local', publicEnv, { mode: 0o600 });
fs.writeFileSync('scripts/.env.demo', adminEnv, { mode: 0o600 });
console.log('Configuración local creada sin sobrescribir server/.env. No se muestran claves.');
