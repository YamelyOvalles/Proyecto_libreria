const { HttpError } = require('../middleware/errors');
function createOrderController(gateway) {
    return async (req, res) => {
        const data = req.body;
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            Object.keys(data).some(key => !['p_metodo_entrega', 'p_metodo_pago', 'p_sucursal_id', 'p_direccion', 'p_notas'].includes(key))) {
            throw new HttpError(400, 'Datos de pedido inválidos.');
        }
        if (!['domicilio', 'retiro'].includes(data.p_metodo_entrega) ||
            !['contra_entrega', 'efectivo', 'tarjeta', 'transferencia'].includes(data.p_metodo_pago)) {
            throw new HttpError(400, 'Método de entrega o pago inválido.');
        }
        if (data.p_metodo_entrega === 'retiro' && (!Number.isSafeInteger(data.p_sucursal_id) || data.p_sucursal_id <= 0)) {
            throw new HttpError(400, 'Selecciona una sucursal.');
        }
        if (data.p_direccion != null && (typeof data.p_direccion !== 'object' || Array.isArray(data.p_direccion))) {
            throw new HttpError(400, 'Dirección inválida.');
        }
        if (data.p_metodo_entrega === 'domicilio' &&
            ['destinatario', 'telefono', 'linea_1', 'ciudad', 'provincia'].some(key =>
                typeof data.p_direccion?.[key] !== 'string' || !data.p_direccion[key].trim())) {
            throw new HttpError(400, 'La dirección de entrega está incompleta.');
        }
        if (data.p_notas != null && (typeof data.p_notas !== 'string' || data.p_notas.length > 2000)) {
            throw new HttpError(400, 'Notas inválidas.');
        }
        // Identidad, precios, stock, documentos y transacción pertenecen exclusivamente a la RPC.
        const result = await gateway.createOrder(req.session.token, {
            p_metodo_entrega: data.p_metodo_entrega, p_metodo_pago: data.p_metodo_pago,
            p_sucursal_id: data.p_metodo_entrega === 'retiro' ? data.p_sucursal_id : null,
            p_direccion: data.p_direccion || null, p_notas: data.p_notas || null
        });
        res.status(201).set('Cache-Control', 'no-store').json(result);
    };
}
module.exports = { createOrderController };
