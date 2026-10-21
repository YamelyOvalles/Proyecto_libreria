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
    window.libreriaApi = async function(path, options = {}) {
        try {
            const response = await fetch(path, { method: options.method || 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-Libreria-Request': '1' },
                body: options.body === undefined ? undefined : JSON.stringify(options.body) });
            const data = await response.json();
            return response.ok ? { data, error: null } : { data: null, error: { message: data.error || 'Solicitud rechazada.', status: response.status } };
        } catch { return { data: null, error: { message: 'No se pudo conectar con el servidor Express.' } }; }
    };
    // El SDK se conserva para lecturas y Storage mediante Express; no administra Auth.
    window.libreriaSupabase = window.libreriaSupabaseConfigurado ? window.supabase.createClient(configuracion.url, configuracion.anonKey, {
        accessToken: async () => 'server-session',
        global: { fetch: (input, options = {}) => {
            const url = new URL(typeof input === 'string' ? input : input.url);
            const headers = new Headers(options.headers);
            headers.set('X-Libreria-Request', '1');
            return fetch('/api/supabase' + url.pathname + url.search, { ...options, headers, credentials: 'same-origin' });
        } }
    }) : null;
    let current = null, restoration;
    const listeners = new Set();
    function emit(event) { for (const listener of listeners) listener(event, current); }
    async function call(path, method, body) {
        const result = await window.libreriaApi('/api/auth/' + path, { method, body });
        if (result.error) return result;
        return result;
    }
    async function restore() {
        if (!restoration) restoration = (async () => {
            window.sessionStorage?.removeItem?.('libreria.auth');
            window.sessionStorage?.removeItem?.('libreria.usuario');
            const fragment = new URLSearchParams(window.location.hash.slice(1));
            let result;
            if (fragment.has('access_token') && fragment.has('refresh_token')) {
                const body = { access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token'), type: fragment.get('type') };
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                result = await call('exchange', 'POST', body);
            } else result = await call('session', 'GET');
            if (result.error) throw new Error(result.error.message);
            current = result.data;
        })();
        return restoration;
    }
    window.libreriaAuth = {
        async getSession() { try { await restore(); return { data: { session: current }, error: null }; } catch (error) { return { data: { session: null }, error }; } },
        async getUser() { const result = await call('session', 'GET'); current = result.data; return { data: { user: current?.user || null }, error: result.error }; },
        async signInWithPassword(body) { const result = await call('login', 'POST', body); if (!result.error) { current = result.data; emit('SIGNED_IN'); } return { data: { user: result.data?.user, session: result.data }, error: result.error }; },
        async signUp(body) { const result = await call('register', 'POST', body); if (result.data?.session) { current = result.data.session; emit('SIGNED_IN'); } return result; },
        async signOut() { const result = await call('logout', 'POST'); if (!result.error) { current = null; emit('SIGNED_OUT'); } return result; },
        resetPasswordForEmail: email => call('recover', 'POST', { email }),
        updateUser: body => call('password', 'PUT', body),
        async signInWithOAuth({ provider }) { const result = await call('oauth', 'POST', { provider }); if (result.data?.url) window.location.assign(result.data.url); return result; },
        onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; }
    };
    window.obtenerSesionLibreria = async function() {
        if (!window.libreriaSupabase) return null;
        const result = await window.libreriaAuth.getSession();
        if (result.error) throw result.error;
        return result.data.session;
    };

    window.obtenerRolLibreria = async function(id) { await restore(); return current?.user?.id === id ? current.role : null; };
    window.obtenerPerfilLibreria = async function(id) { await restore(); return current?.user?.id === id ? current.profile : null; };

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
