// Catálogo y carrito.
document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("book-grid");
    const contador = document.getElementById("contador");
    const buscar = document.getElementById("buscar-libros");
    const precio = document.getElementById("precio-maximo");
    const panel = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    const abrir = document.getElementById("cart-float-btn");
    const cerrar = document.getElementById("close-cart");
    const cuerpo = document.getElementById("cart-body");
    const badge = document.getElementById("cart-badge");
    const subtotal = document.getElementById("cart-subtotal-price");
    const impuesto = document.getElementById("cart-tax-price");
    const etiquetaImpuesto = document.getElementById("cart-tax-label");
    const total = document.getElementById("cart-total-price");

    let libros = [];
    let carrito = [];
    let checkout = null;
    let focoAnterior = null;
    let usuarioActual = null;
    let aplicarItbis = true;
    let itbisPct = 18;

    function texto(tag, contenido, clase) {
        const nodo = document.createElement(tag);
        if (clase) nodo.className = clase;
        nodo.textContent = contenido;
        return nodo;
    }

    function mostrarError(error, alternativo) {
        contador.textContent = window.mensajeErrorSupabase(error, alternativo);
        contador.classList.add("form-message");
    }

    function calcularSubtotalCarrito() {
        return carrito.reduce((acumulado, item) => {
            const bruto = Number(item.precio_lista) * Number(item.cantidad);
            const descuento = Math.round(bruto * Number(item.descuento_pct || 0)) / 100;
            return acumulado + bruto - descuento;
        }, 0);
    }

    function calcularItbisCarrito(subtotalCarrito) {
        if (!aplicarItbis || itbisPct <= 0) return 0;
        return Math.round(subtotalCarrito * itbisPct) / 100;
    }

    async function cargarConfiguracionImpuestos() {
        const { data, error } = await window.libreriaApi("/api/catalogo/impuestos");
        if (error) throw error;
        aplicarItbis = Boolean(data.cotizacion_mostrar_itbis);
        itbisPct = Number(data.cotizacion_itbis_pct) || 0;
    }

    async function cargarCatalogo() {
        const resultado = await window.libreriaApi("/api/catalogo");

        if (resultado.error) throw resultado.error;
        libros = (resultado.data || []).map(libro => {
            const inventario = Array.isArray(libro.inventarios) ? libro.inventarios[0] : libro.inventarios;
            const descuento = Number(libro.descuento_pct || 0);
            return {
                ...libro,
                descuento_pct: descuento,
                precio_lista: Number(libro.precio),
                precio: Math.round(Number(libro.precio) * (1 - descuento / 100) * 100) / 100,
                autor: libro.libro_autor?.map(relacion => relacion.autores?.nombre).filter(Boolean).join(", ") || "Autor no indicado",
                disponible: Number(inventario?.cantidad_disponible || 0)
            };
        });
    }

    async function obtenerCarrito() {
        const { data, error } = await window.libreriaApi("/api/carrito");
        if (error) throw error;
        const detalles = { data: data.items };
        carrito = detalles.data.map(item => {
            const libro = libros.find(actual => actual.id === item.libro_id);
            return libro ? { ...libro, cantidad: item.cantidad } : null;
        }).filter(Boolean);
    }

    function renderizarCatalogo() {
        const termino = buscar.value.trim().toLowerCase();
        const limite = precio.value === "" ? Infinity : Number(precio.value);
        const visibles = libros.filter(libro =>
            (libro.titulo.toLowerCase().includes(termino) || libro.autor.toLowerCase().includes(termino)) &&
            libro.precio <= limite
        );
        contador.textContent = `Mostrando ${visibles.length} de ${libros.length} libros`;
        grid.replaceChildren();

        if (!visibles.length) {
            grid.appendChild(texto("p", "No se encontraron libros con esos filtros.", "empty-cart-msg"));
            return;
        }

        visibles.forEach((libro, indice) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "book-card";
            tarjeta.style.setProperty("--card-delay", `${indice * 70}ms`);
            const marco = document.createElement("div");
            marco.className = "book-cover-frame";
            const imagen = document.createElement("img");
            imagen.className = "book-cover";
            imagen.src = libro.imagen_portada || "assets/logo-quisqueya-icono.png";
            imagen.alt = `Portada de ${libro.titulo}`;
            imagen.width = 330;
            imagen.height = 500;
            marco.appendChild(imagen);
            const info = document.createElement("div");
            info.className = "book-info";
            info.append(texto("p", libro.autor, "book-author"), texto("h2", libro.titulo));
            if (Number(libro.descuento_pct) > 0) {
                const precioOferta = document.createElement("div");
                precioOferta.className = "book-offer";
                precioOferta.append(
                    texto("span", formatearMonedaRD(libro.precio_lista), "book-price-old"),
                    texto("p", formatearMonedaRD(libro.precio), "book-price"),
                    texto("span", `-${Number(libro.descuento_pct)}%`, "book-discount")
                );
                info.appendChild(precioOferta);
            } else {
                info.appendChild(texto("p", formatearMonedaRD(libro.precio), "book-price"));
            }
            info.appendChild(texto("p", libro.disponible > 0 ? `${libro.disponible} disponible(s)` : "Agotado", "book-stock"));
            const boton = texto(
                "button",
                libro.disponible < 1
                    ? "Agotado"
                    : usuarioActual ? "Agregar al carrito" : "Inicia sesión para comprar",
                "button button-primary button-full btn-add"
            );
            boton.type = "button";
            boton.disabled = libro.disponible < 1;
            boton.addEventListener("click", () => {
                if (!usuarioActual) window.location.href = "login.html?next=tienda.html";
                else agregar(libro);
            });
            info.appendChild(boton);
            tarjeta.append(marco, info);
            grid.appendChild(tarjeta);
        });
    }

    async function guardarCantidad(libroId, cantidad) {
        const { error } = await window.libreriaApi("/api/carrito/items/" + libroId, { method: "PUT", body: { cantidad: Math.max(0, cantidad) } });
        if (error) throw error;
    }

    async function agregar(libro) {
        if (checkout?.estaOcupado()) return;
        const existente = carrito.find(item => item.id === libro.id);
        const cantidad = (existente?.cantidad || 0) + 1;
        if (cantidad > libro.disponible) return mostrarError(null, "No hay más unidades disponibles.");
        try {
            await guardarCantidad(libro.id, cantidad);
            if (existente) existente.cantidad = cantidad;
            else carrito.push({ ...libro, cantidad: 1 });
            renderizarCarrito();
            abrirPanel();
        } catch (error) {
            mostrarError(error, "No se pudo actualizar el carrito.");
        }
    }

    async function cambiarCantidad(libroId, cambio) {
        const item = carrito.find(actual => actual.id === libroId);
        if (!item || checkout?.estaOcupado()) return;
        const nueva = item.cantidad + cambio;
        if (nueva > item.disponible) return;
        try {
            await guardarCantidad(libroId, nueva);
            if (nueva <= 0) carrito = carrito.filter(actual => actual.id !== libroId);
            else item.cantidad = nueva;
            renderizarCarrito();
        } catch (error) {
            mostrarError(error, "No se pudo actualizar el carrito.");
        }
    }

    function renderizarCarrito() {
        badge.textContent = obtenerCantidadArticulos(carrito);
        const subtotalCarrito = calcularSubtotalCarrito();
        const itbisCarrito = calcularItbisCarrito(subtotalCarrito);
        subtotal.textContent = formatearMonedaRD(subtotalCarrito);
        impuesto.textContent = formatearMonedaRD(itbisCarrito);
        etiquetaImpuesto.textContent = `ITBIS (${itbisPct}%):`;
        total.textContent = formatearMonedaRD(subtotalCarrito + itbisCarrito);
        cuerpo.replaceChildren();
        if (!carrito.length) {
            cuerpo.appendChild(texto("p", "Tu carrito está vacío.", "empty-cart-msg"));
            return;
        }
        carrito.forEach(item => {
            const fila = document.createElement("div");
            fila.className = "cart-item";
            const imagen = document.createElement("img");
            imagen.className = "cart-item-cover";
            imagen.src = item.imagen_portada || "assets/logo-quisqueya-icono.png";
            imagen.alt = "";
            imagen.width = 42;
            imagen.height = 64;
            const detalle = document.createElement("div");
            detalle.className = "cart-item-details";
            detalle.append(texto("h4", item.titulo), texto("p", `${formatearMonedaRD(item.precio)} × ${item.cantidad}`));
            const controles = document.createElement("div");
            controles.className = "cart-item-controls";
            const restar = texto("button", "−", "btn-qty");
            const sumar = texto("button", "+", "btn-qty");
            restar.type = sumar.type = "button";
            restar.setAttribute("aria-label", `Restar ${item.titulo}`);
            sumar.setAttribute("aria-label", `Sumar ${item.titulo}`);
            restar.addEventListener("click", () => cambiarCantidad(item.id, -1));
            sumar.addEventListener("click", () => cambiarCantidad(item.id, 1));
            controles.append(restar, texto("span", String(item.cantidad)), sumar);
            fila.append(imagen, detalle, controles);
            cuerpo.appendChild(fila);
        });
    }

    function abrirPanel() {
        focoAnterior = document.activeElement;
        panel.classList.add("open");
        overlay.classList.add("active");
        panel.setAttribute("aria-hidden", "false");
        cerrar.focus();
    }

    function cerrarPanel() {
        panel.classList.remove("open");
        overlay.classList.remove("active");
        panel.setAttribute("aria-hidden", "true");
        focoAnterior?.focus();
    }

    abrir.addEventListener("click", abrirPanel);
    cerrar.addEventListener("click", cerrarPanel);
    overlay.addEventListener("click", cerrarPanel);
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape" && panel.classList.contains("open")) cerrarPanel();
    });
    buscar.addEventListener("input", renderizarCatalogo);
    precio.addEventListener("input", renderizarCatalogo);

    try {
        if (!window.libreriaSupabase) throw new Error("Supabase no está configurado.");
        const sesion = await window.obtenerSesionLibreria();
        usuarioActual = sesion?.user || null;
        await cargarCatalogo();
        renderizarCatalogo();
        if (!usuarioActual) {
            abrir.hidden = true;
            return;
        }
        await cargarConfiguracionImpuestos();
        await obtenerCarrito();
        renderizarCarrito();
        checkout = window.crearCheckout({
            obtenerCarrito: () => carrito,
            vaciarCarrito: () => { carrito = []; renderizarCarrito(); }
        });
    } catch (error) {
        mostrarError(error, "No se pudo cargar la tienda.");
    }
});
