const { Router } = require('express');
const { HttpError } = require('../middleware/errors');
const { createBusinessService } = require('../services/business');
const { createBusinessController } = require('../controllers/business');
const {storeController}=require('../controllers/store');
const {rateLimit}=require('express-rate-limit');
function businessRoutes(config, authentication) {
    const router=Router(), service=createBusinessService(config,authentication), c=createBusinessController(service), shop=storeController(service);
    const roles = (...allowed) => async(req,res,next) => {
        req.identity=await authentication.validate(req);
        if(!allowed.includes(req.identity.role)) throw new HttpError(403,'No tienes permiso para esta operación.');
        res.set('Cache-Control','no-store'); next();
    };
    const staff=roles('empleado','administrador'), admin=roles('administrador');
    const member=roles('cliente','empleado','administrador');
    router.get('/catalogo',shop.catalog);router.get('/catalogo/impuestos',member,shop.taxes);router.get('/sucursales',member,shop.branches);
    router.get('/carrito',member,shop.cart);router.put('/carrito/items/:id',member,shop.quantity);
    router.post('/contacto',rateLimit({windowMs:15*60000,limit:15,legacyHeaders:false}),async(req,_res,next)=>{
        if(req.session.auth) req.identity=await authentication.validate(req);
        next();
    },shop.contact);
    router.get('/documentos/:type/:id',member,shop.document);router.get('/mis-pedidos/:id/cotizacion',member,shop.quotation);
    router.get('/productos',staff,c.listProducts); router.post('/productos',admin,c.saveProduct);
    router.put('/productos/:id',admin,c.saveProduct); router.delete('/productos/:id',admin,c.deleteProduct);
    router.get('/categorias',staff,c.listCategories); router.post('/categorias',admin,c.saveCategory);
    router.put('/categorias/:id',admin,c.saveCategory); router.delete('/categorias/:id',admin,c.deleteCategory);
    router.get('/usuarios',admin,c.listUsers); router.post('/usuarios',admin,c.createUser);
    router.put('/usuarios/:id',admin,c.updateUser); router.delete('/usuarios/:id',admin,c.deleteUser);
    router.get('/inventario',staff,c.inventory); router.post('/inventario/ajustes',staff,c.adjust);
    router.get('/pedidos',staff,c.orders); router.patch('/pedidos/:id/estado',staff,c.orderState('estado'));
    router.patch('/pedidos/:id/pago',staff,c.orderState('pago')); router.post('/pedidos/:id/factura',staff,c.invoice);
    router.get('/cotizaciones',staff,c.documents('cotizaciones')); router.get('/facturas',staff,c.documents('facturas'));
    router.get('/configuracion',staff,c.configuration); router.put('/configuracion',admin,c.saveConfiguration);
    router.get('/mensajes',admin,c.messages); router.patch('/mensajes/:id',admin,c.messageState);
    return router;
}
module.exports={businessRoutes};
