const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
dotenv.config({ path: 'scripts/.env.demo', quiet: true });
const url = process.env.SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url || '')) {
    throw new Error('Los usuarios demo solo se pueden crear en Supabase local.');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta la clave administrativa LOCAL en scripts/.env.demo.');
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const password = 'DemoLocal-306!';
const demos = [
    ['admin@demo.local', 'administrador', 'Ana'],
    ['empleado@demo.local', 'empleado', 'Emilio'],
    ['cliente@demo.local', 'cliente', 'Clara'],
    ['otro@demo.local', 'cliente', 'Oscar'],
    ['inactivo@demo.local', 'cliente', 'Inés']
];
async function checked(operation) { const result = await operation; if (result.error) throw result.error; return result.data; }
async function main() {
    const roles = await checked(admin.from('roles').select('id,codigo'));
    const users = [];
    for (let page = 1; ; page++) {
        const data = await checked(admin.auth.admin.listUsers({ page, perPage: 100 }));
        users.push(...data.users);
        if (data.users.length < 100) break;
    }
    for (const [email, role, nombres] of demos) {
        let user = users.find(item => item.email === email);
        if (!user) user = (await checked(admin.auth.admin.createUser({ email, password, email_confirm: true,
            user_metadata: { nombres, apellidos: 'Demostración' } }))).user;
        else await checked(admin.auth.admin.updateUserById(user.id, { password, email_confirm: true }));
        const rol = roles.find(item => item.codigo === role);
        if (!rol) throw new Error('Ejecuta primero database/database.sql en la pila local.');
        await checked(admin.from('perfiles').upsert({ id: user.id, nombres, apellidos: 'Demostración', activo: email !== 'inactivo@demo.local' }));
        await checked(admin.from('usuario_roles').upsert({ usuario_id: user.id, rol_id: rol.id }));
    }
    // El historial ficticio se crea con las mismas RPC que la aplicación, no por INSERT privilegiado.
    const makeClient = () => createClient(url, process.env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const customer = makeClient();
    const staff = makeClient();
    try {
        const login = await checked(customer.auth.signInWithPassword({ email: 'cliente@demo.local', password }));
        await checked(staff.auth.signInWithPassword({ email: 'empleado@demo.local', password }));
        const branch = (await checked(customer.from('sucursales').select('id').eq('activo', true).order('id').limit(1)))[0];
        if (!branch) throw new Error('Falta una sucursal activa.');
        const fixtures = [
            ['pendiente', '9780451524935'], ['procesando', '9780156012195'], ['cancelado', '9788420412146']
        ];
        async function completeFixture(order, targetStatus) {
            if (order.estado === 'pendiente' && targetStatus !== 'pendiente') {
                await checked(staff.rpc('actualizar_estado_pedido', { p_pedido_id: order.id, p_estado: targetStatus }));
                order.estado = targetStatus;
            }
            if (targetStatus === 'procesando' && ['procesando', 'listo_retiro', 'enviado', 'entregado'].includes(order.estado)) {
                if (['pendiente', 'verificando'].includes(order.estado_pago)) {
                    await checked(staff.rpc('actualizar_pago_pedido', { p_pedido_id: order.id, p_estado_pago: 'pagado' }));
                }
                await checked(staff.rpc('generar_factura_pedido', { p_pedido_id: order.id }));
            }
        }
        for (const [status, isbn] of fixtures) {
            const note = `DEMO_FASE4_${status}`;
            const existing = await checked(admin.from('pedidos').select('id,estado,estado_pago').eq('notas', note).limit(1));
            if (existing.length) {
                await completeFixture(existing[0], status);
                continue;
            }
            const book = await checked(customer.from('libros').select('id').eq('isbn', isbn).single());
            const cart = await checked(customer.from('carritos').upsert({ perfil_id: login.user.id }, { onConflict: 'perfil_id' }).select('id').single());
            const lines = await checked(customer.from('carrito_detalles').select('libro_id').eq('carrito_id', cart.id));
            if (lines.length) throw new Error('Conserva o confirma el carrito demo existente antes de volver a cargar ejemplos.');
            await checked(customer.from('carrito_detalles').insert({ carrito_id: cart.id, libro_id: book.id, cantidad: 1 }));
            const order = await checked(customer.rpc('crear_pedido_desde_carrito', {
                p_metodo_entrega: 'retiro', p_metodo_pago: 'efectivo', p_sucursal_id: branch.id,
                p_direccion: null, p_notas: note
            }));
            await completeFixture({ ...order, estado: 'pendiente', estado_pago: 'pendiente' }, status);
        }
        const messages = await checked(admin.from('contact_messages').select('id').eq('asunto', 'Demostración Fase 4').limit(1));
        if (!messages.length) await checked(customer.rpc('enviar_mensaje_contacto', {
            p_nombre: 'Clara Demostración', p_correo: 'cliente@demo.local', p_asunto: 'Demostración Fase 4',
            p_mensaje: 'Mensaje ficticio: deseo consultar la disponibilidad de un libro para recoger en sucursal.'
        }));
    } finally {
        await customer.auth.signOut({ scope: 'local' });
        await staff.auth.signOut({ scope: 'local' });
    }
    console.log('Cinco cuentas y ejemplos comerciales locales preparados. Credenciales en README.');
}
main().catch(error => {
    // Los mensajes de negocio P0001 no incluyen claves; evita imprimir objetos de petición/Auth.
    console.error('Falló la creación de demos. Comprueba la pila local, esquema, configuración y que el carrito demo esté vacío.');
    if (error.code === 'P0001') console.error(error.message);
    process.exitCode = 1;
});
