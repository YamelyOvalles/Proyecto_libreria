const fs = require("node:fs/promises");
const path = require("node:path");

const baseUrl = process.argv[2] || "http://localhost:3000";
const evidencePath = path.resolve(__dirname, "..", "evidencias", "resultado-servidor.md");
const routes = ["/", "/admin.html", "/api/health", "/js/supabase-config.js", "/css/styles.css"];

async function main() {
    // Guarda solo estados y tipos de respuesta, nunca el contenido de la clave.
    const results = [];
    for (const route of routes) {
        const response = await fetch(new URL(route, baseUrl));
        const result = {
            route,
            status: response.status,
            contentType: response.headers.get("content-type") || "—",
            detail: ""
        };

        if (route === "/api/health") {
            const health = await response.json();
            result.detail = `status=${health.status}; supabaseConfigured=${health.supabaseConfigured}`;
        } else if (route === "/js/supabase-config.js") {
            result.detail = "Configuración pública servida; valor de la clave omitido.";
            await response.body?.cancel();
        } else {
            result.detail = "Ruta disponible.";
            await response.body?.cancel();
        }
        results.push(result);
    }

    const lines = [
        "# Evidencia de ejecución de Node.js + Express",
        "",
        `Fecha: ${new Date().toLocaleString("es-BO", { timeZone: "America/La_Paz" })}`,
        `URL base: ${baseUrl}`,
        "",
        "| Ruta | HTTP | Tipo de contenido | Resultado |",
        "|---|---:|---|---|",
        ...results.map(item => `| ${item.route} | ${item.status} | ${item.contentType} | ${item.detail} |`),
        "",
        "Las capturas visuales están en `servidor-express-home.png` y `servidor-express-health.png`."
    ];

    await fs.writeFile(evidencePath, `${lines.join("\n")}\n`, "utf8");
    console.log(`Evidencia guardada en ${evidencePath}`);
    for (const result of results) console.log(`${result.status} ${result.route} — ${result.detail}`);
    if (results.some(result => result.status < 200 || result.status >= 300)) process.exitCode = 1;
}

main().catch(error => {
    console.error(`No se pudo verificar el servidor: ${error.message}`);
    process.exitCode = 1;
});
