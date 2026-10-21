const v = require('../middleware/validation');
const { HttpError } = require('../middleware/errors');
const productFields = ['p_producto_id','p_isbn','p_titulo','p_autor','p_categoria','p_editorial','p_descripcion','p_precio','p_descuento_pct','p_formato','p_idioma','p_imagen_portada','p_stock_inicial','p_stock_minimo','p_activo'];
function product(body, id) {
    v.fields(body, productFields);
    for (const [key,max] of Object.entries({p_titulo:250,p_autor:180,p_categoria:120,p_editorial:10000,p_idioma:10})) v.text(body[key], key, max, key === 'p_titulo');
    const isbn = v.text(body.p_isbn, 'ISBN', 13);
    if (!/^([0-9]{13}|[0-9]{9}[0-9X])$/.test(isbn)) throw new HttpError(400, 'El ISBN debe tener 13 dígitos o 10 caracteres válidos.');
    v.text(body.p_descripcion, 'Descripción', 10000, false);
    if (!['fisico','digital'].includes(body.p_formato)) throw new HttpError(400, 'Formato inválido.');
    v.number(body.p_precio, 'Precio', {max:9999999999.99}); v.number(body.p_descuento_pct, 'Descuento', { max: 100 });
    v.number(body.p_stock_inicial, 'Stock', { integer: true,max:2147483647 }); v.number(body.p_stock_minimo, 'Stock mínimo', { integer: true,max:2147483647 });
    v.boolean(body.p_activo, 'Activo');
    const image = v.text(body.p_imagen_portada, 'Portada', 2000, false);
    if (image && !/^(https?:\/\/|assets\/)/.test(image)) throw new HttpError(400, 'URL de portada inválida.');
    return { ...body, p_producto_id: id || null };
}
function user(body, create = false) {
    v.fields(body, create ? ['nombres','apellidos','rol','activo','correo','password'] : ['p_usuario_id','p_nombres','p_apellidos','p_rol','p_activo']);
    const prefix = create ? '' : 'p_';
    v.text(body[prefix+'nombres'], 'Nombre', 100); v.text(body[prefix+'apellidos'], 'Apellidos', 100, false);
    v.boolean(body[prefix+'activo'], 'Activo');
    if (!['cliente','empleado','administrador'].includes(body[prefix+'rol'])) throw new HttpError(400, 'Rol inválido.');
    if (create) v.credentials({ email: body.correo, password: body.password });
    return body;
}
function createBusinessController(service) {
    return {
        listProducts: async (req, res) => res.json(await service.data('libros?select=*,inventarios(cantidad_existencia,cantidad_reservada,cantidad_disponible),libro_autor(autores(nombre))&order=titulo', req.identity)),
        saveProduct: async (req, res) => res.status(req.params.id ? 200 : 201).json(await service.rpc('guardar_producto_admin', req.identity, product(req.body, req.params.id ? v.id(req.params.id) : null))),
        deleteProduct: async (req, res) => { const id=v.id(req.params.id); const result=await service.rpc('eliminar_producto_admin', req.identity, {p_producto_id:id}); res.json({id,resultado:result,eliminado:result==='eliminado',desactivado:result==='desactivado'}); },
        listCategories: async (req,res) => res.json(await service.data('categorias?select=id,nombre,activo,creado_en&order=nombre',req.identity)),
        saveCategory: async (req,res) => { v.fields(req.body,['p_categoria_id','p_nombre','p_activo']); v.text(req.body.p_nombre,'Nombre',120); v.boolean(req.body.p_activo,'Activo'); res.status(req.params.id?200:201).json(await service.rpc('guardar_categoria_admin',req.identity,{...req.body,p_categoria_id:req.params.id?v.id(req.params.id):null})); },
        deleteCategory: async (req,res) => res.json(await service.rpc('eliminar_categoria_admin',req.identity,{p_categoria_id:v.id(req.params.id)})),
        listUsers: async (req,res) => res.json(await service.rpc('listar_usuarios_admin',req.identity)),
        createUser: async (req,res) => res.status(201).json(await service.createUser(req.identity,user(req.body,true))),
        updateUser: async (req,res) => { user(req.body); res.json(await service.rpc('actualizar_usuario_admin',req.identity,{...req.body,p_usuario_id:v.uuid(req.params.id)})); },
        deleteUser: async (req,res) => res.json(await service.deleteUser(req.identity,v.uuid(req.params.id))),
        inventory: async (req,res) => res.json(await service.rpc('listar_movimientos_inventario',req.identity,{p_limite:40})),
        adjust: async (req,res) => {
            const b=v.fields(req.body,['p_producto_id','p_tipo','p_cantidad','p_motivo']); v.id(b.p_producto_id);
            if(!['entrada','salida','ajuste'].includes(b.p_tipo)) throw new HttpError(400,'Tipo de movimiento inválido.');
            v.number(b.p_cantidad,'Cantidad',{min:b.p_tipo==='ajuste'?0:1,max:2147483647,integer:true}); v.text(b.p_motivo,'Motivo',500);
            res.status(201).json(await service.rpc('ajustar_inventario_admin',req.identity,b));
        },
        orders: async (req,res) => res.json(await service.data('pedidos?select=*,pedido_detalles(*),pedido_direcciones_entrega(*)&order=creado_en.desc',req.identity)),
        documents: table => async(req,res) => res.json(await service.data(table+'?select=*',req.identity)),
        orderState: field => async(req,res) => {
            const key=field==='estado'?'p_estado':'p_estado_pago'; v.fields(req.body,['p_pedido_id',key]);
            const allowed=field==='estado'?['pendiente','confirmado','procesando','listo_retiro','enviado','entregado','cancelado','devuelto']:['pendiente','verificando','pagado','rechazado','reembolsado'];
            if(!allowed.includes(req.body[key])) throw new HttpError(400,'Estado inválido.');
            res.json(await service.rpc(field==='estado'?'actualizar_estado_pedido':'actualizar_pago_pedido',req.identity,{p_pedido_id:v.uuid(req.params.id),[key]:req.body[key]}));
        },
        invoice: async(req,res) => {
            const body=v.fields(req.body||{},['p_pedido_id','p_ncf','p_condicion_pago','p_fecha_vencimiento','p_notas']);
            v.text(body.p_ncf,'NCF',50,false); v.text(body.p_condicion_pago,'Condición',100,false); v.text(body.p_notas,'Notas',2000,false);
            if(body.p_fecha_vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(body.p_fecha_vencimiento)) throw new HttpError(400,'Fecha inválida.');
            res.status(201).json(await service.rpc('generar_factura_pedido',req.identity,{...body,p_pedido_id:v.uuid(req.params.id)}));
        },
        configuration: async(req,res) => res.json((await service.data('configuracion_negocio?select=*&id=eq.1',req.identity))?.[0]||null),
        saveConfiguration: async(req,res) => { v.fields(req.body,['p_datos']); v.object(req.body.p_datos); res.json(await service.rpc('guardar_configuracion_negocio',req.identity,req.body)); },
        messages: async(req,res) => res.json(await service.data('contact_messages?select=*&order=created_at.desc',req.identity)),
        messageState: async(req,res) => { v.fields(req.body,['estado']); if(!['pendiente','leido','respondido','archivado'].includes(req.body.estado)) throw new HttpError(400,'Estado inválido.'); res.json(await service.data('contact_messages?id=eq.'+v.uuid(req.params.id),req.identity,'PATCH',req.body,{Prefer:'return=representation'})); }
    };
}
module.exports={createBusinessController};
