// Cliente de Supabase.
(function inicializarSupabase() {
    const configuracion = window.LIBRERIA_SUPABASE_CONFIG || {};
    // El SDK puede consumir el fragmento antes de cargar el formulario de login.
    // Esta señal solo conserva la intención; obtenerSesionLibreria valida el JWT.
    window.libreriaRecuperacionSolicitada = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

    function esClavePublica(clave) {
        if (typeof clave !== "string" || !clave || clave.startsWith("TU_")) return false;
        if (clave.startsWith("sb_secret_")) return false;
        if (clave.startsWith("sb_publishable_")) return true;

        // Acepta solo claves publicas.
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

    const configurado = (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configuracion.url || "") ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(configuracion.url || "")) &&
        esClavePublica(configuracion.anonKey);

    window.libreriaSupabaseConfigurado = Boolean(configurado && window.supabase?.createClient);
    const memoria = new Map();
    async function servidorFetch(input, opciones = {}) {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const headers = new Headers(opciones.headers || (typeof input !== 'string' ? input.headers : undefined));
        headers.set('X-Libreria-Request', '1');
        return fetch('/api/supabase' + url.pathname + url.search, { ...opciones, headers, credentials: 'same-origin' });
    }
    window.libreriaSupabase = window.libreriaSupabaseConfigurado
        ? window.supabase.createClient(configuracion.url, configuracion.anonKey, {
            global: { fetch: servidorFetch },
            auth: {
                persistSession: true,
                storage: { getItem: key => memoria.get(key) || null, setItem: (key, value) => memoria.set(key, value), removeItem: key => memoria.delete(key) },
                storageKey: "libreria.auth",
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        })
        : null;
    if (window.libreriaSupabase) {
        const cerrar = window.libreriaSupabase.auth.signOut.bind(window.libreriaSupabase.auth);
        window.libreriaSupabase.auth.signOut = async () => {
            const respuesta = await fetch('/api/supabase/auth/v1/logout', { method: 'POST', credentials: 'same-origin',
                headers: { 'X-Libreria-Request': '1' } });
            if (!respuesta.ok) return { error: new Error('No se pudo cerrar la sesión.') };
            return cerrar({ scope: 'local' });
        };
    }

    let restauracion;
    async function restaurarSesion() {
        if (!restauracion) restauracion = (async () => {
            // Limpia únicamente las antiguas credenciales de esta aplicación.
            window.sessionStorage?.removeItem?.('libreria.auth');
            window.sessionStorage?.removeItem?.('libreria.usuario');
            const fragmento = new URLSearchParams(window.location.hash.slice(1));
            let respuesta;
            if (fragmento.has('access_token') && fragmento.has('refresh_token')) {
                respuesta = await fetch('/api/supabase/exchange', { method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1' },
                    body: JSON.stringify({ access_token: fragmento.get('access_token'), refresh_token: fragmento.get('refresh_token') }) });
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } else respuesta = await fetch('/api/supabase/session', { credentials: 'same-origin' });
            if (!respuesta.ok) throw new Error('No se pudo restaurar la sesión.');
            const sesion = await respuesta.json();
            if (sesion) {
                const { error } = await window.libreriaSupabase.auth.setSession(sesion);
                if (error) throw error;
            }
        })();
        return restauracion;
    }

    window.obtenerSesionLibreria = async function () {
        if (!window.libreriaSupabase) return null;
        await restaurarSesion();
        const { data: datosSesion, error: errorSesion } = await window.libreriaSupabase.auth.getSession();
        if (errorSesion) throw errorSesion;
        if (!datosSesion.session) return null;

        // Valida la sesion con Supabase.
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
            .from("perfiles").select("nombres,apellidos,activo")
            .eq("id", usuarioId).maybeSingle();
        if (error) throw error;
        return data;
    };

    window.mensajeErrorSupabase = function (error, alternativo) {
        console.error(error);
        const codigo = String(error?.code || "").toLowerCase();
        const estado = Number(error?.status || 0);
        const detalle = String(error?.message || "").toLowerCase();

        if (codigo === "over_email_send_rate_limit" ||
            (estado === 429 && detalle.includes("email")) ||
            detalle.includes("email rate limit exceeded")) {
            return "Se alcanzó el límite de correos de Supabase. Espera hasta una hora antes de intentarlo otra vez o configura un servidor SMTP propio en Supabase.";
        }
        if (codigo === "over_request_rate_limit" || estado === 429) {
            return "Se hicieron demasiados intentos. Espera unos minutos antes de volver a probar.";
        }
        if (error?.message?.includes("Failed to fetch")) {
            return "No se pudo conectar con Supabase. Revisa tu conexión y la configuración.";
        }
        return alternativo || error?.message || "Ocurrió un error inesperado.";
    };
}());
