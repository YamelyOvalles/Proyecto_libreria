const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { loadConfig } = require('../server/config');
const { preflight } = require('./preflight');
const { setupLocal, localStatus } = require('./setup');
async function main() {
    const remote = process.argv.includes('--remote');
    const selected = process.env.LIBRERIA_ENV_FILE || (remote ? '.env.remote' : fs.existsSync('server/.env.local') ? '.env.local' : fs.existsSync('server/.env') ? '.env' : '.env.local');
    if (!remote && selected === '.env.local') {
        const current=fs.existsSync('server/.env.local')?require('dotenv').parse(fs.readFileSync('server/.env.local')):{};
        if (!current.SESSION_DATABASE_URL || !current.SUPABASE_AUTH_ADMIN_KEY || !current.SESSION_SECRET || !localStatus()) setupLocal();
    }
    process.env.LIBRERIA_ENV_FILE = selected;
    const config = loadConfig(); await preflight(config);
    console.log('Configuración y sesiones verificadas. Iniciando Express; no se necesita bright-action.');
    const child=spawn(process.execPath,['--watch','server/index.js'],{stdio:'inherit',env:process.env,windowsHide:true});
    for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>child.kill(signal));
    child.once('exit',code=>{process.exitCode=code||0;});
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
