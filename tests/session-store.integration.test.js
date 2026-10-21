const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const { createApp } = require('../server/app');
const { PostgresSessionStore } = require('../server/services/session-store');

test('PostgreSQL local conserva sesión entre instancias Express y logout invalida ambas', async () => {
    // Solo pila CLI local: no lee ni modifica bases remotas. Aplica migración aditiva.
    const status = spawnSync(process.execPath, [path.resolve('node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'], { encoding: 'utf8' });
    assert.equal(status.status, 0, 'Inicia Supabase local antes de esta prueba.');
    const local = JSON.parse(status.stdout);
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(local.DB_URL).hostname));
    const database = new Client({ connectionString: local.DB_URL });
    await database.connect();
    try { for (const name of fs.readdirSync('database/migrations').filter(name=>name.endsWith('.sql')).sort()) await database.query(fs.readFileSync('database/migrations/'+name, 'utf8')); }
    finally { await database.end(); }
    const config = { url: local.API_URL, anonKey: local.ANON_KEY,
        databaseUrl: local.DB_URL, sessionSecret: randomBytes(48).toString('hex') };
    // Auth simulado, almacén PostgreSQL real. Las pruebas de Supabase cubren Auth real.
    const gateway = { getUser: async () => ({ id: 'session-store-test' }), getProfile: async () => ({ activo: true }), getRole: async () => 'cliente' };
    const fetchImpl = async () => Response.json({ access_token: 'private-test', refresh_token: 'private-refresh',
        expires_at: Math.floor(Date.now()/1000)+3600, user: { id: 'session-store-test' } });
    const instances = [];
    async function start(production = false) {
        const app = createApp({ config: { ...config, production }, gateway, fetchImpl });
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const instance = { app, server, base: `http://127.0.0.1:${server.address().port}` };
        instances.push(instance); return instance;
    }
    async function close(instance) {
        if (instance.server.listening) await new Promise(resolve => instance.server.close(resolve));
        await instance.app.locals.closeSessions();
    }
    try {
        const first = await start();
        const login = await fetch(first.base + '/api/auth/login', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1' },
            body: JSON.stringify({ email: 'fake@example.test', password: 'fictional-store-password' }) });
        assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie').split(';')[0]; await login.body.cancel();
        const sid = decodeURIComponent(cookie.slice('lq.sid='.length)).slice(2).split('.')[0];
        const staleStore = new PostgresSessionStore(local.DB_URL);
        const storeGet = id => new Promise((resolve,reject)=>staleStore.get(id,(error,value)=>error?reject(error):resolve(value)));
        const saved = await storeGet(sid); assert.ok(saved.auth);
        await close(first);
        const second = await start(); const third = await start();
        for (const instance of [second, third]) {
            const session = await fetch(instance.base + '/api/auth/session', { headers: { Cookie: cookie } });
            assert.equal((await session.json()).user.id, 'session-store-test');
        }
        const logout = await fetch(second.base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie, 'X-Libreria-Request': '1' } });
        assert.equal(logout.status, 200); await logout.body.cancel();
        const invalid = await fetch(third.base + '/api/auth/session', { headers: { Cookie: cookie } });
        assert.equal(await invalid.json(), null);
        try {
            await assert.rejects(new Promise((resolve,reject)=>staleStore.set(sid,saved,error=>error?reject(error):resolve())),error=>error.status===401);
            await new Promise((resolve,reject)=>staleStore.touch(sid,saved,error=>error?reject(error):resolve()));
            assert.equal(await storeGet(sid),null);
            const expiredId='expired-'+randomBytes(12).toString('hex');
            await new Promise((resolve,reject)=>staleStore.set(expiredId,{cookie:{expires:new Date(Date.now()-1000)},auth:{user:{id:'expired'}}},error=>error?reject(error):resolve()));
            assert.equal(await storeGet(expiredId),null);
        } finally { await staleStore.close(); }
        const secure = await start(true);
        const http = await fetch(secure.base+'/api/auth/session'); assert.equal(http.status,426); await http.body.cancel();
        const https = await fetch(secure.base+'/api/auth/login',{method:'POST',headers:{'X-Forwarded-Proto':'https','X-Libreria-Request':'1','Content-Type':'application/json'},body:JSON.stringify({email:'fake@example.test',password:'fictional-store-password'})});
        assert.equal(https.status,200); assert.match(https.headers.get('set-cookie'),/; Secure;/); await https.body.cancel();
    } finally { for (const instance of instances) await close(instance); }
});
