const v=require('../middleware/validation');
const {HttpError}=require('../middleware/errors');
function storeController(service){
    async function cart(identity){return (await service.data('carritos?select=id&perfil_id=eq.'+encodeURIComponent(identity.user.id),identity))?.[0]||null;}
    return {
        catalog:async(_req,res)=>res.json(await service.data('libros?select=id,isbn,titulo,descripcion,precio,descuento_pct,formato,idioma,imagen_portada,inventarios(cantidad_disponible),libro_autor(autores(nombre))&activo=eq.true&order=titulo')),
        taxes:async(req,res)=>res.json((await service.data('configuracion_negocio?select=cotizacion_mostrar_itbis,cotizacion_itbis_pct&id=eq.1',req.identity))?.[0]||{}),
        branches:async(req,res)=>res.json(await service.data('sucursales?select=id,nombre,ciudad&activo=eq.true&order=nombre',req.identity)),
        cart:async(req,res)=>{const existing=await cart(req.identity);res.json({id:existing?.id||null,items:existing?await service.data('carrito_detalles?select=libro_id,cantidad&carrito_id=eq.'+existing.id,req.identity):[]});},
        quantity:async(req,res)=>{
            v.fields(req.body,['cantidad']);v.number(req.body.cantidad,'Cantidad',{integer:true,max:2147483647});const book=v.id(req.params.id);
            let existing=await cart(req.identity);
            if(!existing && req.body.cantidad>0) existing=(await service.data('carritos?on_conflict=perfil_id',req.identity,'POST',{perfil_id:req.identity.user.id},{Prefer:'resolution=merge-duplicates,return=representation'}))?.[0];
            if(existing){
                if(req.body.cantidad===0)await service.data(`carrito_detalles?carrito_id=eq.${existing.id}&libro_id=eq.${book}`,req.identity,'DELETE');
                else await service.data('carrito_detalles?on_conflict=carrito_id,libro_id',req.identity,'POST',{carrito_id:existing.id,libro_id:book,cantidad:req.body.cantidad},{Prefer:'resolution=merge-duplicates'});
            }
            res.json({ok:true});
        },
        contact:async(req,res)=>{
            const body=v.fields(req.body,['p_nombre','p_correo','p_telefono','p_asunto','p_mensaje']);
            v.text(body.p_nombre,'Nombre',150);v.email(body.p_correo);v.text(body.p_telefono,'Teléfono',40,false);v.text(body.p_asunto,'Asunto',200);v.text(body.p_mensaje,'Mensaje',5000);
            res.status(201).json(await service.rpc('enviar_mensaje_contacto',req.identity,body));
        },
        document:async(req,res)=>{
            const table=req.params.type==='cotizacion'?'cotizaciones':req.params.type==='factura'?'facturas':null;
            if(!table)throw new HttpError(400,'Tipo de documento inválido.');
            const result=(await service.data(table+'?select=*&id=eq.'+v.uuid(req.params.id),req.identity))?.[0];
            if(!result)throw new HttpError(404,'Documento no disponible.');res.json(result);
        },
        quotation:async(req,res)=>res.json((await service.data('cotizaciones?select=id&pedido_id=eq.'+v.uuid(req.params.id),req.identity))?.[0]||null)
    };
}
module.exports={storeController};
