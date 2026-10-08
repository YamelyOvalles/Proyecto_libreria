function isPublicKey(key) {
    if (typeof key !== 'string' || !key || key.startsWith('sb_secret_')) return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
    catch { return false; }
}
function validPublicConfig({ url, anonKey }) {
    return (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url || '') ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(url || '')) && isPublicKey(anonKey);
}
function publicConfigHandler(config) {
    return (_req, res) => {
        const valid = validPublicConfig(config);
        res.status(valid ? 200 : 503).set('Cache-Control', 'no-store').type('application/javascript')
            .send(`window.LIBRERIA_SUPABASE_CONFIG = Object.freeze(${JSON.stringify(valid ?
                { url: config.url, anonKey: config.anonKey } : { url: '', anonKey: '' })});`);
    };
}
module.exports = { isPublicKey, validPublicConfig, publicConfigHandler };
