const { createClient } = require('@supabase/supabase-js');
const { HttpError } = require('../middleware/errors');
function createBusinessService(config, applicationAuth) {
    async function data(path, identity, method = 'GET', body, headers = {}) {
        const response = await applicationAuth.upstream('/rest/v1/' + path, identity?.token, method,
            body === undefined ? undefined : JSON.stringify(body), { 'Content-Type': 'application/json', ...headers });
        const value = await response.json().catch(() => null);
        if (!response.ok) throw new HttpError(response.status === 401 ? 401 : response.status === 403 ? 403 : response.status >= 500 ? 502 : 400,
            value?.code === 'P0001' ? value.message : 'La base de datos rechazó la operación.');
        return value;
    }
    const rpc = (name, identity, args = {}) => data('rpc/' + name, identity, 'POST', args);
    function adminAuth() {
        if (!config.authAdminKey) throw new HttpError(503, 'Configura SUPABASE_AUTH_ADMIN_KEY en el servidor para administrar cuentas de Auth.');
        // Esta clave se usa SOLO en Auth Admin. Todas las consultas SQL usan identity.token y RLS.
        return createClient(config.url, config.authAdminKey, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
    }
    async function createUser(identity, body) {
        const admin = adminAuth();
        const result = await admin.createUser({ email: body.correo, password: body.password, email_confirm: true,
            user_metadata: { nombres: body.nombres, apellidos: body.apellidos } });
        if (result.error || !result.data.user) throw new HttpError(400, 'No se pudo crear la cuenta. Comprueba el correo y la contraseña.');
        const id = result.data.user.id;
        try {
            await rpc('actualizar_usuario_admin', identity, { p_usuario_id: id, p_nombres: body.nombres,
                p_apellidos: body.apellidos, p_activo: body.activo, p_rol: body.rol });
        } catch (error) {
            const rollback = await admin.deleteUser(id);
            if (rollback.error) throw new HttpError(502, 'La cuenta se creó parcialmente. Un administrador debe revisar su perfil en Auth.');
            throw error;
        }
        return { id };
    }
    async function deleteUser(identity, id) {
        if (identity.user.id === id) throw new HttpError(400, 'No puedes eliminar tu propia cuenta.');
        for (const table of ['pedidos', 'cotizaciones', 'facturas']) {
            if ((await data(`${table}?select=id&cliente_id=eq.${encodeURIComponent(id)}&limit=1`, identity))?.length)
                throw new HttpError(409, 'La cuenta tiene historial comercial. Desactívala para conservarlo.');
        }
        const result = await adminAuth().deleteUser(id);
        if (result.error) throw new HttpError(400, 'No se pudo eliminar la cuenta de Auth.');
        return { id, eliminado: true };
    }
    return { data, rpc, createUser, deleteUser };
}
module.exports = { createBusinessService };
