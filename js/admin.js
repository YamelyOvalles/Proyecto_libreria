/** Panel administrativo conectado a Supabase y protegido por RLS. */
document.addEventListener("DOMContentLoaded", async () => {
    const tbody = document.getElementById("orders-table-body");
    const busqueda = document.getElementById("admin-search-input");
    const filtro = document.getElementById("admin-status-filter");
    const refrescar = document.getElementById("admin-refresh-btn");
    const feedback = document.getElementById("admin-feedback");
    const formularioLibro = document.getElementById("book-form");
    const cuerpoLibros = document.getElementById("books-table-body");
    const feedbackLibro = document.getElementById("book-feedback");
    const botonGuardarLibro = document.getElementById("book-save-btn");
    const botonCancelarLibro = document.getElementById("book-cancel-btn");
    let pedidos = [];
    let libros = [];

    function nodo(tag, contenido, clase) {
        const elemento = document.createElement(tag);
        if (clase) elemento.className = clase;
        if (contenido !== undefined) elemento.textContent = contenido;
        return elemento;
    }

    function botonIcono(tipo, etiqueta) {
        const rutas = {
            editar: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z",
            eliminar: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3.46-8.12 1.41-1.41L12 10.59l1.12-1.12 1.41 1.41L13.41 12l1.12 1.12-1.41 1.41L12 13.41l-1.12 1.12-1.41-1.41L10.59 12l-1.13-1.12ZM15.5 4l-1-1h-5l-1 1H5v2h14V4h-3.5Z"
        };
        const boton = document.createElement("button");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const ruta = document.createElementNS("http://www.w3.org/2000/svg", "path");
        boton.type = "button";
        boton.className = `icon-button icon-button-${tipo}`;
        boton.setAttribute("aria-label", etiqueta);
        boton.title = etiqueta;
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        ruta.setAttribute("d", rutas[tipo]);
        svg.appendChild(ruta);
        boton.appendChild(svg);
        return boton;
    }

    async function cargarPedidos() {
        refrescar.disabled = true;
        const { data, error } = await window.libreriaSupabase
            .from("pedidos")
            .select("id,numero,cliente_nombre,cliente_correo,metodo_entrega,metodo_pago,estado_pago,estado,subtotal,costo_envio,total,creado_en,pedido_detalles(libro_id,titulo,cantidad,precio_unitario,subtotal)")
            .order("creado_en", { ascending: false });
        refrescar.disabled = false;
        if (error) throw error;
        pedidos = data;
        actualizarMetricas();
        aplicarFiltros();
    }

    function actualizarMetricas() {
        const pagados = pedidos.filter(pedido => pedido.estado_pago === "pagado");
        const despachados = pedidos.filter(pedido => ["enviado", "entregado"].includes(pedido.estado));
        document.getElementById("metric-total-orders").textContent = pedidos.length;
        document.getElementById("metric-total-revenue").textContent = formatearMonedaRD(
            pagados.reduce((suma, pedido) => suma + Number(pedido.total), 0)
        );
        document.getElementById("metric-pending-orders").textContent = pedidos.filter(pedido => pedido.estado === "pendiente").length;
        document.getElementById("metric-total-units").textContent = despachados.reduce((suma, pedido) =>
            suma + pedido.pedido_detalles.reduce((cantidad, detalle) => cantidad + detalle.cantidad, 0), 0);
    }

    async function actualizarPedido(id, cambios) {
        const cambioEstado = Object.prototype.hasOwnProperty.call(cambios, "estado");
        const resultado = cambioEstado
            ? await window.libreriaSupabase.rpc("actualizar_estado_pedido", { p_pedido_id: id, p_estado: cambios.estado })
            : await window.libreriaSupabase.from("pedidos").update(cambios).eq("id", id);
        const { error } = resultado;
        if (error) throw error;
        const pedido = pedidos.find(item => item.id === id);
        Object.assign(pedido, cambios);
        actualizarMetricas();
    }

    function crearSelector(valor, opciones, etiqueta, onChange, titulo) {
        const control = document.createElement("label");
        const nombreControl = document.createElement("span");
        const select = document.createElement("select");
        control.className = "status-control";
        nombreControl.textContent = titulo;
        select.className = "status-select";
        select.setAttribute("aria-label", etiqueta);
        opciones.forEach(([codigo, nombre]) => select.add(new Option(nombre, codigo, false, codigo === valor)));
        select.addEventListener("change", async () => {
            select.disabled = true;
            try { await onChange(select.value); }
            catch (error) {
                feedback.textContent = window.mensajeErrorSupabase(error, "No se pudo actualizar el pedido.");
                await cargarPedidos();
            } finally { select.disabled = false; }
        });
        control.append(nombreControl, select);
        return control;
    }

    function etiquetaEstado(valor) {
        return valor.replaceAll("_", " ").replace(/^./, letra => letra.toUpperCase());
    }

    function renderizar(lista) {
        tbody.replaceChildren();
        if (!lista.length) {
            const fila = document.createElement("tr");
            const celda = nodo("td", "No se encontraron pedidos.");
            celda.colSpan = 7;
            celda.className = "table-empty";
            fila.appendChild(celda);
            tbody.appendChild(fila);
            return;
        }

        lista.forEach(pedido => {
            const fila = document.createElement("tr");
            fila.appendChild(nodo("td", pedido.numero));
            fila.appendChild(nodo("td", new Date(pedido.creado_en).toLocaleString("es-DO")));
            const cliente = document.createElement("td");
            cliente.append(nodo("strong", pedido.cliente_nombre), nodo("small", pedido.cliente_correo));
            fila.appendChild(cliente);
            const detalleCelda = document.createElement("td");
            const listaLibros = document.createElement("ul");
            listaLibros.className = "order-items-list";
            pedido.pedido_detalles.forEach(item => listaLibros.appendChild(
                nodo("li", `${item.cantidad}× ${item.titulo} (${formatearMonedaRD(item.subtotal)})`)
            ));
            detalleCelda.appendChild(listaLibros);
            fila.appendChild(detalleCelda);
            fila.appendChild(nodo("td", formatearMonedaRD(pedido.total)));

            const estados = document.createElement("td");
            estados.className = "order-statuses";
            estados.append(
                nodo("span", `Pedido: ${etiquetaEstado(pedido.estado)}`, `badge-status badge-${pedido.estado}`),
                nodo("span", `Pago: ${etiquetaEstado(pedido.estado_pago)}`, `badge-status badge-pago-${pedido.estado_pago}`)
            );
            fila.appendChild(estados);

            const acciones = document.createElement("td");
            acciones.className = "order-actions";
            acciones.append(
                crearSelector(pedido.estado, [
                    ["pendiente", "Pendiente"], ["confirmado", "Confirmado"],
                    ["procesando", "Procesando"], ["listo_retiro", "Listo para retiro"],
                    ["enviado", "Enviado"], ["entregado", "Entregado"], ["cancelado", "Cancelado"]
                ], `Estado del pedido ${pedido.numero}`, estado => actualizarPedido(pedido.id, { estado }), "Pedido"),
                crearSelector(pedido.estado_pago, [
                    ["pendiente", "Pago pendiente"], ["verificando", "Verificando pago"],
                    ["pagado", "Pagado"], ["rechazado", "Pago rechazado"], ["reembolsado", "Reembolsado"]
                ], `Estado de pago ${pedido.numero}`, estado_pago => actualizarPedido(pedido.id, { estado_pago }), "Pago")
            );
            fila.appendChild(acciones);
            tbody.appendChild(fila);
        });
    }

    function aplicarFiltros() {
        const texto = busqueda.value.trim().toLowerCase();
        renderizar(pedidos.filter(pedido =>
            (filtro.value === "todos" || pedido.estado === filtro.value) &&
            (!texto || [pedido.numero, pedido.cliente_nombre, pedido.cliente_correo]
                .some(valor => valor?.toLowerCase().includes(texto)))
        ));
    }

    busqueda.addEventListener("input", aplicarFiltros);
    filtro.addEventListener("change", aplicarFiltros);
    refrescar.addEventListener("click", () => cargarPedidos().catch(error => {
        tbody.replaceChildren(nodo("tr", window.mensajeErrorSupabase(error)));
    }));

    function inventarioDe(libro) {
        return Array.isArray(libro.inventarios) ? libro.inventarios[0] : libro.inventarios;
    }

    function autorDe(libro) {
        return libro.libro_autor?.map(relacion => relacion.autores?.nombre)
            .filter(Boolean).join(", ") || "";
    }

    function informarLibro(texto, exito = false) {
        feedbackLibro.textContent = texto;
        feedbackLibro.classList.toggle("success-message", exito);
    }

    function limpiarFormularioLibro() {
        formularioLibro.reset();
        document.getElementById("book-id").value = "";
        document.getElementById("book-language").value = "Español";
        document.getElementById("book-active").checked = true;
        botonGuardarLibro.textContent = "Guardar libro";
        botonCancelarLibro.hidden = true;
    }

    async function cargarLibros() {
        const { data, error } = await window.libreriaSupabase
            .from("libros")
            .select("id,isbn,titulo,descripcion,precio,formato,idioma,imagen_portada,activo,inventarios(cantidad_existencia,cantidad_reservada,cantidad_disponible),libro_autor(autores(nombre))")
            .order("titulo");
        if (error) throw error;
        libros = data;
        renderizarLibros();
    }

    function editarLibro(libro) {
        const inventario = inventarioDe(libro);
        document.getElementById("book-id").value = libro.id;
        document.getElementById("book-isbn").value = libro.isbn || "";
        document.getElementById("book-title").value = libro.titulo;
        document.getElementById("book-author").value = autorDe(libro);
        document.getElementById("book-price").value = Number(libro.precio).toFixed(2);
        document.getElementById("book-stock").value = inventario?.cantidad_existencia ?? 0;
        document.getElementById("book-format").value = libro.formato;
        document.getElementById("book-language").value = libro.idioma;
        document.getElementById("book-image").value = libro.imagen_portada || "";
        document.getElementById("book-description").value = libro.descripcion || "";
        document.getElementById("book-active").checked = libro.activo;
        botonGuardarLibro.textContent = "Actualizar libro";
        botonCancelarLibro.hidden = false;
        informarLibro(`Editando “${libro.titulo}”.`);
        formularioLibro.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function eliminarLibro(libro) {
        const confirmado = window.confirm(
            `¿Eliminar definitivamente “${libro.titulo}”? Esta acción no se puede deshacer.`
        );
        if (!confirmado) return;

        informarLibro("Eliminando libro…");
        const { error } = await window.libreriaSupabase
            .rpc("eliminar_libro_admin", { p_libro_id: libro.id });
        if (error) throw error;
        if (document.getElementById("book-id").value === String(libro.id)) limpiarFormularioLibro();
        await cargarLibros();
        informarLibro("Libro eliminado correctamente.", true);
    }

    function renderizarLibros() {
        cuerpoLibros.replaceChildren();
        if (!libros.length) {
            const fila = document.createElement("tr");
            const celda = nodo("td", "No hay libros registrados.", "table-empty");
            celda.colSpan = 6;
            fila.appendChild(celda);
            cuerpoLibros.appendChild(fila);
            return;
        }

        libros.forEach(libro => {
            const inventario = inventarioDe(libro);
            const fila = document.createElement("tr");
            fila.appendChild(nodo("td", libro.isbn || "—"));

            const detalle = document.createElement("td");
            detalle.append(nodo("strong", libro.titulo), nodo("small", autorDe(libro) || "Autor no indicado"));
            fila.appendChild(detalle);
            fila.appendChild(nodo("td", formatearMonedaRD(Number(libro.precio))));
            fila.appendChild(nodo("td", `${inventario?.cantidad_disponible ?? 0} disponible(s)`));
            fila.appendChild(nodo("td", libro.activo ? "Activo" : "Inactivo",
                `badge-status ${libro.activo ? "badge-activo" : "badge-inactivo"}`));

            const acciones = document.createElement("td");
            acciones.className = "crud-row-actions";
            const editar = botonIcono("editar", `Editar ${libro.titulo}`);
            editar.addEventListener("click", () => editarLibro(libro));
            const eliminar = botonIcono("eliminar", `Eliminar ${libro.titulo}`);
            eliminar.addEventListener("click", () => eliminarLibro(libro).catch(error => {
                informarLibro(window.mensajeErrorSupabase(error, "No se pudo eliminar el libro."));
            }));
            acciones.append(editar, eliminar);
            fila.appendChild(acciones);
            cuerpoLibros.appendChild(fila);
        });
    }

    formularioLibro.addEventListener("submit", async evento => {
        evento.preventDefault();
        informarLibro("");
        if (!formularioLibro.reportValidity()) return;

        const existencia = Number(document.getElementById("book-stock").value);
        const precioLibro = Number(document.getElementById("book-price").value);
        if (!Number.isInteger(existencia) || existencia < 0 || !Number.isFinite(precioLibro) || precioLibro < 0) {
            return informarLibro("Revisa el precio y la existencia.");
        }

        botonGuardarLibro.disabled = true;
        try {
            const identificador = document.getElementById("book-id").value;
            const { error } = await window.libreriaSupabase.rpc("guardar_libro_admin", {
                p_libro_id: identificador ? Number(identificador) : null,
                p_isbn: document.getElementById("book-isbn").value,
                p_titulo: document.getElementById("book-title").value,
                p_autor: document.getElementById("book-author").value,
                p_descripcion: document.getElementById("book-description").value,
                p_precio: precioLibro,
                p_formato: document.getElementById("book-format").value,
                p_idioma: document.getElementById("book-language").value,
                p_imagen_portada: document.getElementById("book-image").value,
                p_existencia: existencia,
                p_activo: document.getElementById("book-active").checked
            });
            if (error) throw error;

            const mensaje = identificador ? "Libro actualizado correctamente." : "Libro creado correctamente.";
            limpiarFormularioLibro();
            await cargarLibros();
            informarLibro(mensaje, true);
        } catch (error) {
            informarLibro(window.mensajeErrorSupabase(error, "No se pudo guardar el libro."));
        } finally {
            botonGuardarLibro.disabled = false;
        }
    });

    botonCancelarLibro.addEventListener("click", () => {
        limpiarFormularioLibro();
        informarLibro("");
    });

    try {
        await cargarPedidos();
    } catch (error) {
        const fila = document.createElement("tr");
        const celda = nodo("td", window.mensajeErrorSupabase(error, "No se pudieron cargar los pedidos."));
        celda.colSpan = 7;
        fila.appendChild(celda);
        tbody.replaceChildren(fila);
    }

    try {
        await cargarLibros();
    } catch (error) {
        informarLibro(window.mensajeErrorSupabase(error, "No se pudieron cargar los libros."));
    }
});
