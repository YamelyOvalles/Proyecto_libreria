/**
 * Librería Quisqueya - Funcionalidades Globales de Navegación (Fase 2)
 * Maneja el menú responsivo, cierre de sesión y la adaptación del menú según el rol.
 */

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------------------
    // 1. CONTROL DEL MENÚ RESPONSIVO PARA MÓVILES
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // 2. ADAPTACIÓN DE LA NAVEGACIÓN SEGÚN EL ROL AUTENTICADO
    // -------------------------------------------------------------------------
    const currentRole = sessionStorage.getItem("libreriaRole") || localStorage.getItem("libreriaRole");
    const navList = document.querySelector(".nav-list");

    // Si el usuario autenticado es administrador y está navegando en páginas públicas,
    // se agrega un acceso directo al Panel Operativo en el menú
    if (currentRole === "admin" && navList) {
        const yaTieneEnlaceAdmin = navList.querySelector('a[href="admin.html"]');
        if (!yaTieneEnlaceAdmin) {
            const adminLi = document.createElement("li");
            adminLi.innerHTML = `
                <a class="nav-link" href="admin.html" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);">
                    Panel Admin
                </a>
            `;
            // Insertar antes del botón de cerrar sesión
            const logoutLi = navList.querySelector("li:last-child");
            if (logoutLi) {
                navList.insertBefore(adminLi, logoutLi);
            } else {
                navList.appendChild(adminLi);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 3. CONTROL DE CIERRE DE SESIÓN
    // -------------------------------------------------------------------------
    document.querySelectorAll("[data-logout]").forEach(function (button) {
        button.addEventListener("click", function () {
            sessionStorage.removeItem("libreriaSession");
            sessionStorage.removeItem("libreriaRole");
            sessionStorage.removeItem("libreriaUser");
            localStorage.removeItem("libreriaSession");
            localStorage.removeItem("libreriaRole");
            localStorage.removeItem("libreriaUser");
            window.location.replace("index.html");
        });
    });
});