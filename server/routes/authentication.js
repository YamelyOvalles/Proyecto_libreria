const {Router}=require('express');
const {rateLimit}=require('express-rate-limit');
const {createAuthenticationController}=require('../controllers/authentication');
function authenticationRoutes(config,gateway,applicationAuth){
    const router=Router(), c=createAuthenticationController(config,gateway,applicationAuth);
    const limited=rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,
        message:{error:'Demasiados intentos. Intenta más tarde.'}});
    router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
    router.get('/session',c.session);router.post('/logout',c.logout);
    router.post('/login',limited,c.login);router.post('/register',limited,c.register);
    router.post('/recover',limited,c.recover);router.put('/password',limited,c.password);
    router.post('/exchange',limited,c.exchange);router.post('/oauth',limited,c.oauth);
    return router;
}
module.exports={authenticationRoutes};
