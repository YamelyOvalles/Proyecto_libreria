const { HttpError } = require('./errors');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Se requiere un objeto JSON.'); return value; }
function fields(value, allowed) { object(value); if (Object.keys(value).some(key => !allowed.includes(key))) throw new HttpError(400, 'La solicitud contiene campos no permitidos.'); return value; }
function text(value, name, max = 200, required = true) {
    if (!required && value == null) return null;
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, `${name} inválido.`);
    return value.trim();
}
function number(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) throw new HttpError(400, `${name} inválido.`);
    return value;
}
function boolean(value, name) { if (typeof value !== 'boolean') throw new HttpError(400, `${name} inválido.`); return value; }
function uuid(value) { if (typeof value !== 'string' || !uuidPattern.test(value)) throw new HttpError(400, 'Identificador inválido.'); return value; }
function id(value) { const n = Number(value); return number(n, 'Identificador', { min: 1, integer: true }); }
function credentials(value) {
    fields(value, ['email', 'password']); email(value.email);
    if (typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 1024) throw new HttpError(400, 'La contraseña debe tener entre 8 y 1024 caracteres.');
    return value;
}
function email(value) { if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, 'Correo inválido.'); return value.trim().toLowerCase(); }
module.exports = { object, fields, text, number, boolean, uuid, id, credentials, email };
