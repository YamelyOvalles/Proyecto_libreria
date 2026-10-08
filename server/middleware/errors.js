class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
function errorHandler(error, _req, res, next) {
    if (res.headersSent) return next(error);
    const status = error instanceof HttpError ? error.status :
        error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).set('Cache-Control', 'no-store').json({ error:
        error instanceof HttpError ? error.message : status === 400 ? 'JSON inválido.' :
            status === 413 ? 'Solicitud demasiado grande.' : 'Error interno del servidor.' });
}
module.exports = { HttpError, errorHandler };
