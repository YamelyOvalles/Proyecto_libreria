function esClavePublica(clave) {
    // Rechaza claves secretas; el navegador solo debe recibir una clave pública.
    if (typeof clave !== "string" || !clave) return false;
    if (clave.startsWith("sb_secret_")) return false;
    if (clave.startsWith("sb_publishable_")) return true;

    try {
        const segmento = clave.split(".")[1];
        if (!segmento) return false;
        const base64 = segmento.replace(/-/g, "+").replace(/_/g, "/")
            .padEnd(Math.ceil(segmento.length / 4) * 4, "=");
        return JSON.parse(Buffer.from(base64, "base64").toString("utf8")).role === "anon";
    } catch {
        return false;
    }
}

module.exports = function supabaseConfig(_request, response) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");

    const urlValida = typeof url === "string" && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
    if (!urlValida || !esClavePublica(anonKey)) {
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
