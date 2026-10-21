const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const dotenv=require('dotenv');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const {createApp}=require('../server/app');
const {loadConfig}=require('../server/config');
const config=loadConfig(dotenv.parse(fs.readFileSync('server/.env.local')));
const demo=dotenv.parse(fs.readFileSync('scripts/.env.demo'));
const headers={'Content-Type':'application/json','X-Libreria-Request':'1'};
const password=randomBytes(24).toString('base64url');
let isbnCounter=Date.now();
function localOnly(){assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(config.url),'Estas pruebas requieren la pila local.');}
async function start(fetchImpl){const app=createApp({config,fetchImpl});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return {app,server,url:'http://127.0.0.1:'+server.address().port};}
async function close(instance){await new Promise(r=>instance.server.close(r));await instance.app.locals.closeSessions();}
async function request(instance,path,method='GET',body,cookie=''){
    const response=await fetch(instance.url+path,{method,headers:{...headers,Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();return {response,data,status:response.status};
}
async function login(instance,email,pass=demo.DEMO_PASSWORD){const result=await request(instance,'/api/auth/login','POST',{email,password:pass});assert.equal(result.status,200,result.data.error);return {cookie:result.response.headers.get('set-cookie').split(';')[0],data:result.data};}
const product=(name,stock=0)=>({p_isbn:String(++isbnCounter),p_titulo:name,p_autor:'Autor ficticio',p_categoria:'Integración Express',p_editorial:'Editorial de pruebas',p_descripcion:'Datos locales ficticios',p_precio:100,p_descuento_pct:10,p_formato:'fisico',p_idioma:'Español',p_imagen_portada:null,p_stock_inicial:stock,p_stock_minimo:0,p_activo:true});

test('rutas Express con Auth, PostgreSQL y Auth Admin reales, sin bright-action',async t=>{
    localOnly();const instance=await start();t.after(()=>close(instance));
    const admin=await login(instance,'admin@demo.local'),employee=await login(instance,'empleado@demo.local');
    let customer,customerId,book,order;const stamp=Date.now();
    await t.test('login y sesiones tienen rol verificado y no entregan tokens',async()=>{
        assert.equal(employee.data.role,'empleado');assert.doesNotMatch(JSON.stringify(employee.data),/access_token|refresh_token/);
        const inactive=await request(instance,'/api/auth/login','POST',{email:'inactivo@demo.local',password:demo.DEMO_PASSWORD});assert.equal(inactive.status,403);
        const session=await request(instance,'/api/auth/session','GET',undefined,employee.cookie);assert.equal(session.data.profile.activo,true);
    });
    await t.test('crear, listar, editar y eliminar usuarios mediante Express y Auth Admin',async()=>{
        const account={correo:`express-${stamp}@demo.local`,password,nombres:'Cliente',apellidos:'Ficticio',rol:'cliente',activo:true};
        const create=await request(instance,'/api/usuarios','POST',account,admin.cookie);assert.equal(create.status,201,create.data.error);customerId=create.data.id;
        customer=await login(instance,account.correo,password);
        const list=await request(instance,'/api/usuarios','GET',undefined,admin.cookie);assert.ok(list.data.some(user=>user.id===customerId));
        const edit=await request(instance,'/api/usuarios/'+customerId,'PUT',{p_nombres:'Editado',p_apellidos:'Ficticio',p_activo:true,p_rol:'cliente'},admin.cookie);assert.equal(edit.status,200,edit.data?.error);
        const disposable=await request(instance,'/api/usuarios','POST',{...account,correo:`disposable-${stamp}@demo.local`},admin.cookie);assert.equal(disposable.status,201);
        const removed=await request(instance,'/api/usuarios/'+disposable.data.id,'DELETE',undefined,admin.cookie);assert.equal(removed.status,200,removed.data.error);
    });
    await t.test('CRUD de categorías y productos se ejecuta por REST Express',async()=>{
        const category=await request(instance,'/api/categorias','POST',{p_nombre:'Categoría Express '+stamp,p_activo:true},admin.cookie);assert.equal(category.status,201,category.data?.error);
        assert.equal((await request(instance,'/api/categorias/'+category.data,'PUT',{p_nombre:'Editada '+stamp,p_activo:true},admin.cookie)).status,200);
        const categories=await request(instance,'/api/categorias','GET',undefined,employee.cookie);assert.ok(categories.data.some(c=>c.id===category.data));
        assert.equal((await request(instance,'/api/categorias/'+category.data,'DELETE',undefined,admin.cookie)).status,200);
        const create=await request(instance,'/api/productos','POST',product('Libro Express '+stamp,10),admin.cookie);assert.equal(create.status,201,create.data?.error);book=create.data;
        assert.equal((await request(instance,'/api/productos/'+book,'PUT',product('Libro Express editado '+stamp),admin.cookie)).status,200);
        const books=await request(instance,'/api/productos','GET',undefined,employee.cookie);assert.ok(books.data.some(item=>item.id===book));
        const empty=await request(instance,'/api/productos','POST',product('Producto sin historial '+stamp),admin.cookie);assert.equal(empty.status,201);
        const deleted=await request(instance,'/api/productos/'+empty.data,'DELETE',undefined,admin.cookie);assert.equal(deleted.data.eliminado,true);
    });
    await t.test('inventario de empleado autorizado; cliente y empleado no escalan permisos',async()=>{
        const body={p_producto_id:book,p_tipo:'entrada',p_cantidad:2,p_motivo:'Prueba Express local'};
        assert.equal((await request(instance,'/api/inventario/ajustes','POST',body,employee.cookie)).status,201);
        assert.equal((await request(instance,'/api/inventario/ajustes','POST',body,customer.cookie)).status,403);
        for(const cookie of [employee.cookie,customer.cookie]){
            assert.equal((await request(instance,'/api/productos','POST',product('Intento bloqueado'),cookie)).status,403);
            assert.equal((await request(instance,'/api/usuarios','GET',undefined,cookie)).status,403);
        }
        const moves=await request(instance,'/api/inventario','GET',undefined,employee.cookie);assert.ok(moves.data.some(m=>m.producto==='Libro Express editado '+stamp));
    });
    await t.test('configuración, contacto y mensajes conservan datos y permisos por Express',async()=>{
        const before=await request(instance,'/api/configuracion','GET',undefined,admin.cookie);assert.equal(before.status,200);
        const saved=await request(instance,'/api/configuracion','PUT',{p_datos:before.data},admin.cookie);assert.equal(saved.status,200,saved.data?.error);
        assert.equal(Number(saved.data.cotizacion_itbis_pct),Number(before.data.cotizacion_itbis_pct));
        const contact=await request(instance,'/api/contacto','POST',{p_nombre:'Prueba pública',p_correo:'publico@example.test',p_telefono:null,p_asunto:'Verificación Express',p_mensaje:'Mensaje ficticio de integración local.'});assert.equal(contact.status,201,contact.data?.error);
        const messages=await request(instance,'/api/mensajes','GET',undefined,admin.cookie);assert.ok(messages.data.some(message=>message.id===contact.data));
        const owned=await request(instance,'/api/contacto','POST',{p_nombre:'Cliente ficticio',p_correo:customer.data.user.email,p_telefono:null,p_asunto:'Contacto con cuenta',p_mensaje:'Mensaje asociado a su usuario autenticado.'},customer.cookie);assert.equal(owned.status,201);
        const updated=await request(instance,'/api/mensajes','GET',undefined,admin.cookie);assert.equal(updated.data.find(message=>message.id===owned.data).user_id,customerId);
        assert.equal((await request(instance,'/api/mensajes/'+contact.data,'PATCH',{estado:'leido'},admin.cookie)).status,200);
        assert.equal((await request(instance,'/api/mensajes','GET',undefined,employee.cookie)).status,403);
    });
    await t.test('carrito, checkout, integridad de precios y cotización por Express',async()=>{
        const taxes=await request(instance,'/api/catalogo/impuestos','GET',undefined,customer.cookie);assert.equal(taxes.status,200,taxes.data.error);
        assert.equal((await request(instance,'/api/carrito/items/'+book,'PUT',{cantidad:2},customer.cookie)).status,200);
        const cart=await request(instance,'/api/carrito','GET',undefined,customer.cookie);assert.equal(cart.data.items[0].cantidad,2);
        const branches=await request(instance,'/api/sucursales','GET',undefined,customer.cookie);assert.equal(branches.status,200);
        const args={p_metodo_entrega:'retiro',p_metodo_pago:'efectivo',p_sucursal_id:branches.data[0].id};
        assert.equal((await request(instance,'/api/pedidos','POST',{...args,total:1},customer.cookie)).status,400);
        const checkout=await request(instance,'/api/pedidos','POST',args,customer.cookie);assert.equal(checkout.status,201,checkout.data.error);order=checkout.data.id;
        assert.equal((await request(instance,'/api/carrito','GET',undefined,customer.cookie)).data.items.length,0);
        const quote=await request(instance,'/api/mis-pedidos/'+order+'/cotizacion','GET',undefined,customer.cookie);assert.ok(quote.data.id);
        const document=await request(instance,'/api/documentos/cotizacion/'+quote.data.id,'GET',undefined,customer.cookie);assert.equal(document.status,200);
        const other=await login(instance,'otro@demo.local');assert.equal((await request(instance,'/api/documentos/cotizacion/'+quote.data.id,'GET',undefined,other.cookie)).status,404);
        const orders=await request(instance,'/api/pedidos','GET',undefined,employee.cookie);const saved=orders.data.find(p=>p.id===order);assert.equal(Number(saved.subtotal),200);assert.equal(Number(saved.descuento),20);
    });
    await t.test('personal procesa pedido y factura; historial impide borrar usuario',async()=>{
        assert.equal((await request(instance,`/api/pedidos/${order}/estado`,'PATCH',{p_estado:'procesando'},employee.cookie)).status,200);
        assert.equal((await request(instance,`/api/pedidos/${order}/pago`,'PATCH',{p_estado_pago:'pagado'},employee.cookie)).status,200);
        const invoice=await request(instance,`/api/pedidos/${order}/factura`,'POST',{},employee.cookie);assert.equal(invoice.status,201,invoice.data?.error);
        assert.equal((await request(instance,'/api/documentos/factura/'+invoice.data.id,'GET',undefined,customer.cookie)).status,200);
        assert.equal((await request(instance,'/api/usuarios/'+customerId,'DELETE',undefined,admin.cookie)).status,409);
        const archived=await request(instance,'/api/productos/'+book,'DELETE',undefined,admin.cookie);assert.equal(archived.data.desactivado,true);
        assert.equal((await request(instance,'/api/usuarios/'+customerId,'PUT',{p_nombres:'Prueba finalizada',p_apellidos:'Ficticio',p_activo:false,p_rol:'cliente'},admin.cookie)).status,200);
        assert.equal((await request(instance,'/api/auth/session','GET',undefined,customer.cookie)).data,null);
    });
});

test('renovación real de Supabase no revive logout ejecutado por otra instancia Express',async()=>{
    localOnly();let release,entered;const began=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);let refreshStatus;
    const delayed=async(url,options)=>{const response=await fetch(url,options);if(url.includes('grant_type=refresh_token')){refreshStatus=response.status;entered();await gate;}return response;};
    const a=await start(delayed),b=await start();const database=new Client({connectionString:config.databaseUrl});
    try{
        await database.connect();const signed=await login(a,'empleado@demo.local');
        const sid=decodeURIComponent(signed.cookie.slice('lq.sid='.length)).slice(2).split('.')[0];assert.ok(sid);
        await database.query("UPDATE public.application_sessions SET sess=jsonb_set(sess::jsonb,'{auth,expires_at}','1')::json WHERE sid=$1",[sid]);
        const pending=request(a,'/api/auth/session','GET',undefined,signed.cookie);await began;
        const logout=await request(b,'/api/auth/logout','POST',undefined,signed.cookie);assert.equal(logout.status,200);
        release();assert.equal((await pending).data,null);assert.equal(refreshStatus,200);
        for(const instance of [a,b])assert.equal((await request(instance,'/api/auth/session','GET',undefined,signed.cookie)).data,null);
    }finally{release();await database.end();await close(a);await close(b);}
});
