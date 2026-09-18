/** Catálogo y carrito persistente respaldados por Supabase. */
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
    const total = document.getElementById("cart-total-price");

    let libros = [];
    let carrito = [];
    let carritoId = null;
    let checkout = null;
    let focoAnterior = null;
    let usuarioActual = null;

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

    function calcularTotalCarrito() {
        return carrito.reduce((acumulado, item) => {
            const bruto = Number(item.precio_lista) * Number(item.cantidad);
            const descuento = Math.round(bruto * Number(item.descuento_pct || 0)) / 100;
            return acumulado + bruto - descuento;
        }, 0);
    }

    async function cargarCatalogo() {
        let resultado = await window.libreriaSupabase
            .from("libros")
            .select("id,isbn,titulo,descripcion,precio,descuento_pct,formato,idioma,imagen_portada,inventarios(cantidad_disponible),libro_autor(autores(nombre))")
            .eq("activo", true)
            .order("titulo");

        if (resultado.error) {
            resultado = await window.libreriaSupabase
                .from("libros")
                .select("id,isbn,titulo,descripcion,precio,formato,idioma,imagen_portada,inventarios(cantidad_disponible),libro_autor(autores(nombre))")
                .eq("activo", true)
                .order("titulo");
        }

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

    async function obtenerCarrito(usuarioId) {
        let { data, error } = await window.libreriaSupabase
            .from("carritos").select("id").eq("perfil_id", usuarioId).maybeSingle();
        if (error) throw error;
        if (!data) {
            const resultado = await window.libreriaSupabase
                .from("carritos").insert({ perfil_id: usuarioId }).select("id").single();
            if (resultado.error) throw resultado.error;
            data = resultado.data;
        }
        carritoId = data.id;

        const detalles = await window.libreriaSupabase
            .from("carrito_detalles").select("libro_id,cantidad").eq("carrito_id", carritoId);
        if (detalles.error) throw detalles.error;
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
        if (cantidad <= 0) {
            const { error } = await window.libreriaSupabase.from("carrito_detalles")
                .delete().eq("carrito_id", carritoId).eq("libro_id", libroId);
            if (error) throw error;
            return;
        }
        const { error } = await window.libreriaSupabase.from("carrito_detalles").upsert({
            carrito_id: carritoId, libro_id: libroId, cantidad
        }, { onConflict: "carrito_id,libro_id" });
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
        total.textContent = formatearMonedaRD(calcularTotalCarrito());
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
        await obtenerCarrito(usuarioActual.id);
        renderizarCarrito();
        checkout = window.crearCheckout({
            obtenerCarrito: () => carrito,
            vaciarCarrito: () => { carrito = []; renderizarCarrito(); }
        });
    } catch (error) {
        mostrarError(error, "No se pudo cargar la tienda.");
    }
});
