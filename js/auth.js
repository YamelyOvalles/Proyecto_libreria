/**
 * Librería Quisqueya - Control de Acceso y Autorización por Roles
 * Se ejecuta en el <head> para proteger las páginas antes de renderizar el DOM.
 * Verifica la existencia de una sesión activa y autoriza según el perfil (cliente o admin).
 */
(function protectPage() {
    // Comprobar si existe sesión activa en almacenamiento de sesión o local
    const hasSession = sessionStorage.getItem("libreriaSession") === "active";
    const isRemembered = localStorage.getItem("libreriaSession") === "active";
    const isAuthenticated = hasSession || isRemembered;

    // 1. Si no hay sesión iniciada, redirigir a la pantalla de login
    if (!isAuthenticated) {
        window.location.replace("index.html");
        return;
    }

    // Obtener el rol actual del usuario autenticado
    const currentRole = sessionStorage.getItem("libreriaRole") || localStorage.getItem("libreriaRole") || "cliente";
    const currentPath = window.location.pathname.toLowerCase();

    // 2. Proteger la vista administrativa: solo usuarios con rol 'admin' pueden ingresar
    const isTryingAdmin = currentPath.endsWith("admin.html") || currentPath.includes("admin.html");
    if (isTryingAdmin && currentRole !== "admin") {
        // Un cliente que intente acceder al panel operativo es redirigido al catálogo de la tienda
        window.location.replace("tienda.html");
    }
}());

