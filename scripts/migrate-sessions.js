const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const local = process.argv.includes('--local');
dotenv.config({ path: path.join(__dirname, '..', 'server', local ? '.env.local' : '.env'), quiet: true });
async function main() {
    const connectionString = process.env.SESSION_DATABASE_URL;
    if (!connectionString) throw new Error('Configura SESSION_DATABASE_URL en el archivo privado del servidor.');
    if (local && !['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname)) throw new Error('Se requiere PostgreSQL local.');
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const directory = path.join(__dirname, '..', 'database/migrations');
        for (const name of fs.readdirSync(directory).filter(name => /^\d+_.*\.sql$/.test(name)).sort())
            await client.query(fs.readFileSync(path.join(directory, name), 'utf8'));
        console.log('Migración aditiva de sesiones aplicada.');
    } finally { await client.end(); }
}
main().catch(() => { console.error('No se pudo aplicar la migración. Revisa SESSION_DATABASE_URL y los permisos del propietario; no se muestran datos privados.'); process.exitCode = 1; });
