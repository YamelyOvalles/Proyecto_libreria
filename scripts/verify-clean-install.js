const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(workspace, '.tmp'), { recursive: true });
const target = fs.mkdtempSync(path.join(workspace, '.tmp', 'install-'));
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Ejecuta mediante npm run verify:install.');
for (const name of ['package.json', 'package-lock.json', 'playwright.config.js', 'playwright.local.config.js',
    'server', 'api', 'js', 'css', 'assets', 'database', 'supabase', 'scripts', 'tests']) {
    fs.cpSync(path.join(workspace, name), path.join(target, name), { recursive: true, filter: file => {
        const base = path.basename(file);
        return !base.startsWith('.env') && base !== 'node_modules' && base !== '.temp' && base !== 'supabase-config.js';
    } });
}
// api/supabase-config.js es código público; js/supabase-config.js ignorado no se copia.
fs.copyFileSync(path.join(workspace, 'api/supabase-config.js'), path.join(target, 'api/supabase-config.js'));
for (const file of fs.readdirSync(workspace).filter(file => file.endsWith('.html'))) fs.copyFileSync(path.join(workspace, file), path.join(target, file));
console.log('Instalación aislada creada sin archivos .env ni secretos locales.');
for (const args of [['ci', '--no-audit', '--no-fund'], ['run', 'check'], ['test']]) {
    const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: target, stdio: 'inherit' });
    if (result.status !== 0) { process.exitCode = 1; break; }
}
if (process.exitCode || process.argv.includes('--keep')) {
    console.log(`Copia conservada para inspección: ${path.relative(workspace, target)}`);
} else {
    fs.rmSync(target, { recursive: true });
    console.log('Verificación completada; copia temporal eliminada.');
}
