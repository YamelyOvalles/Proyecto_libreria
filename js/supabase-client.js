/** Cliente único y utilidades compartidas de Supabase. */
(function inicializarSupabase() {
    const configuracion = window.LIBRERIA_SUPABASE_CONFIG || {};

    function esClavePublica(clave) {
        if (typeof clave !== "string" || !clave || clave.startsWith("TU_")) return false;
        if (clave.startsWith("sb_secret_")) return false;
        if (clave.startsWith("sb_publishable_")) return true;

        // Las claves anon heredadas son JWT públicos. Rechaza cualquier JWT
        // con otro rol para impedir que service_role llegue al navegador.
        try {
            const segmento = clave.split(".")[1];
            if (!segmento) return false;
            const base64 = segmento.replaceAll("-", "+").replaceAll("_", "/")
                .padEnd(Math.ceil(segmento.length / 4) * 4, "=");
            return JSON.parse(atob(base64)).role === "anon";
        } catch {
            return false;
        }
    }

    const configurado = /^https:\/\/.+\.supabase\.co$/i.test(configuracion.url || "") &&
        esClavePublica(configuracion.anonKey);

    window.libreriaSupabaseConfigurado = Boolean(configurado && window.supabase?.createClient);
    window.libreriaSupabase = window.libreriaSupabaseConfigurado
        ? window.supabase.createClient(configuracion.url, configuracion.anonKey, {
            auth: {
                persistSession: true,
                storage: window.sessionStorage,
                storageKey: "libreria.auth",
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        })
        : null;

    window.obtenerSesionLibreria = async function () {
        if (!window.libreriaSupabase) return null;
        const { data: datosSesion, error: errorSesion } = await window.libreriaSupabase.auth.getSession();
        if (errorSesion) throw errorSesion;
        if (!datosSesion.session) return null;

        // getUser valida el token con Supabase Auth; no se confía solamente en
        // los datos que estén guardados en el navegador.
        const { data: datosUsuario, error: errorUsuario } = await window.libreriaSupabase.auth.getUser();
        if (errorUsuario) throw errorUsuario;
        if (!datosUsuario.user || datosUsuario.user.id !== datosSesion.session.user.id) return null;
        return { ...datosSesion.session, user: datosUsuario.user };
    };

    window.obtenerRolLibreria = async function (usuarioId) {
        if (!window.libreriaSupabase || !usuarioId) return null;
        const { data, error } = await window.libreriaSupabase
            .from("usuario_roles").select("roles(codigo)")
            .eq("usuario_id", usuarioId).single();
        if (error) throw error;
        return data?.roles?.codigo || null;
    };

    window.obtenerPerfilLibreria = async function (usuarioId) {
        if (!window.libreriaSupabase || !usuarioId) return null;
        const { data, error } = await window.libreriaSupabase
            .from("perfiles").select("nombres,apellidos")
            .eq("id", usuarioId).maybeSingle();
        if (error) throw error;
        return data;
    };

    window.mensajeErrorSupabase = function (error, alternativo) {
        console.error(error);
        if (error?.message?.includes("Failed to fetch")) {
            return "No se pudo conectar con Supabase. Revisa tu conexión y la configuración.";
        }
        return alternativo || error?.message || "Ocurrió un error inesperado.";
    };
}());
