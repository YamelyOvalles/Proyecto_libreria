const path = require("node:path");
const express = require("express");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
// La configuración local vive en server/.env, que no se sube al repositorio.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT) || 3000;
const pageFiles = new Set([
    "index",
    "admin",
    "documento",
    "formulario",
    "informacion",
    "login",
    "tienda"
]);

// Mantiene la API pequeña y entrega únicamente las páginas públicas previstas.
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_request, response) => {
    response.set("Cache-Control", "no-store").json({
        status: "ok",
        service: "libreria-quisqueya",
        supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    });
});

const supabaseConfig = require(path.join(projectRoot, "api", "supabase-config.js"));
// La clave pública se entrega desde el servidor para no guardarla en el HTML.
app.get("/api/supabase-config", supabaseConfig);
app.get("/js/supabase-config.js", supabaseConfig);

for (const directory of ["assets", "css", "js"]) {
    app.use(`/${directory}`, express.static(path.join(projectRoot, directory), {
        dotfiles: "deny",
        index: false,
        fallthrough: true
    }));
}

app.get("/", (_request, response) => {
    response.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/:page", (request, response, next) => {
    const page = request.params.page.replace(/\.html$/i, "");
    if (!pageFiles.has(page)) return next();
    response.sendFile(path.join(projectRoot, `${page}.html`));
});

app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Ruta API no encontrada." });
});

app.use((_request, response) => {
    response.status(404).type("text/plain").send("Página no encontrada.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Librería Quisqueya disponible en http://localhost:${port}`);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.warn("Configura server/.env para habilitar la conexión con Supabase.");
    }
});
