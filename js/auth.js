// Protege el panel administrativo.
(async function protegerPagina() {
    const esPaginaAdmin = window.location.pathname.toLowerCase().endsWith("admin.html");
    if (esPaginaAdmin) document.documentElement.style.visibility = "hidden";

    function continuarComoInvitado() {
        window.libreriaSesion = null;
        window.libreriaUsuario = null;
        window.libreriaRol = null;
        window.libreriaAuthResuelta = true;
        document.documentElement.style.visibility = "";
        document.dispatchEvent(new CustomEvent("libreria:auth-lista", {
            detail: { usuario: null, rol: null, nombre: "" }
        }));
    }

    try {
        if (!window.libreriaSupabaseConfigurado) {
            if (esPaginaAdmin) window.location.replace("login.html?config=pendiente");
            else continuarComoInvitado();
            return;
        }
        const sesion = await window.obtenerSesionLibreria();
        if (!sesion?.user) {
            if (esPaginaAdmin) window.location.replace("login.html");
            else continuarComoInvitado();
            return;
        }
        const [rol, perfil] = await Promise.all([
            window.obtenerRolLibreria(sesion.user.id),
            window.obtenerPerfilLibreria(sesion.user.id).catch(() => null)
        ]);
        if (perfil?.activo === false) {
            await window.libreriaSupabase.auth.signOut({ scope: "local" });
            window.location.replace("login.html?auth=inactivo");
            return;
        }
        if (esPaginaAdmin && !["administrador", "empleado"].includes(rol)) {
            window.location.replace("tienda.html");
            return;
        }
        const nombre = perfil?.nombres?.trim()
            || sesion.user.user_metadata?.given_name
            || sesion.user.user_metadata?.full_name?.trim().split(/\s+/)[0]
            || sesion.user.email?.split("@")[0]
            || "Usuario";
        window.libreriaSesion = Object.freeze({
            usuario: sesion.user,
            rol: rol || "cliente",
            nombre
        });
        window.libreriaUsuario = sesion.user;
        window.libreriaRol = window.libreriaSesion.rol;
        window.libreriaAuthResuelta = true;
        sessionStorage.setItem("libreria.usuario", JSON.stringify({
            id: sesion.user.id,
            correo: sesion.user.email,
            rol: window.libreriaRol,
            nombre
        }));
        document.documentElement.style.visibility = "";
        document.dispatchEvent(new CustomEvent("libreria:auth-lista", {
            detail: window.libreriaSesion
        }));
    } catch (error) {
        console.error("No se pudo validar la sesión:", error);
        if (esPaginaAdmin) window.location.replace("login.html?auth=error");
        else continuarComoInvitado();
    }
}());

window.libreriaSupabase?.auth.onAuthStateChange(evento => {
    if (evento !== "SIGNED_OUT") return;
    sessionStorage.removeItem("libreria.usuario");
    window.libreriaSesion = null;
    window.libreriaUsuario = null;
    window.libreriaRol = null;
    const esPaginaAdmin = window.location.pathname.toLowerCase().endsWith("admin.html");
    window.location.replace(esPaginaAdmin ? "login.html" : "informacion.html");
});

