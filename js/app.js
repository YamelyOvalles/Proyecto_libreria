/** Navegación, cuenta y cierre de sesión. */

document.addEventListener("DOMContentLoaded", () => {
    // Control del menú responsivo.
    const menuToggle = document.querySelector(".menu-toggle");
    const siteNav = document.querySelector(".site-nav");

    function closeMenu() {
        if (!menuToggle || !siteNav) return;
        menuToggle.classList.remove("is-open");
        siteNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menú");
    }

    if (menuToggle && siteNav) {
        menuToggle.addEventListener("click", function () {
            const menuIsOpen = menuToggle.getAttribute("aria-expanded") === "true";
            menuToggle.classList.toggle("is-open", !menuIsOpen);
            siteNav.classList.toggle("is-open", !menuIsOpen);
            menuToggle.setAttribute("aria-expanded", String(!menuIsOpen));
            menuToggle.setAttribute("aria-label", menuIsOpen ? "Abrir menú" : "Cerrar menú");
        });

        siteNav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeMenu();
        });
    }

    // Adapta la navegación al rol autenticado.
    function agregarAccesoAdministrativo(rol) {
        const navList = document.querySelector(".nav-list");
        if (document.body.classList.contains("admin-page")) return;
        if (["administrador", "empleado"].includes(rol) && navList && !navList.querySelector('[href="admin.html"]')) {
            const item = document.createElement("li");
            const enlace = document.createElement("a");
            enlace.className = "nav-link nav-link-admin";
            enlace.href = "admin.html";
            enlace.textContent = "Panel de gestión";
            item.appendChild(enlace);
            navList.insertBefore(item, navList.lastElementChild);
        }
    }
    document.addEventListener("libreria:auth-lista", evento => agregarAccesoAdministrativo(evento.detail.rol));
    agregarAccesoAdministrativo(window.libreriaRol);

    function mostrarUsuarioAutenticado(sesion) {
        const usuario = sesion?.usuario || window.libreriaUsuario;
        const rol = sesion?.rol || window.libreriaRol;
        const nombre = sesion?.nombre || usuario?.email?.split("@")[0] || "Usuario";
        const itemCerrarSesion = document.querySelector("[data-logout]")?.closest("li");
        if (!usuario?.email || !itemCerrarSesion) return;

        if (itemCerrarSesion.dataset.accountMenu !== "ready") {
            const botonCerrar = itemCerrarSesion.querySelector("[data-logout]");
            const botonCuenta = document.createElement("button");
            const avatar = document.createElement("span");
            const nombreVisible = document.createElement("span");
            const flecha = document.createElement("span");
            const menuCuenta = document.createElement("div");
            const etiqueta = document.createElement("span");
            const nombreCompleto = document.createElement("strong");
            const correo = document.createElement("small");

            itemCerrarSesion.dataset.accountMenu = "ready";
            itemCerrarSesion.className = "account-menu";
            botonCuenta.type = "button";
            botonCuenta.className = "account-trigger";
            botonCuenta.setAttribute("aria-haspopup", "menu");
            botonCuenta.setAttribute("aria-expanded", "false");
            botonCuenta.setAttribute("aria-label", "Abrir opciones de usuario");
            avatar.className = "account-avatar";
            avatar.dataset.accountInitial = "";
            nombreVisible.className = "account-name";
            nombreVisible.dataset.accountName = "";
            flecha.className = "account-arrow";
            flecha.textContent = "▾";
            botonCuenta.append(avatar, nombreVisible, flecha);

            menuCuenta.className = "account-dropdown";
            menuCuenta.setAttribute("role", "menu");
            menuCuenta.hidden = true;
            etiqueta.className = "account-label";
            etiqueta.textContent = "Usuario";
            nombreCompleto.dataset.accountFullName = "";
            correo.dataset.accountEmail = "";
            botonCerrar.className = "account-logout";
            botonCerrar.setAttribute("role", "menuitem");
            botonCerrar.textContent = "Cerrar sesión";
            menuCuenta.append(etiqueta, nombreCompleto, correo, botonCerrar);
            itemCerrarSesion.replaceChildren(botonCuenta, menuCuenta);

            function cerrarMenuCuenta() {
                menuCuenta.hidden = true;
                botonCuenta.setAttribute("aria-expanded", "false");
            }

            botonCuenta.addEventListener("click", evento => {
                evento.stopPropagation();
                const abrir = menuCuenta.hidden;
                menuCuenta.hidden = !abrir;
                botonCuenta.setAttribute("aria-expanded", String(abrir));
            });
            document.addEventListener("click", evento => {
                if (!itemCerrarSesion.contains(evento.target)) cerrarMenuCuenta();
            });
            document.addEventListener("keydown", evento => {
                if (evento.key === "Escape") cerrarMenuCuenta();
            });
        }

        const nombresRol = { administrador: "Administrador", empleado: "Empleado", cliente: "Cliente" };
        const nombreRol = nombresRol[rol] || "Cliente";
        itemCerrarSesion.querySelector("[data-account-initial]").textContent = nombre.charAt(0).toUpperCase();
        itemCerrarSesion.querySelector("[data-account-name]").textContent = nombre;
        itemCerrarSesion.querySelector("[data-account-full-name]").textContent = `${nombre} · ${nombreRol}`;
        itemCerrarSesion.querySelector("[data-account-email]").textContent = usuario.email;
    }

    function mostrarNavegacionInvitado() {
        const itemCuenta = document.querySelector("[data-logout]")?.closest("li");
        if (!itemCuenta) return;
        const acceso = document.createElement("a");
        const registro = document.createElement("a");
        acceso.className = "nav-link";
        acceso.href = "login.html";
        acceso.textContent = "Iniciar sesión";
        registro.className = "button button-primary nav-register";
        registro.href = "login.html?registro=1";
        registro.textContent = "Registrarse";
        itemCuenta.className = "guest-actions";
        itemCuenta.replaceChildren(acceso, registro);
    }

    function actualizarCuenta(sesion) {
        if (sesion?.usuario) mostrarUsuarioAutenticado(sesion);
        else mostrarNavegacionInvitado();
    }

    document.addEventListener("libreria:auth-lista", evento => actualizarCuenta(evento.detail));
    if (window.libreriaAuthResuelta) actualizarCuenta(window.libreriaSesion);

    // Controla el cierre de sesión.
    document.querySelectorAll("[data-logout]").forEach(function (button) {
        button.addEventListener("click", async function () {
            button.disabled = true;
            try {
                await window.libreriaSupabase?.auth.signOut({ scope: "local" });
            } finally {
                sessionStorage.removeItem("libreria.auth");
                sessionStorage.removeItem("libreria.usuario");
                window.libreriaSesion = null;
                window.libreriaUsuario = null;
                window.libreriaRol = null;
                window.location.replace("informacion.html");
            }
        });
    });
});
