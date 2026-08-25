// Menú compacto para teléfonos.
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

// Cierra tanto la sesión temporal como la recordada.
document.querySelectorAll("[data-logout]").forEach(function (button) {
    button.addEventListener("click", function () {
        sessionStorage.removeItem("libreriaSession");
        localStorage.removeItem("libreriaSession");
        window.location.replace("index.html");
    });
});

// Interacción provisional del catálogo mientras no exista un carrito real.
const toast = document.querySelector("#toast");
let toastTimer;

document.querySelectorAll("[data-book]").forEach(function (button) {
    button.addEventListener("click", function () {
        if (!toast) return;

        toast.textContent = `${button.dataset.book} fue agregado al carrito.`;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove("show");
        }, 2600);
    });
});

// El formulario se mantiene local hasta que el proyecto tenga un servidor.
const contactForm = document.querySelector("#contact-form");

if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const contactMessage = document.querySelector("#contact-message");
        contactMessage.textContent = "Mensaje preparado correctamente. Gracias por escribirnos.";
        contactForm.reset();
    });
}
