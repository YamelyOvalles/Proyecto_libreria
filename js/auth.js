/** Protección de páginas mediante Supabase Auth y el rol guardado en PostgreSQL. */
(async function protegerPagina() {
    document.documentElement.style.visibility = "hidden";
    try {
        if (!window.libreriaSupabaseConfigurado) {
            window.location.replace("index.html?config=pendiente");
            return;
        }
        const sesion = await window.obtenerSesionLibreria();
        if (!sesion?.user) {
            window.location.replace("index.html");
            return;
        }
        const [rol, perfil] = await Promise.all([
            window.obtenerRolLibreria(sesion.user.id),
            window.obtenerPerfilLibreria(sesion.user.id).catch(() => null)
        ]);
        const esPaginaAdmin = window.location.pathname.toLowerCase().endsWith("admin.html");
        if (esPaginaAdmin && rol !== "administrador") {
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
        window.location.replace("index.html?auth=error");
    }
}());

window.libreriaSupabase?.auth.onAuthStateChange(evento => {
    if (evento !== "SIGNED_OUT") return;
    sessionStorage.removeItem("libreria.usuario");
    window.libreriaSesion = null;
    window.libreriaUsuario = null;
    window.libreriaRol = null;
    window.location.replace("index.html");
});

