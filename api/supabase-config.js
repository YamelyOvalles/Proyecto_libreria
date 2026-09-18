module.exports = function supabaseConfig(request, response) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");

    if (!url || !anonKey) {
        response.status(500).send(
            'window.LIBRERIA_SUPABASE_CONFIG = Object.freeze({ url: "", anonKey: "" });'
        );
        return;
    }

    const config = JSON.stringify({ url, anonKey });
    response.status(200).send(
        `window.LIBRERIA_SUPABASE_CONFIG = Object.freeze(${config});`
    );
};
