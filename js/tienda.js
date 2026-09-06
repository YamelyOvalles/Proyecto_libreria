/**
 * Librería Quisqueya - Controlador Dinámico del Catálogo y Carrito (Fase 2)
 * 
 * Cumplimiento del Requerimiento 1:
 * - Código en archivo externo .js enlazado a la página.
 * - Variables de diferentes tipos de datos: String, Number, Boolean, Array, Object.
 * - Arreglo de datos real aplicado al catálogo de libros.
 * 
 * Cumplimiento del Requerimiento 4:
 * - Componente interactivo dinámico: Catálogo con buscador en tiempo real,
 *   filtro por precio y carrito de compras desplegable con cálculo de totales.
 */

// =============================================================================
// VARIABLES Y TIPOS DE DATOS DEL PROYECTO (Requerimiento 1 de la Rúbrica)
// =============================================================================

// Variable de tipo String
const NOMBRE_COMERCIAL = "Librería Quisqueya";

// Variable de tipo Number
const MAX_ARTICULOS_POR_LINEA = 999;

// Variable de tipo Boolean
const MODO_CATALOGO_DISPONIBLE = true;

// Arreglo de objetos: Catálogo oficial de libros de la librería
const libros = [
    { 
        id: 1, 
        titulo: "Cien años de soledad", 
        autor: "Gabriel García Márquez", 
        precio: 1150, 
        imagen: "assets/portadas/cien-anos-de-soledad.jpg",
        disponible: true 
    },
    { 
        id: 2, 
        titulo: "El Principito", 
        autor: "Antoine de Saint-Exupéry", 
        precio: 750, 
        imagen: "assets/portadas/el-principito.jpg",
        disponible: true 
    },
    { 
        id: 3, 
        titulo: "1984", 
        autor: "George Orwell", 
        precio: 900, 
        imagen: "assets/portadas/1984.jpg",
        disponible: true 
    },
    { 
        id: 4, 
        titulo: "Don Quijote de la Mancha", 
        autor: "Miguel de Cervantes", 
        precio: 1350, 
        imagen: "assets/portadas/don-quijote.jpg",
        disponible: true 
    }
];

// Estado dinámico del carrito (Arreglo mutable de objetos)
let carrito = [];
let checkout = null;


