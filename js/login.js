/** Inicio de sesión, registro y recuperación mediante Supabase Auth. */
const formulario = document.getElementById("login-form");
const correo = document.getElementById("email");
const clave = document.getElementById("password");
const mensaje = document.getElementById("login-message");
const botonEnviar = document.getElementById("login-submit-btn");
const botonCliente = document.getElementById("role-client");
const botonAdmin = document.getElementById("role-admin");
const botonVerClave = document.getElementById("toggle-password");
const botonRegistro = document.querySelector("[data-register]");
const botonRecuperar = document.querySelector("[data-recover]");
const botonGoogle = document.getElementById("google-login-btn");
const pistaAdmin = document.getElementById("admin-credentials-hint");
const titulo = document.getElementById("login-title");
const subtitulo = document.getElementById("login-subtitle");
const etiquetaRol = document.getElementById("login-role-eyebrow");

let rolSeleccionado = "cliente";
let modo = "login";

function mostrarMensaje(texto, tipo = "error") {
    mensaje.textContent = texto;
    mensaje.className = `form-message ${tipo === "exito" ? "success-message" : ""}`;
}

function bloquear(bloqueado) {
    botonEnviar.disabled = bloqueado;
    correo.disabled = bloqueado;
    clave.disabled = bloqueado;
}

function cambiarRol(rol) {
    rolSeleccionado = rol;
    botonCliente.classList.toggle("active", rol === "cliente");
    botonAdmin.classList.toggle("active", rol === "administrador");
    botonCliente.setAttribute("aria-pressed", String(rol === "cliente"));
    botonAdmin.setAttribute("aria-pressed", String(rol === "administrador"));
    pistaAdmin.hidden = rol !== "administrador";
    etiquetaRol.textContent = rol === "administrador" ? "Panel operativo" : "Panel de lectores";
    titulo.textContent = rol === "administrador" ? "Acceso administrativo" : "Bienvenida de vuelta";
    subtitulo.textContent = rol === "administrador"
        ? "Utiliza tu cuenta administrativa autorizada."
        : "Entra para gestionar tus pedidos y lecturas.";
    mostrarMensaje("");
}

function cambiarModoRegistro() {
    modo = modo === "registro" ? "login" : "registro";
    botonEnviar.textContent = modo === "registro" ? "Crear cuenta" : "Entrar a Librería Quisqueya";
    botonRegistro.textContent = modo === "registro" ? "Volver a iniciar sesión" : "Regístrate";
    mostrarMensaje(modo === "registro"
        ? "Escribe tu correo y una contraseña de al menos 8 caracteres."
        : "", "exito");
}

botonCliente.addEventListener("click", () => cambiarRol("cliente"));
botonAdmin.addEventListener("click", () => cambiarRol("administrador"));
botonRegistro.addEventListener("click", cambiarModoRegistro);

botonVerClave.addEventListener("click", () => {
    const oculto = clave.type === "password";
    clave.type = oculto ? "text" : "password";
    botonVerClave.classList.toggle("is-visible", oculto);
    botonVerClave.setAttribute("aria-label", oculto ? "Ocultar contraseña" : "Mostrar contraseña");
});

botonRecuperar.addEventListener("click", async () => {
    const email = correo.value.trim();
    if (!email || !correo.checkValidity()) {
        mostrarMensaje("Escribe primero un correo electrónico válido.");
        correo.focus();
        return;
    }
    if (!window.libreriaSupabase) return mostrarMensaje("Configura Supabase antes de recuperar la contraseña.");
    bloquear(true);
    const { error } = await window.libreriaSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`
    });
    bloquear(false);
    mostrarMensaje(error ? window.mensajeErrorSupabase(error) : "Revisa tu correo para restablecer la contraseña.", error ? "error" : "exito");
});

botonGoogle.addEventListener("click", async () => {
    if (!window.libreriaSupabase) return mostrarMensaje("Configura Supabase antes de continuar.");
    const { error } = await window.libreriaSupabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("informacion.html", window.location.href).href }
    });
    if (error) mostrarMensaje(window.mensajeErrorSupabase(error));
});

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    mostrarMensaje("");
    const email = correo.value.trim();
    const password = clave.value;

    if (modo !== "recuperacion" && (!email || !correo.checkValidity())) return mostrarMensaje("Ingresa un correo electrónico válido.");
    if (password.length < 8) return mostrarMensaje("La contraseña debe contener al menos 8 caracteres.");
    if (!window.libreriaSupabase) return mostrarMensaje("Completa js/supabase-config.js con los datos públicos de tu proyecto.");

    bloquear(true);
    try {
        if (modo === "recuperacion") {
            const { error } = await window.libreriaSupabase.auth.updateUser({ password });
            if (error) throw error;
            mostrarMensaje("Contraseña actualizada. Ya puedes entrar con tu nueva contraseña.", "exito");
            modo = "login";
            correo.disabled = false;
            botonEnviar.textContent = "Entrar a Librería Quisqueya";
            await window.libreriaSupabase.auth.signOut();
        } else if (modo === "registro") {
            if (rolSeleccionado === "administrador") {
                throw new Error("Las cuentas administrativas solo pueden ser asignadas desde la base de datos.");
            }
            const { data, error } = await window.libreriaSupabase.auth.signUp({ email, password });
            if (error) throw error;
            if (!data.session) {
                mostrarMensaje("Cuenta creada. Confirma el correo antes de iniciar sesión.", "exito");
                modo = "login";
                botonEnviar.textContent = "Entrar a Librería Quisqueya";
                botonRegistro.textContent = "Regístrate";
                return;
            }
            window.location.replace("informacion.html");
        } else {
            const { data, error } = await window.libreriaSupabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const rolReal = await window.obtenerRolLibreria(data.user.id);
            if (rolSeleccionado === "administrador" && rolReal !== "administrador") {
                await window.libreriaSupabase.auth.signOut();
                throw new Error("Esta cuenta no tiene permisos administrativos.");
            }
            window.location.replace(rolReal === "administrador" ? "admin.html" : "informacion.html");
        }
    } catch (error) {
        mostrarMensaje(window.mensajeErrorSupabase(error, error.message));
    } finally {
        bloquear(false);
    }
});

(async function prepararAcceso() {
    const parametros = new URLSearchParams(window.location.search);
    if (!window.libreriaSupabaseConfigurado || parametros.get("config") === "pendiente") {
        mostrarMensaje("Configura la URL y la clave pública en js/supabase-config.js.");
        return;
    }
    try {
        const sesion = await window.obtenerSesionLibreria();
        if (sesion?.user && modo !== "recuperacion") {
            const rol = await window.obtenerRolLibreria(sesion.user.id);
            window.location.replace(rol === "administrador" ? "admin.html" : "informacion.html");
        }
    } catch (error) {
        mostrarMensaje(window.mensajeErrorSupabase(error));
    }
}());

window.libreriaSupabase?.auth.onAuthStateChange(evento => {
    if (evento === "PASSWORD_RECOVERY") {
        modo = "recuperacion";
        correo.disabled = true;
        titulo.textContent = "Crea una nueva contraseña";
        subtitulo.textContent = "Escribe una contraseña segura de al menos 8 caracteres.";
        botonEnviar.textContent = "Actualizar contraseña";
        mostrarMensaje("El enlace de recuperación fue validado.", "exito");
    }
});
