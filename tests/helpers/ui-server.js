const { createApp } = require('../../server/app');
// La prueba visual sin credenciales verifica estados públicos; no pretende probar Auth.
const config = { url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_ui_test' };
createApp({ config }).listen(3106, '127.0.0.1');