// =============================================================================
// INICIALIZACIÓN Y MANIPULACIÓN DEL DOM
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a elementos del DOM
    const contenedorGrid = document.getElementById("book-grid");
    const elementoContador = document.getElementById("contador");
    const cartFloatBtn = document.getElementById("cart-float-btn");
    const cartSidebar = document.getElementById("cart-sidebar");
    const cartOverlay = document.getElementById("cart-overlay");
    const closeCartBtn = document.getElementById("close-cart");
    const cartBody = document.getElementById("cart-body");
    const cartBadge = document.getElementById("cart-badge");
    const cartTotalPrice = document.getElementById("cart-total-price");
    const campoBusqueda = document.getElementById("buscar-libros");
    const campoPrecio = document.getElementById("precio-maximo");

    /**
     * Renderiza las tarjetas de libros en la cuadrícula según los filtros aplicados.
     * Utiliza las funciones estructuradas de funciones.js: buscarLibrosPorTexto y filtrarLibrosPorPrecio.
     */
    function renderizarCatalogo() {
        // Filtrado dinámico en memoria
        const coincidencias = buscarLibrosPorTexto(libros, campoBusqueda.value);
        const precioMaximo = campoPrecio.value === "" ? Infinity : Number(campoPrecio.value);
        const librosVisibles = filtrarLibrosPorPrecio(coincidencias, precioMaximo);

        // Actualización reactiva del contador
        if (elementoContador) {
            elementoContador.textContent = `Mostrando ${librosVisibles.length} de ${libros.length} libros disponibles`;
        }

        if (contenedorGrid) {
            contenedorGrid.innerHTML = "";

            if (librosVisibles.length === 0) {
                contenedorGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--muted);">
                        <p style="font-size: 1.1rem; font-weight: 600;">No se encontraron libros que coincidan con tu búsqueda.</p>
                        <p style="font-size: 0.9rem;">Prueba ajustando el término de búsqueda o el límite de precio máximo.</p>
                    </div>
                `;
                return;
            }

            librosVisibles.forEach((libro, indice) => {
                const tarjeta = document.createElement("article");
                tarjeta.classList.add("book-card");
                tarjeta.style.setProperty("--card-delay", `${indice * 70}ms`);
                tarjeta.innerHTML = `
                    <div class="book-cover-frame">
                        <img src="${libro.imagen}" alt="Portada de ${libro.titulo}, de ${libro.autor}" class="book-cover" width="330" height="500" decoding="async">
                    </div>
                    <div class="book-info">
                        <p class="book-author">${libro.autor}</p>
                        <h2>${libro.titulo}</h2>
                        <p class="book-price">${formatearMonedaRD(libro.precio)}</p>
                        <button class="button button-primary button-full btn-add" type="button" data-id="${libro.id}">
                            Agregar al carrito
                        </button>
                    </div>
                `;
                contenedorGrid.appendChild(tarjeta);
            });

            // Asignación de eventos a los botones "Agregar al carrito"
            contenedorGrid.querySelectorAll(".btn-add").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = parseInt(e.target.getAttribute("data-id"), 10);
                    agregarAlCarrito(id);
                });
            });
        }
    }

    /**
     * Agrega un libro al carrito o incrementa su cantidad si ya existe.
     * @param {number} id - Identificador numérico del libro.
     */
    function agregarAlCarrito(id) {
        if (checkout?.estaOcupado()) return;

        const productoExistente = carrito.find(item => item.id === id);
        if (productoExistente) {
            if (productoExistente.cantidad >= MAX_ARTICULOS_POR_LINEA) return;
            productoExistente.cantidad++;
        } else {
            const libroEncontrado = libros.find(l => l.id === id);
            if (libroEncontrado) {
                carrito.push({ ...libroEncontrado, cantidad: 1 });
            }
        }

        actualizarCarritoUI();

        // Animación suave del badge numérico
        if (cartBadge && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            cartBadge.getAnimations().forEach(a => a.cancel());
            cartBadge.animate([
                { transform: "scale(1)" },
                { transform: "scale(1.3)" },
                { transform: "scale(1)" }
            ], { duration: 300, easing: "ease-out" });
        }

        abrirPanelCarrito();
    }

    /**
     * Modifica la cantidad de un producto (+1 o -1) en el carrito.
     * @param {number} id - Identificador del libro.
     * @param {number} cambio - Variación (+1 o -1).
     */
    function cambiarCantidad(id, cambio) {
        if (checkout?.estaOcupado()) return;

        const producto = carrito.find(item => item.id === id);
        if (producto) {
            if (producto.cantidad + cambio > MAX_ARTICULOS_POR_LINEA) return;
            producto.cantidad += cambio;

            // Si la cantidad llega a 0, se remueve el producto
            if (producto.cantidad <= 0) {
                carrito = carrito.filter(item => item.id !== id);
            }
            actualizarCarritoUI();
        }
    }

    /**
     * Sincroniza la interfaz del panel lateral del carrito con el arreglo en memoria.
     * Hace uso de las funciones estructuradas obtenerCantidadArticulos y obtenerMontoTotal.
     */
    function actualizarCarritoUI() {
        const totalItems = obtenerCantidadArticulos(carrito);
        if (cartBadge) cartBadge.textContent = totalItems;

        const totalMonto = obtenerMontoTotal(carrito);
        if (cartTotalPrice) cartTotalPrice.textContent = formatearMonedaRD(totalMonto);

        if (!cartBody) return;

        if (carrito.length === 0) {
            cartBody.innerHTML = `<p class="empty-cart-msg">Tu carrito de compras está vacío actualmente.</p>`;
        } else {
            cartBody.innerHTML = "";
            carrito.forEach(item => {
                const itemDiv = document.createElement("div");
                itemDiv.classList.add("cart-item");
                itemDiv.innerHTML = `
                    <img class="cart-item-cover" src="${item.imagen}" alt="Portada" width="42" height="64">
                    <div class="cart-item-details">
                        <h4>${item.titulo}</h4>
                        <p>${formatearMonedaRD(item.precio)} x ${item.cantidad}</p>
                    </div>
                    <div class="cart-item-controls">
                        <button class="btn-qty btn-restar" data-id="${item.id}" aria-label="Restar una unidad">-</button>
                        <span>${item.cantidad}</span>
                        <button class="btn-qty btn-sumar" data-id="${item.id}" aria-label="Sumar una unidad">+</button>
                    </div>
                `;
                cartBody.appendChild(itemDiv);
            });

            // Asignar listeners a los botones de incremento y decremento
            cartBody.querySelectorAll(".btn-restar").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = parseInt(e.target.getAttribute("data-id"), 10);
                    cambiarCantidad(id, -1);
                });
            });

            cartBody.querySelectorAll(".btn-sumar").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = parseInt(e.target.getAttribute("data-id"), 10);
                    cambiarCantidad(id, 1);
                });
            });
        }
    }

    // Controles de visibilidad del panel lateral del carrito
    function abrirPanelCarrito() {
        if (cartSidebar) cartSidebar.classList.add("open");
        if (cartOverlay) cartOverlay.classList.add("active");
    }

    function cerrarPanelCarrito() {
        if (cartSidebar) cartSidebar.classList.remove("open");
        if (cartOverlay) cartOverlay.classList.remove("active");
    }

    if (cartFloatBtn) cartFloatBtn.addEventListener("click", abrirPanelCarrito);
    if (closeCartBtn) closeCartBtn.addEventListener("click", cerrarPanelCarrito);
    if (cartOverlay) cartOverlay.addEventListener("click", cerrarPanelCarrito);

    // Inicializar el gestor de checkout integrado
    if (typeof window.crearCheckout === "function") {
        checkout = window.crearCheckout({
            obtenerCarrito: () => carrito,
            vaciarCarrito: productosConfirmados => {
                carrito = carrito.map(item => {
                    const confirmado = productosConfirmados.find(p => p.id === item.id);
                    return { ...item, cantidad: item.cantidad - (confirmado?.cantidad || 0) };
                }).filter(item => item.cantidad > 0);
                actualizarCarritoUI();
            }
        });
    }

    // Eventos de filtrado en vivo en los campos de entrada
    if (campoBusqueda) campoBusqueda.addEventListener("input", renderizarCatalogo);
    if (campoPrecio) campoPrecio.addEventListener("input", renderizarCatalogo);

    // Renderizado inicial
    renderizarCatalogo();
    actualizarCarritoUI();
});

