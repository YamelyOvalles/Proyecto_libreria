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
// ==========================================
// VARIABLES Y ARREGLO DEL CATÁLOGO
// ==========================================

// Variable de tipo String
let nombreLibreria = "Librería Quisqueya";

// Variable de tipo Number
let cantidadLibros = 4;

// Variable de tipo Boolean
let catalogoActivo = true;

// Arreglo de objetos aplicado al catálogo de libros
let catalogoLibros = [
    {
        titulo: "Cien años de soledad",
        autor: "Gabriel García Márquez",
        precio: 1150,
        disponible: true
    },
    {
        titulo: "El Principito",
        autor: "Antoine de Saint-Exupéry",
        precio: 750,
        disponible: true
    },
    {
        titulo: "1984",
        autor: "George Orwell",
        precio: 900,
        disponible: true
    },
    {
        titulo: "Don Quijote de la Mancha",
        autor: "Miguel de Cervantes",
        precio: 1350,
        disponible: true
    }
];

// Mostrar los datos en la consola
console.log("Nombre de la librería:", nombreLibreria);
console.log("Cantidad de libros:", cantidadLibros);
console.log("Catálogo activo:", catalogoActivo);
console.log("Catálogo de libros:", catalogoLibros);