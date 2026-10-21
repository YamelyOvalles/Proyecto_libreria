const { test, before, after }=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server/app');
const {createAuthenticationService}=require('../server/services/authentication');
test('errores de autenticación explican el rechazo sin exponer respuestas privadas del proveedor',async()=>{
    const cases=[
        [400,{error_code:'invalid_credentials'},400,/correo o la contraseña/],
        [403,{code:'email_not_confirmed'},403,/Confirma tu correo/],
        [429,{code:'over_request_rate_limit'},429,/Demasiados intentos/],
        [500,{code:'invalid_credentials'},502,/no está disponible/],
        [400,{code:'unknown'},400,/No se pudo completar/],
        [502,null,502,/no está disponible/]
    ];
    for(const [status,payload,expected,message]of cases){
        const service=createAuthenticationService({upstream:async()=>payload===null?
            new Response('private-provider-detail',{status}):Response.json({...payload,message:'private-provider-detail'},{status})},{});
        await assert.rejects(service.request('token?grant_type=password',{}),error=>{
            assert.equal(error.status,expected);assert.match(error.message,message);
            assert.doesNotMatch(error.message,/private-provider-detail/);return true;
        });
    }
});
const config={url:'http://127.0.0.1:54321',anonKey:'sb_publishable_test'};
const ids={cliente:'00000000-0000-4000-8000-000000000001',empleado:'00000000-0000-4000-8000-000000000002',administrador:'00000000-0000-4000-8000-000000000003'};
let server,base,calls=[],refreshStarted,releaseRefresh,expiry=false;
const gateway={getUser:async token=>({id:ids[token],email:token+'@example.test'}),getProfile:async()=>({activo:true,nombres:'Prueba'}),getRole:async token=>token};
async function provider(url,options){
    calls.push({url,options});
    if(url.includes('grant_type=refresh_token')){
        refreshStarted?.(); if(releaseRefresh) await new Promise(resolve=>releaseRefresh.resolve=resolve);
        return Response.json({access_token:'empleado',refresh_token:'private-new',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:ids.empleado}});
    }
    if(url.includes('/auth/v1/token')){
        const role=JSON.parse(options.body).email.split('@')[0];
        return Response.json({access_token:role,refresh_token:'private-provider-token',expires_at:expiry?1:Math.floor(Date.now()/1000)+3600,user:{id:ids[role]}});
    }
    if(url.includes('/rpc/eliminar_producto_admin'))return Response.json('eliminado');
    if(url.includes('/rpc/'))return Response.json({id:1});
    return Response.json([]);
}
before(async()=>{server=createApp({config,gateway,fetchImpl:provider}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{await new Promise(r=>server.close(r));});
async function request(path,method='GET',body,cookie=''){
    return fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Libreria-Request':'1',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
}
async function login(role){const response=await request('/api/auth/login','POST',{email:role+'@example.test',password:'fictional-test-password'});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];return {cookie,body:await response.json()};}
const product={p_producto_id:null,p_isbn:'9780451524935',p_titulo:'Libro',p_autor:'Autor',p_categoria:'Categoria',p_editorial:'Editorial',p_descripcion:'Ejemplo',p_precio:10,p_descuento_pct:0,p_formato:'fisico',p_idioma:'Español',p_imagen_portada:null,p_stock_inicial:0,p_stock_minimo:0,p_activo:true};
test('login/session propios no exponen JWT, refresh token ni contraseña',async()=>{
    const {cookie,body}=await login('cliente');assert.equal(body.role,'cliente');assert.equal(body.user.id,ids.cliente);
    assert.doesNotMatch(JSON.stringify(body),/access_token|refresh_token|fictional-test-password|private-provider-token/);
    const session=await request('/api/auth/session','GET',undefined,cookie);assert.equal((await session.json()).role,'cliente');
});
test('empleado ajusta inventario por Express; cliente no y operaciones administrativas siguen restringidas',async()=>{
    const adjustment={p_producto_id:1,p_tipo:'entrada',p_cantidad:2,p_motivo:'Prueba'};
    for(const [role,status]of [['cliente',403],['empleado',201],['administrador',201]]){
        const {cookie}=await login(role);
        const result=await request('/api/inventario/ajustes','POST',adjustment,cookie);assert.equal(result.status,status);await result.body.cancel();
        const book=await request('/api/productos','POST',product,cookie);assert.equal(book.status,role==='administrador'?201:403);await book.body.cancel();
        const users=await request('/api/usuarios','GET',undefined,cookie);assert.equal(users.status,role==='administrador'?200:403);await users.body.cancel();
    }
    const rpc=calls.find(call=>call.url.includes('ajustar_inventario_admin'));
    assert.equal(rpc.options.headers.Authorization,'Bearer empleado');assert.equal(rpc.options.headers.apikey,config.anonKey);
});
test('CRUD y validación de productos/categorías usan controladores con JWT del administrador',async()=>{
    const {cookie}=await login('administrador');
    for(const [path,method,body,status]of [
        ['/api/productos','GET',undefined,200],['/api/productos','POST',product,201],['/api/productos/1','PUT',product,200],['/api/productos/1','DELETE',undefined,200],
        ['/api/categorias','GET',undefined,200],['/api/categorias','POST',{p_nombre:'Prueba',p_activo:true},201],['/api/categorias/1','PUT',{p_nombre:'Editada',p_activo:true},200],['/api/categorias/1','DELETE',undefined,200],
        ['/api/productos','POST',{...product,p_precio:-1},400],['/api/categorias','POST',{p_nombre:'Escalada',p_activo:true,usuario_id:'otro'},400]
    ]){const result=await request(path,method,body,cookie);assert.equal(result.status,status,path+' '+method);await result.body.cancel();}
    assert.ok(calls.some(call=>call.url.includes('/rpc/guardar_producto_admin')));
});
test('logout gana a renovación en vuelo y rechaza reutilizar la cookie',async()=>{
    expiry=true;const {cookie}=await login('empleado');expiry=false;
    const started=new Promise(resolve=>refreshStarted=resolve);releaseRefresh={};
    const pending=request('/api/auth/session','GET',undefined,cookie);await started;
    const logout=await request('/api/auth/logout','POST',undefined,cookie);assert.equal(logout.status,200);await logout.body.cancel();
    releaseRefresh.resolve();const response=await pending;assert.equal(await response.json(),null);
    releaseRefresh=null;refreshStarted=null;
    const stale=await request('/api/auth/session','GET',undefined,cookie);assert.equal(await stale.json(),null);
});
test('varias renovaciones simultáneas comparten el resultado y logout sigue efectivo',async()=>{
    expiry=true;const {cookie}=await login('empleado');expiry=false;
    const started=new Promise(resolve=>refreshStarted=resolve);releaseRefresh={};
    const a=request('/api/auth/session','GET',undefined,cookie);await started;
    const b=request('/api/auth/session','GET',undefined,cookie);
    releaseRefresh.resolve();
    for(const result of await Promise.all([a,b]))assert.equal((await result.json()).role,'empleado');
    releaseRefresh=null;refreshStarted=null;
    const logout=await request('/api/auth/logout','POST',undefined,cookie);await logout.body.cancel();
    assert.equal(await (await request('/api/auth/session','GET',undefined,cookie)).json(),null);
});
