const { Client } = require('pg');
async function preflight(config) {
    if (!config.sessionSecret || !config.databaseUrl) throw new Error('Configura SESSION_SECRET y SESSION_DATABASE_URL; para Docker ejecuta npm run setup -- --local.');
    if (!config.authAdminKey) throw new Error('Configura SUPABASE_AUTH_ADMIN_KEY privada para crear y eliminar cuentas desde Express.');
    const health = await fetch(config.url + '/auth/v1/health', { headers: { apikey: config.anonKey }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!health?.ok) throw new Error('Supabase Auth no responde. Comprueba el destino y la conectividad.');
    await health.body?.cancel();
    const admin = await fetch(config.url+'/auth/v1/admin/users?page=1&per_page=1',{
        headers:{apikey:config.authAdminKey,Authorization:'Bearer '+config.authAdminKey},signal:AbortSignal.timeout(8000)
    }).catch(()=>null);
    if (!admin?.ok) throw new Error('La clave privada de Auth Admin no es válida o el proveedor no responde.');
    await admin.body?.cancel();
    const database = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000 });
    try { await database.connect(); await database.query('SELECT sid,revoked_at FROM public.application_sessions LIMIT 0'); }
    catch { throw new Error('El almacén de sesiones no está listo. Comprueba la conexión y ejecuta sessions:migrate contra el destino seleccionado.'); }
    finally { await database.end(); }
}
module.exports={preflight};
