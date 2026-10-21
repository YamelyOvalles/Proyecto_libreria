const session = require('express-session');
const { Pool } = require('pg');
const { HttpError } = require('../middleware/errors');
const retention = 8 * 60 * 60 * 1000;
const closed = () => new HttpError(401, 'La sesión ha sido cerrada.');

// Las revocaciones permanecen más tiempo que cualquier solicitud en vuelo.
// Un UPDATE condicionado evita que save/touch recreen una sesión revocada,
// incluso si logout se ejecutó en otro proceso de Express.
class PostgresSessionStore extends session.Store {
    constructor(connectionString) {
        super(); this.pool = new Pool({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
        this.pool.on('error',()=>console.error('Se perdió una conexión del almacén de sesiones.'));
    }
    get(sid, callback) {
        this.pool.query("SELECT sess FROM public.application_sessions WHERE sid=$1 AND revoked_at IS NULL AND expire>(now() AT TIME ZONE 'UTC')", [sid])
            .then(result => callback(null, result.rows[0]?.sess || null), callback);
    }
    set(sid, value, callback = () => {}) {
        const expire = value.cookie?.expires ? new Date(value.cookie.expires) : new Date(Date.now() + 30 * 60000);
        this.pool.query(`INSERT INTO public.application_sessions(sid,sess,expire) VALUES($1,$2,($3::timestamptz AT TIME ZONE 'UTC'))
            ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expire=excluded.expire
            WHERE application_sessions.revoked_at IS NULL RETURNING sid`, [sid, value, expire])
            .then(result => callback(result.rowCount ? null : closed()), callback);
    }
    destroy(sid, callback = () => {}) {
        this.pool.query(`UPDATE public.application_sessions SET sess='{}',expire=($2::timestamptz AT TIME ZONE 'UTC'),revoked_at=now()
            WHERE sid=$1`, [sid, new Date(Date.now() + retention)])
            .then(() => callback(null), callback);
    }
    touch(sid, value, callback = () => {}) {
        this.pool.query("UPDATE public.application_sessions SET expire=($2::timestamptz AT TIME ZONE 'UTC') WHERE sid=$1 AND revoked_at IS NULL", [sid, new Date(value.cookie.expires)])
            .then(() => callback(null), callback);
    }
    async prune() { await this.pool.query("DELETE FROM public.application_sessions WHERE expire<(now() AT TIME ZONE 'UTC')"); }
    async close() { if (!this.closed) { this.closed=true; await this.pool.end(); } }
}

class DevelopmentSessionStore extends session.MemoryStore {
    constructor() { super(); this.revoked = new Map(); }
    set(sid, value, callback = () => {}) {
        for (const [id, until] of this.revoked) if (until < Date.now()) this.revoked.delete(id);
        if (this.revoked.has(sid)) return callback(closed());
        super.set(sid, value, callback);
    }
    destroy(sid, callback) { if (this.sessions[sid] || this.revoked.has(sid)) this.revoked.set(sid, Date.now() + retention); super.destroy(sid, callback); }
}
module.exports = { PostgresSessionStore, DevelopmentSessionStore };
