const { publicConfigHandler } = require('../server/public-config');
module.exports = (req, res) => publicConfigHandler({
    url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY
})(req, res);
