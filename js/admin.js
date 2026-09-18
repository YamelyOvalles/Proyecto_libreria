/** Panel administrativo modular conectado a Supabase. */
document.addEventListener("DOMContentLoaded", () => {
    const estado = {
        pedidos: [],
        productos: [],
        categorias: [],
        movimientos: [],
        usuarios: [],
        mensajes: [],
        cotizaciones: [],
        facturas: [],
        configuracionNegocio: null,
        pedidoActual: null,
        mensajeActual: null
    };

    const nombresEstado = {
        pendiente: "Pendiente",
        confirmado: "Confirmado",
        procesando: "Procesando",
        listo_retiro: "Listo para retiro",
        enviado: "Enviado",
        entregado: "Entregado",
        cancelado: "Cancelado",
        devuelto: "Devuelto",
        verificando: "Verificando",
        pagado: "Pagado",
        rechazado: "Rechazado",
        reembolsado: "Reembolsado",
        activo: "Activo",
        inactivo: "Inactivo",
        leido: "Leído",
        respondido: "Respondido",
        archivado: "Archivado",
        entrada: "Entrada",
        salida: "Salida",
        ajuste: "Ajuste",
        reserva: "Reserva",
        liberacion: "Liberación",
        devolucion: "Devolución"
    };
    const siguientesEstadosPedido = {
        pendiente: ["confirmado", "procesando", "cancelado"],
        confirmado: ["procesando", "listo_retiro", "enviado", "cancelado"],
        procesando: ["listo_retiro", "enviado", "cancelado"],
        listo_retiro: ["entregado", "cancelado"],
        enviado: ["entregado", "devuelto"],
        entregado: ["devuelto"],
        cancelado: [],
        devuelto: []
    };
    const siguientesEstadosPago = {
        pendiente: ["verificando", "pagado", "rechazado"],
        verificando: ["pagado", "rechazado"],
        rechazado: ["pendiente", "verificando"],
        pagado: ["reembolsado"],
        reembolsado: []
    };
    const iconos = {
        ver: "M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-7.2A2.7 2.7 0 1 0 12 14.7a2.7 2.7 0 0 0 0-5.4Z",
        editar: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z",
        eliminar: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3.46-8.12 1.41-1.41L12 10.59l1.12-1.12 1.41 1.41L13.41 12l1.12 1.12-1.41 1.41L12 13.41l-1.12 1.12-1.41-1.41L10.59 12l-1.13-1.12ZM15.5 4l-1-1h-5l-1 1H5v2h14V4h-3.5Z",
        documento: "M6 2h9l5 5v15H6V2Zm8 2v5h4l-4-5ZM9 13v2h8v-2H9Zm0 4v2h6v-2H9Z",
        factura: "M5 2h14v20l-3-2-4 2-4-2-3 2V2Zm3 5v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z",
        imprimir: "M7 3h10v4H7V3Zm10 10H7v8h10v-8Zm2-5H5a3 3 0 0 0-3 3v5h3v-5h14v5h3v-5a3 3 0 0 0-3-3Z",
        descargar: "M11 3h2v9l3-3 1.4 1.4L12 15.8l-5.4-5.4L8 9l3 3V3ZM5 18h14v3H5v-3Z"
    };

    function nodo(etiqueta, texto, clase) {
        const elemento = document.createElement(etiqueta);
        if (clase) elemento.className = clase;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function celda(etiqueta, contenido) {
        const td = document.createElement("td");
        td.dataset.label = etiqueta;
        if (contenido instanceof Node) td.appendChild(contenido);
        else td.textContent = contenido ?? "—";
        return td;
    }

    function botonIcono(tipo, etiqueta, peligro = false) {
        const boton = document.createElement("button");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const ruta = document.createElementNS("http://www.w3.org/2000/svg", "path");
        boton.type = "button";
        boton.className = `icon-button${peligro ? " danger" : ""}`;
        boton.setAttribute("aria-label", etiqueta);
        boton.title = etiqueta;
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        ruta.setAttribute("d", iconos[tipo]);
        svg.appendChild(ruta);
        boton.appendChild(svg);
        return boton;
    }

    function badge(valor, pago = false) {
        return nodo("span", nombresEstado[valor] || valor, `badge-status badge-${pago ? "pago-" : ""}${valor}`);
    }

    function mostrarAviso(texto, tipo = "error") {
        const aviso = document.getElementById("admin-feedback");
        aviso.textContent = texto;
        aviso.className = `admin-notice${tipo === "success" ? " success" : ""}`;
        aviso.hidden = !texto;
        if (texto) aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function mensajeError(error, alternativo) {
        console.error(error);
        if (error?.message?.includes("Failed to fetch")) return "No se pudo conectar con Supabase.";
        if (error?.message?.includes("libros.editorial") || error?.message?.includes("stock_minimo") || error?.message?.includes("descuento_pct")) {
            return "La base de datos está desactualizada. Ejecuta database/database.sql en un proyecto nuevo.";
        }
        if (["cotizaciones", "facturas", "configuracion_negocio"].some(tabla => error?.message?.includes(tabla))) {
            return "Falta instalar el módulo documental incluido en database/database.sql.";
        }
        if (error?.message?.toLowerCase().includes("bucket not found")) {
            return "No existe el almacenamiento de portadas incluido en database/database.sql.";
        }
        return error?.message || alternativo;
    }

    async function mensajeErrorFuncion(error, alternativo) {
        try {
            const respuesta = error?.context;
            if (respuesta?.clone) {
                const detalle = await respuesta.clone().json();
                if (detalle?.error) return detalle.error;
            }
        } catch {
            // La respuesta no contenía JSON.
        }
        if (error?.context?.status === 404 || error?.message?.includes("Failed to send a request to the Edge Function")) {
            return alternativo;
        }
        return mensajeError(error, alternativo);
    }

    function fecha(valor) {
        return new Date(valor).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
    }

    function inventarioDe(producto) {
        return Array.isArray(producto.inventarios) ? producto.inventarios[0] : producto.inventarios;
    }

    function autorDe(producto) {
        return producto.libro_autor?.map(relacion => relacion.autores?.nombre).filter(Boolean).join(", ") || "Autor no indicado";
    }

    function categoriaDe(producto) {
        const categoria = estado.categorias.find(item => Number(item.id) === Number(producto.categoria_id));
        return categoria?.nombre || "Sin categoría";
    }

    function configurarRol(rol = window.libreriaRol) {
        const esAdmin = rol === "administrador";
        document.querySelectorAll("[data-admin-only]").forEach(elemento => {
            elemento.hidden = !esAdmin || (elemento.classList.contains("admin-view") && !elemento.classList.contains("active"));
        });
        const vistaRestringida = document.querySelector(".admin-view.active[data-admin-only]");
        if (!esAdmin && vistaRestringida) {
            abrirModulo("dashboard");
        }
    }

    function abrirModulo(nombre) {
        const destino = document.querySelector(`.admin-view[data-view="${nombre}"]`);
        if (destino?.hasAttribute("data-admin-only") && window.libreriaRol !== "administrador") {
            nombre = "dashboard";
        }
        document.querySelectorAll("[data-admin-view]").forEach(boton => {
            const activo = boton.dataset.adminView === nombre;
            boton.classList.toggle("active", activo);
            boton.setAttribute("aria-pressed", String(activo));
        });
        document.querySelectorAll(".admin-view").forEach(vista => {
            const activa = vista.dataset.view === nombre;
            vista.hidden = !activa;
            vista.classList.toggle("active", activa);
        });
        history.replaceState(null, "", `#${nombre}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll("[data-admin-view]").forEach(boton => {
        boton.addEventListener("click", () => abrirModulo(boton.dataset.adminView));
    });
    document.addEventListener("libreria:auth-lista", evento => configurarRol(evento.detail.rol));
    const moduloInicial = location.hash.slice(1);

    document.querySelectorAll("[data-close-dialog]").forEach(boton => {
        boton.addEventListener("click", () => boton.closest("dialog")?.close());
    });
    document.querySelectorAll("dialog").forEach(dialogo => {
        dialogo.addEventListener("click", evento => {
            if (evento.target === dialogo) dialogo.close();
        });
    });

    async function cargarPedidos() {
        const [pedidos, cotizaciones, facturas] = await Promise.all([
            window.libreriaSupabase
                .from("pedidos")
                .select("id,numero,cliente_nombre,cliente_correo,metodo_entrega,metodo_pago,estado_pago,estado,subtotal,descuento,costo_envio,total,notas,creado_en,pedido_detalles(libro_id,titulo,cantidad,precio_unitario,descuento_pct,descuento,subtotal,total_linea),pedido_direcciones_entrega(destinatario,telefono,linea_1,linea_2,sector,ciudad,provincia,codigo_postal,referencia)")
                .order("creado_en", { ascending: false }),
            window.libreriaSupabase.from("cotizaciones").select("id,numero,pedido_id,fecha_emision,valida_hasta,estado"),
            window.libreriaSupabase.from("facturas").select("id,numero,pedido_id,ncf,fecha_emision,estado")
        ]);
        if (pedidos.error) throw pedidos.error;
        if (cotizaciones.error) throw cotizaciones.error;
        if (facturas.error) throw facturas.error;
        estado.pedidos = pedidos.data || [];
        estado.cotizaciones = cotizaciones.data || [];
        estado.facturas = facturas.data || [];
        renderizarPedidos();
        renderizarDashboard();
    }

    async function cargarConfiguracionNegocio() {
        const { data, error } = await window.libreriaSupabase
            .from("configuracion_negocio")
            .select("*")
            .eq("id", 1)
            .single();
        if (error) throw error;
        estado.configuracionNegocio = data;
        llenarConfiguracionNegocio(data);
    }

    async function cargarProductos() {
        const { data, error } = await window.libreriaSupabase
            .from("libros")
            .select("id,isbn,titulo,descripcion,precio,descuento_pct,formato,idioma,editorial,categoria_id,stock_minimo,imagen_portada,activo,inventarios(cantidad_existencia,cantidad_reservada,cantidad_disponible),libro_autor(autores(nombre))")
            .order("titulo");
        if (error) throw error;
        estado.productos = data || [];
        renderizarProductos();
        renderizarInventarioResumen();
        llenarProductosInventario();
        renderizarDashboard();
    }

    async function cargarCategorias() {
        const { data, error } = await window.libreriaSupabase
            .from("categorias")
            .select("id,nombre,activo,creado_en")
            .order("nombre");
        if (error) throw error;
        estado.categorias = data || [];
        llenarCategorias();
        renderizarCategorias();
        if (estado.productos.length) renderizarProductos();
    }

    async function cargarMovimientos() {
        const { data, error } = await window.libreriaSupabase.rpc("listar_movimientos_inventario", {
            p_limite: 40
        });
        if (error) throw error;
        estado.movimientos = data || [];
        renderizarMovimientos();
    }

    async function cargarUsuarios() {
        if (window.libreriaRol !== "administrador") return;
        const { data, error } = await window.libreriaSupabase.rpc("listar_usuarios_admin");
        if (error) throw error;
        estado.usuarios = data || [];
        renderizarUsuarios();
        renderizarDashboard();
    }

    async function cargarMensajes() {
        if (window.libreriaRol !== "administrador") return;
        const { data, error } = await window.libreriaSupabase
            .from("contact_messages")
            .select("id,user_id,nombre,correo,telefono,asunto,mensaje,estado,created_at")
            .order("created_at", { ascending: false });
        if (error) throw error;
        estado.mensajes = data || [];
        renderizarMensajes();
    }

    function renderizarDashboard() {
        const pagados = estado.pedidos.filter(pedido => pedido.estado_pago === "pagado");
        const pendientes = estado.pedidos.filter(pedido => ["pendiente", "confirmado", "procesando"].includes(pedido.estado));
        const activos = estado.productos.filter(producto => producto.activo);
        const agotados = activos.filter(producto => Number(inventarioDe(producto)?.cantidad_disponible || 0) === 0);
        const bajos = activos.filter(producto => {
            const disponible = Number(inventarioDe(producto)?.cantidad_disponible || 0);
            return disponible > 0 && disponible <= Number(producto.stock_minimo || 0);
        });
        document.getElementById("metric-total-orders").textContent = estado.pedidos.length;
        document.getElementById("metric-pending-orders").textContent = pendientes.length;
        document.getElementById("metric-total-sales").textContent = estado.pedidos.filter(pedido => pedido.estado === "entregado").length;
        document.getElementById("metric-total-revenue").textContent = formatearMonedaRD(pagados.reduce((total, pedido) => total + Number(pedido.total), 0));
        document.getElementById("metric-total-products").textContent = activos.length;
        document.getElementById("metric-low-stock").textContent = bajos.length;
        document.getElementById("metric-out-stock").textContent = agotados.length;
        document.getElementById("metric-total-clients").textContent = window.libreriaRol === "administrador"
            ? estado.usuarios.filter(usuario => usuario.rol === "cliente").length : "—";

        const contenedor = document.getElementById("dashboard-recent-orders");
        contenedor.replaceChildren();
        if (!estado.pedidos.length) {
            contenedor.appendChild(nodo("p", "Todavía no hay pedidos registrados.", "empty-state"));
            return;
        }
        estado.pedidos.slice(0, 5).forEach(pedido => {
            const fila = nodo("article", undefined, "compact-order");
            const numero = nodo("div");
            numero.append(nodo("strong", pedido.numero), nodo("small", fecha(pedido.creado_en)));
            const cliente = nodo("div");
            cliente.append(nodo("strong", pedido.cliente_nombre), nodo("small", pedido.cliente_correo));
            fila.append(numero, cliente, nodo("strong", formatearMonedaRD(pedido.total)), badge(pedido.estado));
            contenedor.appendChild(fila);
        });
    }

    function productosFiltrados() {
        const texto = document.getElementById("product-search").value.trim().toLowerCase();
        const filtro = document.getElementById("product-status-filter").value;
        return estado.productos.filter(producto => {
            const disponible = Number(inventarioDe(producto)?.cantidad_disponible || 0);
            const coincide = !texto || [producto.titulo, producto.isbn, autorDe(producto), categoriaDe(producto)]
                .some(valor => valor?.toLowerCase().includes(texto));
            const estadoCoincide = filtro === "todos"
                || (filtro === "activo" && producto.activo)
                || (filtro === "inactivo" && !producto.activo)
                || (filtro === "agotado" && disponible === 0)
                || (filtro === "bajo" && disponible > 0 && disponible <= producto.stock_minimo);
            return coincide && estadoCoincide;
        });
    }

    function renderizarProductos() {
        const cuerpo = document.getElementById("products-table-body");
        cuerpo.replaceChildren();
        const productos = productosFiltrados();
        if (!productos.length) {
            const fila = nodo("tr");
            const vacio = celda("", "No se encontraron productos.");
            vacio.colSpan = 6;
            vacio.className = "empty-state";
            fila.appendChild(vacio);
            cuerpo.appendChild(fila);
            return;
        }

        productos.forEach(producto => {
            const inventario = inventarioDe(producto) || {};
            const disponible = Number(inventario.cantidad_disponible || 0);
            const detalle = nodo("div", undefined, "product-cell");
            const imagen = document.createElement("img");
            imagen.className = "product-thumb";
            imagen.src = producto.imagen_portada || "assets/logo-quisqueya-icono.png";
            imagen.alt = "";
            const texto = nodo("div");
            texto.append(nodo("strong", producto.titulo), nodo("small", `${autorDe(producto)}${producto.isbn ? ` · ${producto.isbn}` : ""}`));
            detalle.append(imagen, texto);

            const existencia = nodo("span", `${disponible} disponibles`, `stock-value${disponible === 0 ? " out" : disponible <= producto.stock_minimo ? " low" : ""}`);
            const acciones = nodo("div", undefined, "row-actions");
            const editar = botonIcono("editar", `Editar ${producto.titulo}`);
            const eliminar = botonIcono("eliminar", `Eliminar o desactivar ${producto.titulo}`, true);
            editar.addEventListener("click", () => abrirProducto(producto));
            eliminar.addEventListener("click", () => eliminarProducto(producto));
            acciones.append(editar, eliminar);

            const fila = nodo("tr");
            fila.append(
                celda("Producto", detalle),
                celda("Categoría", categoriaDe(producto)),
                celda("Precio", formatearMonedaRD(producto.precio)),
                celda("Inventario", existencia),
                celda("Estado", badge(producto.activo ? "activo" : "inactivo")),
                celda("Acciones", acciones)
            );
            cuerpo.appendChild(fila);
        });
    }

    function llenarCategorias() {
        const select = document.getElementById("product-category");
        const valor = select.value;
        const opciones = [new Option("Sin categoría", "")];
        estado.categorias.filter(categoria => categoria.activo || categoria.nombre === valor).forEach(categoria => {
            const texto = categoria.activo ? categoria.nombre : `${categoria.nombre} (inactiva)`;
            opciones.push(new Option(texto, categoria.nombre));
        });
        select.replaceChildren(...opciones);
        if ([...select.options].some(opcion => opcion.value === valor)) select.value = valor;
    }

    let vistaPortadaTemporal = null;

    function mostrarVistaPortada(url, temporal = false) {
        const imagen = document.getElementById("product-image-preview");
        const ayuda = document.getElementById("product-image-help");
        if (vistaPortadaTemporal) URL.revokeObjectURL(vistaPortadaTemporal);
        vistaPortadaTemporal = temporal ? url : null;
        imagen.hidden = !url;
        ayuda.hidden = Boolean(url);
        if (url) imagen.src = url;
        else imagen.removeAttribute("src");
    }

    function rutaPortadaGuardada(url) {
        const marca = "/storage/v1/object/public/portadas/";
        const posicion = url?.indexOf(marca) ?? -1;
        return posicion >= 0 ? decodeURIComponent(url.slice(posicion + marca.length)) : null;
    }

    async function subirPortada(archivo) {
        const extensiones = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        const extension = extensiones[archivo.type];
        if (!extension || archivo.size > 5 * 1024 * 1024) {
            throw new Error("Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.");
        }
        const identificador = typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const ruta = `productos/${identificador}.${extension}`;
        const { error } = await window.libreriaSupabase.storage
            .from("portadas")
            .upload(ruta, archivo, { cacheControl: "3600", contentType: archivo.type, upsert: false });
        if (error) throw error;
        const { data } = window.libreriaSupabase.storage.from("portadas").getPublicUrl(ruta);
        return { ruta, url: data.publicUrl };
    }

    function abrirProducto(producto = null) {
        const formulario = document.getElementById("product-form");
        formulario.reset();
        document.getElementById("product-id").value = producto?.id || "";
        document.getElementById("product-title").value = producto?.titulo || "";
        document.getElementById("product-author").value = producto ? autorDe(producto) : "";
        document.getElementById("product-isbn").value = producto?.isbn || "";
        document.getElementById("product-category").value = producto ? categoriaDe(producto).replace("Sin categoría", "") : "";
        document.getElementById("product-publisher").value = producto?.editorial || "";
        document.getElementById("product-price").value = producto?.precio || "";
        document.getElementById("product-discount").value = producto?.descuento_pct || 0;
        document.getElementById("product-stock").value = producto ? inventarioDe(producto)?.cantidad_existencia || 0 : 0;
        document.getElementById("product-min-stock").value = producto?.stock_minimo ?? 5;
        document.getElementById("product-format").value = producto?.formato || "fisico";
        document.getElementById("product-language").value = producto?.idioma || "Español";
        document.getElementById("product-image").value = producto?.imagen_portada || "";
        document.getElementById("product-image-file").value = "";
        document.getElementById("product-image-file").setCustomValidity("");
        mostrarVistaPortada(producto?.imagen_portada || "");
        document.getElementById("product-description").value = producto?.descripcion || "";
        document.getElementById("product-active").checked = producto?.activo ?? true;
        document.getElementById("product-dialog-title").textContent = producto ? "Editar producto" : "Nuevo producto";
        document.getElementById("initial-stock-field").hidden = Boolean(producto);
        document.getElementById("product-stock").required = !producto;
        document.getElementById("product-dialog").showModal();
    }

    async function eliminarProducto(producto) {
        if (!confirm(`¿Eliminar o desactivar “${producto.titulo}”? El historial de ventas nunca se borrará.`)) return;
        const { data, error } = await window.libreriaSupabase.rpc("eliminar_producto_admin", { p_producto_id: producto.id });
        if (error) return mostrarAviso(mensajeError(error, "No se pudo modificar el producto."));
        await cargarProductos();
        mostrarAviso(`Producto ${data === "eliminado" ? "eliminado" : "desactivado"} correctamente.`, "success");
    }

    document.getElementById("new-product-btn").addEventListener("click", () => abrirProducto());
    document.getElementById("product-search").addEventListener("input", renderizarProductos);
    document.getElementById("product-status-filter").addEventListener("change", renderizarProductos);
    document.getElementById("product-image-file").addEventListener("change", evento => {
        const campo = evento.currentTarget;
        const archivo = campo.files[0];
        const valido = !archivo || (["image/jpeg", "image/png", "image/webp"].includes(archivo.type) && archivo.size <= 5 * 1024 * 1024);
        campo.setCustomValidity(valido ? "" : "La portada debe ser JPG, PNG o WebP y pesar hasta 5 MB.");
        if (!valido) {
            campo.reportValidity();
            campo.value = "";
            mostrarVistaPortada(document.getElementById("product-image").value);
            return;
        }
        mostrarVistaPortada(archivo ? URL.createObjectURL(archivo) : document.getElementById("product-image").value, Boolean(archivo));
    });
    document.getElementById("product-dialog").addEventListener("close", () => {
        if (vistaPortadaTemporal) URL.revokeObjectURL(vistaPortadaTemporal);
        vistaPortadaTemporal = null;
    });
    document.getElementById("product-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        if (!formulario.reportValidity()) return;
        const id = document.getElementById("product-id").value;
        const boton = document.getElementById("product-save-btn");
        boton.disabled = true;
        const portadaAnterior = document.getElementById("product-image").value;
        let portadaSubida = null;
        let productoGuardado = false;
        try {
            const archivo = document.getElementById("product-image-file").files[0];
            if (archivo) portadaSubida = await subirPortada(archivo);
            const { error } = await window.libreriaSupabase.rpc("guardar_producto_admin", {
                p_producto_id: id ? Number(id) : null,
                p_isbn: document.getElementById("product-isbn").value,
                p_titulo: document.getElementById("product-title").value,
                p_autor: document.getElementById("product-author").value,
                p_categoria: document.getElementById("product-category").value,
                p_editorial: document.getElementById("product-publisher").value,
                p_descripcion: document.getElementById("product-description").value,
                p_precio: Number(document.getElementById("product-price").value),
                p_descuento_pct: Number(document.getElementById("product-discount").value || 0),
                p_formato: document.getElementById("product-format").value,
                p_idioma: document.getElementById("product-language").value,
                p_imagen_portada: portadaSubida?.url || portadaAnterior,
                p_stock_inicial: Number(document.getElementById("product-stock").value || 0),
                p_stock_minimo: Number(document.getElementById("product-min-stock").value),
                p_activo: document.getElementById("product-active").checked
            });
            if (error) throw error;
            productoGuardado = true;
            const rutaAnterior = rutaPortadaGuardada(portadaAnterior);
            if (portadaSubida && rutaAnterior) {
                await window.libreriaSupabase.storage.from("portadas").remove([rutaAnterior]);
            }
            document.getElementById("product-dialog").close();
            await Promise.all([cargarProductos(), cargarMovimientos()]);
            mostrarAviso(id ? "Producto actualizado." : "Producto creado.", "success");
        } catch (error) {
            if (portadaSubida && !productoGuardado) {
                await window.libreriaSupabase.storage.from("portadas").remove([portadaSubida.ruta]);
            }
            const alternativo = productoGuardado
                ? "El producto se guardó, pero no se pudo actualizar la vista. Recarga la página."
                : "No se pudo guardar el producto.";
            mostrarAviso(productoGuardado ? alternativo : mensajeError(error, alternativo));
        } finally {
            boton.disabled = false;
        }
    });

    function llenarConfiguracionNegocio(configuracion) {
        const valores = {
            "setting-business-name": configuracion.nombre_comercial,
            "setting-legal-name": configuracion.razon_social,
            "setting-rnc": configuracion.rnc,
            "setting-phone": configuracion.telefono,
            "setting-email": configuracion.correo,
            "setting-website": configuracion.sitio_web,
            "setting-address": configuracion.direccion,
            "setting-city": configuracion.ciudad,
            "setting-province": configuracion.provincia,
            "setting-country": configuracion.pais,
            "setting-attendant": configuracion.atendido_por_default,
            "setting-tagline": configuracion.eslogan,
            "setting-logo": configuracion.logo_url,
            "setting-quote-prefix": configuracion.cotizacion_prefijo,
            "setting-quote-validity": configuracion.cotizacion_validez_dias,
            "setting-quote-delivery": configuracion.cotizacion_tiempo_entrega,
            "setting-quote-tax": configuracion.cotizacion_itbis_pct,
            "setting-quote-terms": configuracion.cotizacion_condiciones,
            "setting-quote-notes": configuracion.cotizacion_notas,
            "setting-invoice-prefix": configuracion.factura_prefijo,
            "setting-invoice-condition": configuracion.factura_condicion_pago,
            "setting-credit-days": configuracion.factura_dias_credito,
            "setting-invoice-tax": configuracion.factura_itbis_pct,
            "setting-invoice-terms": configuracion.factura_condiciones,
            "setting-invoice-notes": configuracion.factura_notas
        };
        Object.entries(valores).forEach(([id, valor]) => {
            document.getElementById(id).value = valor ?? "";
        });
        document.getElementById("setting-quote-show-tax").checked = configuracion.cotizacion_mostrar_itbis;
        document.getElementById("setting-invoice-show-tax").checked = configuracion.factura_mostrar_itbis;
    }

    document.querySelectorAll("[data-settings-tab]").forEach(boton => {
        boton.addEventListener("click", () => {
            const panel = boton.dataset.settingsTab;
            document.querySelectorAll("[data-settings-tab]").forEach(opcion => {
                const activa = opcion === boton;
                opcion.classList.toggle("active", activa);
                opcion.setAttribute("aria-selected", String(activa));
            });
            document.querySelectorAll("[data-settings-panel]").forEach(seccion => {
                seccion.hidden = seccion.dataset.settingsPanel !== panel;
            });
        });
    });

    document.getElementById("business-settings-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!evento.currentTarget.reportValidity()) return;
        const boton = document.getElementById("business-settings-save");
        boton.disabled = true;
        const valor = id => document.getElementById(id).value.trim();
        const datos = {
            nombre_comercial: valor("setting-business-name"),
            razon_social: valor("setting-legal-name"),
            rnc: valor("setting-rnc"),
            telefono: valor("setting-phone"),
            correo: valor("setting-email"),
            sitio_web: valor("setting-website"),
            direccion: valor("setting-address"),
            ciudad: valor("setting-city"),
            provincia: valor("setting-province"),
            pais: valor("setting-country"),
            atendido_por_default: valor("setting-attendant"),
            eslogan: valor("setting-tagline"),
            logo_url: valor("setting-logo"),
            cotizacion_prefijo: valor("setting-quote-prefix"),
            cotizacion_validez_dias: Number(valor("setting-quote-validity")),
            cotizacion_tiempo_entrega: valor("setting-quote-delivery"),
            cotizacion_itbis_pct: Number(valor("setting-quote-tax") || 0),
            cotizacion_mostrar_itbis: document.getElementById("setting-quote-show-tax").checked,
            cotizacion_condiciones: valor("setting-quote-terms"),
            cotizacion_notas: valor("setting-quote-notes"),
            factura_prefijo: valor("setting-invoice-prefix"),
            factura_condicion_pago: valor("setting-invoice-condition"),
            factura_dias_credito: Number(valor("setting-credit-days")),
            factura_itbis_pct: Number(valor("setting-invoice-tax") || 0),
            factura_mostrar_itbis: document.getElementById("setting-invoice-show-tax").checked,
            factura_condiciones: valor("setting-invoice-terms"),
            factura_notas: valor("setting-invoice-notes")
        };
        const { data, error } = await window.libreriaSupabase.rpc("guardar_configuracion_negocio", { p_datos: datos });
        boton.disabled = false;
        if (error) return mostrarAviso(mensajeError(error, "No se pudo guardar la configuración."));
        estado.configuracionNegocio = Array.isArray(data) ? data[0] : data;
        llenarConfiguracionNegocio(estado.configuracionNegocio);
        mostrarAviso("Configuración documental guardada.", "success");
    });

    function limpiarFormularioCategoria() {
        document.getElementById("category-form").reset();
        document.getElementById("category-id").value = "";
        document.getElementById("category-active").checked = true;
        document.getElementById("category-form-title").textContent = "Nueva categoría";
        document.getElementById("category-cancel").hidden = true;
    }

    function editarCategoria(categoria) {
        document.getElementById("category-id").value = categoria.id;
        document.getElementById("category-name").value = categoria.nombre;
        document.getElementById("category-active").checked = categoria.activo;
        document.getElementById("category-form-title").textContent = "Editar categoría";
        document.getElementById("category-cancel").hidden = false;
        document.getElementById("category-name").focus();
    }

    function renderizarCategorias() {
        const cuerpo = document.getElementById("categories-table-body");
        cuerpo.replaceChildren();
        if (!estado.categorias.length) {
            const fila = nodo("tr");
            const vacio = celda("", "No hay categorías registradas.");
            vacio.colSpan = 3;
            vacio.className = "empty-state";
            fila.appendChild(vacio);
            cuerpo.appendChild(fila);
            return;
        }
        estado.categorias.forEach(categoria => {
            const acciones = nodo("div", undefined, "row-actions");
            const editar = botonIcono("editar", `Editar ${categoria.nombre}`);
            const eliminar = botonIcono("eliminar", `Eliminar o desactivar ${categoria.nombre}`, true);
            editar.addEventListener("click", () => editarCategoria(categoria));
            eliminar.addEventListener("click", async () => {
                if (!confirm(`¿Eliminar o desactivar la categoría “${categoria.nombre}”?`)) return;
                const { data, error } = await window.libreriaSupabase.rpc("eliminar_categoria_admin", {
                    p_categoria_id: categoria.id
                });
                if (error) return mostrarAviso(mensajeError(error, "No se pudo modificar la categoría."));
                await Promise.all([cargarCategorias(), cargarProductos()]);
                mostrarAviso(`Categoría ${data === "eliminada" ? "eliminada" : "desactivada"}.`, "success");
            });
            acciones.append(editar, eliminar);
            const fila = nodo("tr");
            fila.append(
                celda("Nombre", categoria.nombre),
                celda("Estado", badge(categoria.activo ? "activo" : "inactivo")),
                celda("Acciones", acciones)
            );
            cuerpo.appendChild(fila);
        });
    }

    document.getElementById("category-cancel").addEventListener("click", limpiarFormularioCategoria);
    document.getElementById("category-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!evento.currentTarget.reportValidity()) return;
        const boton = evento.currentTarget.querySelector('[type="submit"]');
        const id = document.getElementById("category-id").value;
        boton.disabled = true;
        const { error } = await window.libreriaSupabase.rpc("guardar_categoria_admin", {
            p_categoria_id: id ? Number(id) : null,
            p_nombre: document.getElementById("category-name").value,
            p_activo: document.getElementById("category-active").checked
        });
        boton.disabled = false;
        if (error) return mostrarAviso(mensajeError(error, "No se pudo guardar la categoría."));
        limpiarFormularioCategoria();
        await Promise.all([cargarCategorias(), cargarProductos()]);
        mostrarAviso(id ? "Categoría actualizada." : "Categoría creada.", "success");
    });

    function renderizarInventarioResumen() {
        const totales = estado.productos.reduce((resultado, producto) => {
            const inventario = inventarioDe(producto) || {};
            const disponible = Number(inventario.cantidad_disponible || 0);
            resultado.disponible += disponible;
            resultado.reservada += Number(inventario.cantidad_reservada || 0);
            if (producto.activo && disponible <= Number(producto.stock_minimo || 0)) resultado.alertas += 1;
            return resultado;
        }, { disponible: 0, reservada: 0, alertas: 0 });
        document.getElementById("inventory-available").textContent = totales.disponible;
        document.getElementById("inventory-reserved").textContent = totales.reservada;
        document.getElementById("inventory-alerts").textContent = totales.alertas;
    }

    function llenarProductosInventario() {
        const select = document.getElementById("inventory-product");
        const valor = select.value;
        select.replaceChildren(new Option("Selecciona un producto", ""));
        estado.productos.forEach(producto => {
            const inventario = inventarioDe(producto);
            select.add(new Option(`${producto.titulo} · ${inventario?.cantidad_disponible || 0} disponibles`, producto.id));
        });
        if ([...select.options].some(opcion => opcion.value === valor)) select.value = valor;
    }

    function renderizarMovimientos() {
        const cuerpo = document.getElementById("inventory-history-body");
        cuerpo.replaceChildren();
        if (!estado.movimientos.length) {
            const fila = nodo("tr");
            const vacio = celda("", "No hay movimientos registrados.");
            vacio.colSpan = 6;
            vacio.className = "empty-state";
            fila.appendChild(vacio);
            cuerpo.appendChild(fila);
            return;
        }
        estado.movimientos.forEach(movimiento => {
            const cambio = Number(movimiento.cambio_existencia);
            const valor = nodo("span", `${cambio > 0 ? "+" : ""}${cambio}`, cambio >= 0 ? "movement-positive" : "movement-negative");
            const fila = nodo("tr");
            fila.append(
                celda("Fecha", fecha(movimiento.creado_en)),
                celda("Producto", movimiento.producto || "Producto eliminado"),
                celda("Tipo", nombresEstado[movimiento.tipo] || movimiento.tipo.replaceAll("_", " ")),
                celda("Cambio", valor),
                celda("Motivo", movimiento.motivo),
                celda("Responsable", movimiento.responsable || "Sistema")
            );
            cuerpo.appendChild(fila);
        });
    }

    document.getElementById("inventory-type").addEventListener("change", evento => {
        const ajuste = evento.target.value === "ajuste";
        document.getElementById("inventory-quantity-label").textContent = ajuste ? "Nueva existencia" : "Cantidad";
        document.getElementById("inventory-quantity").min = ajuste ? "0" : "1";
    });
    document.getElementById("inventory-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        if (!formulario.reportValidity()) return;
        const boton = formulario.querySelector('[type="submit"]');
        boton.disabled = true;
        const { error } = await window.libreriaSupabase.rpc("ajustar_inventario_admin", {
            p_producto_id: Number(document.getElementById("inventory-product").value),
            p_tipo: document.getElementById("inventory-type").value,
            p_cantidad: Number(document.getElementById("inventory-quantity").value),
            p_motivo: document.getElementById("inventory-reason").value
        });
        boton.disabled = false;
        if (error) return mostrarAviso(mensajeError(error, "No se pudo registrar el movimiento."));
        formulario.reset();
        await Promise.all([cargarProductos(), cargarMovimientos()]);
        mostrarAviso("Movimiento de inventario registrado.", "success");
    });

    function pedidosFiltrados() {
        const texto = document.getElementById("order-search").value.trim().toLowerCase();
        const filtro = document.getElementById("order-status-filter").value;
        return estado.pedidos.filter(pedido =>
            (filtro === "todos" || pedido.estado === filtro)
            && (!texto || [pedido.numero, pedido.cliente_nombre, pedido.cliente_correo]
                .some(valor => valor?.toLowerCase().includes(texto)))
        );
    }

    function renderizarPedidos() {
        const contenedor = document.getElementById("orders-list");
        contenedor.replaceChildren();
        const pedidos = pedidosFiltrados();
        if (!pedidos.length) {
            contenedor.appendChild(nodo("p", "No se encontraron pedidos.", "admin-panel empty-state"));
            return;
        }
        pedidos.forEach(pedido => {
            const articulos = pedido.pedido_detalles?.reduce((total, item) => total + Number(item.cantidad), 0) || 0;
            const principal = nodo("div");
            principal.append(nodo("strong", pedido.numero), nodo("small", fecha(pedido.creado_en)));
            const cliente = nodo("div");
            cliente.append(nodo("strong", pedido.cliente_nombre), nodo("small", pedido.cliente_correo));
            const cantidad = nodo("div");
            cantidad.append(nodo("strong", `${articulos} artículo${articulos === 1 ? "" : "s"}`), nodo("small", pedido.metodo_entrega === "retiro" ? "Retiro" : "Domicilio"));
            const estados = nodo("div", undefined, "order-card-status");
            estados.append(badge(pedido.estado), badge(pedido.estado_pago, true));
            const ver = botonIcono("ver", `Ver detalles de ${pedido.numero}`);
            ver.addEventListener("click", () => abrirPedido(pedido));
            const tarjeta = nodo("article", undefined, "order-card");
            tarjeta.append(principal, cliente, cantidad, nodo("span", formatearMonedaRD(pedido.total), "order-card-total"), estados, ver);
            contenedor.appendChild(tarjeta);
        });
    }

    function llenarEstados(select, valores, actual) {
        select.replaceChildren(...valores.map(valor => new Option(nombresEstado[valor], valor, false, valor === actual)));
    }

    function documentoDePedido(tipo, pedidoId) {
        const lista = tipo === "cotizacion" ? estado.cotizaciones : estado.facturas;
        return lista.find(documento => documento.pedido_id === pedidoId) || null;
    }

    function abrirDocumento(tipo, documento, accion = "ver") {
        const parametros = new URLSearchParams({ tipo, id: documento.id });
        if (accion !== "ver") parametros.set("accion", accion);
        window.location.href = `documento.html?${parametros}`;
    }

    function botonDocumento(texto, icono, accion, clase = "button button-secondary") {
        const boton = nodo("button", undefined, clase);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const ruta = document.createElementNS("http://www.w3.org/2000/svg", "path");
        boton.type = "button";
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        ruta.setAttribute("d", iconos[icono]);
        svg.appendChild(ruta);
        boton.append(svg, document.createTextNode(texto));
        boton.addEventListener("click", accion);
        return boton;
    }

    function renderizarAccionesDocumentos(pedido) {
        const contenedor = document.getElementById("order-document-actions");
        const cotizacion = documentoDePedido("cotizacion", pedido.id);
        const factura = documentoDePedido("factura", pedido.id);
        contenedor.replaceChildren();

        if (cotizacion) {
            contenedor.append(
                botonDocumento("Ver cotización", "documento", () => abrirDocumento("cotizacion", cotizacion)),
                botonDocumento("Descargar cotización", "descargar", () => abrirDocumento("cotizacion", cotizacion, "descargar")),
                botonDocumento("Imprimir cotización", "imprimir", () => abrirDocumento("cotizacion", cotizacion, "imprimir"))
            );
        }

        if (factura) {
            contenedor.append(
                botonDocumento("Ver factura", "factura", () => abrirDocumento("factura", factura)),
                botonDocumento("Descargar factura", "descargar", () => abrirDocumento("factura", factura, "descargar")),
                botonDocumento("Imprimir factura", "imprimir", () => abrirDocumento("factura", factura, "imprimir"))
            );
        } else if (["procesando", "listo_retiro", "enviado", "entregado"].includes(pedido.estado)) {
            contenedor.appendChild(botonDocumento("Generar factura", "factura", () => abrirFormularioFactura(), "button button-primary"));
        }
    }

    function abrirPedido(pedido) {
        estado.pedidoActual = pedido;
        document.getElementById("order-dialog-title").textContent = pedido.numero;
        document.getElementById("order-detail-id").value = pedido.id;
        llenarEstados(
            document.getElementById("order-detail-status"),
            [pedido.estado, ...(siguientesEstadosPedido[pedido.estado] || [])],
            pedido.estado
        );
        llenarEstados(
            document.getElementById("order-detail-payment"),
            [pedido.estado_pago, ...(siguientesEstadosPago[pedido.estado_pago] || [])],
            pedido.estado_pago
        );

        const contenido = document.getElementById("order-detail-content");
        const resumen = nodo("div", undefined, "order-detail-grid");
        [["Cliente", pedido.cliente_nombre], ["Correo", pedido.cliente_correo], ["Fecha", fecha(pedido.creado_en)], ["Entrega", pedido.metodo_entrega], ["Pago", pedido.metodo_pago], ["Total", formatearMonedaRD(pedido.total)]].forEach(([titulo, valor]) => {
            const dato = nodo("div");
            dato.append(nodo("span", titulo), nodo("strong", valor));
            resumen.appendChild(dato);
        });
        const tabla = nodo("table", undefined, "order-items");
        const encabezado = nodo("thead");
        const filaEncabezado = nodo("tr");
        ["Producto", "Cantidad", "Precio", "Descuento", "Total"].forEach(texto => filaEncabezado.appendChild(nodo("th", texto)));
        encabezado.appendChild(filaEncabezado);
        const cuerpo = nodo("tbody");
        pedido.pedido_detalles?.forEach(item => {
            const fila = nodo("tr");
            fila.append(
                celda("Producto", item.titulo),
                celda("Cantidad", item.cantidad),
                celda("Precio", formatearMonedaRD(item.precio_unitario)),
                celda("Descuento", `${Number(item.descuento_pct || 0)}%`),
                celda("Total", formatearMonedaRD(item.total_linea))
            );
            cuerpo.appendChild(fila);
        });
        tabla.append(encabezado, cuerpo);
        const extras = nodo("div", undefined, "order-extra");
        const direccion = Array.isArray(pedido.pedido_direcciones_entrega)
            ? pedido.pedido_direcciones_entrega[0]
            : pedido.pedido_direcciones_entrega;
        if (direccion) {
            const partes = [direccion.linea_1, direccion.linea_2, direccion.sector, direccion.ciudad, direccion.provincia, direccion.codigo_postal].filter(Boolean);
            const bloque = nodo("div");
            bloque.append(nodo("strong", "Dirección de entrega"), nodo("p", partes.join(", ")));
            if (direccion.referencia) bloque.appendChild(nodo("small", `Referencia: ${direccion.referencia}`));
            extras.appendChild(bloque);
        }
        if (pedido.notas) {
            const bloque = nodo("div");
            bloque.append(nodo("strong", "Notas"), nodo("p", pedido.notas));
            extras.appendChild(bloque);
        }
        contenido.replaceChildren(resumen, tabla);
        if (extras.childElementCount) contenido.appendChild(extras);
        renderizarAccionesDocumentos(pedido);
        const dialogo = document.getElementById("order-dialog");
        if (!dialogo.open) dialogo.showModal();
    }

    function alternarVencimientoFactura() {
        const esCredito = document.getElementById("invoice-condition").value === "credito";
        const campo = document.getElementById("invoice-due-field");
        const fechaVencimiento = document.getElementById("invoice-due-date");
        campo.hidden = !esCredito;
        fechaVencimiento.required = esCredito;
        if (!esCredito) fechaVencimiento.value = "";
    }

    function abrirFormularioFactura() {
        const formulario = document.getElementById("invoice-form");
        formulario.reset();
        document.getElementById("invoice-condition").value = estado.configuracionNegocio?.factura_condicion_pago || "contado";
        alternarVencimientoFactura();
        document.getElementById("invoice-dialog").showModal();
    }

    document.getElementById("invoice-condition").addEventListener("change", alternarVencimientoFactura);
    document.getElementById("invoice-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const pedido = estado.pedidoActual;
        if (!pedido || !evento.currentTarget.reportValidity()) return;
        const boton = document.getElementById("invoice-submit");
        boton.disabled = true;
        const { data, error } = await window.libreriaSupabase.rpc("generar_factura_pedido", {
            p_pedido_id: pedido.id,
            p_ncf: document.getElementById("invoice-ncf").value || null,
            p_condicion_pago: document.getElementById("invoice-condition").value,
            p_fecha_vencimiento: document.getElementById("invoice-due-date").value || null,
            p_notas: document.getElementById("invoice-notes").value || null
        });
        boton.disabled = false;
        if (error) return mostrarAviso(mensajeError(error, "No se pudo generar la factura."));
        document.getElementById("invoice-dialog").close();
        await cargarPedidos();
        const factura = Array.isArray(data) ? data[0] : data;
        const pedidoActualizado = estado.pedidos.find(item => item.id === pedido.id);
        if (pedidoActualizado) abrirPedido(pedidoActualizado);
        mostrarAviso(`Factura ${factura?.numero || "generada"} creada correctamente.`, "success");
    });

    document.getElementById("order-search").addEventListener("input", renderizarPedidos);
    document.getElementById("order-status-filter").addEventListener("change", renderizarPedidos);
    document.getElementById("orders-refresh").addEventListener("click", async evento => {
        evento.currentTarget.disabled = true;
        await cargarPedidos().catch(error => mostrarAviso(mensajeError(error, "No se pudieron actualizar los pedidos.")));
        evento.currentTarget.disabled = false;
    });
    document.getElementById("order-status-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const pedido = estado.pedidoActual;
        if (!pedido) return;
        const nuevoEstado = document.getElementById("order-detail-status").value;
        const nuevoPago = document.getElementById("order-detail-payment").value;
        const boton = evento.currentTarget.querySelector('[type="submit"]');
        boton.disabled = true;
        try {
            if (nuevoEstado !== pedido.estado) {
                const { error } = await window.libreriaSupabase.rpc("actualizar_estado_pedido", { p_pedido_id: pedido.id, p_estado: nuevoEstado });
                if (error) throw error;
            }
            if (nuevoPago !== pedido.estado_pago) {
                const { error } = await window.libreriaSupabase.rpc("actualizar_pago_pedido", {
                    p_pedido_id: pedido.id,
                    p_estado_pago: nuevoPago
                });
                if (error) throw error;
            }
            document.getElementById("order-dialog").close();
            await Promise.all([cargarPedidos(), cargarProductos(), cargarMovimientos()]);
            mostrarAviso("Pedido actualizado correctamente.", "success");
        } catch (error) {
            mostrarAviso(mensajeError(error, "No se pudo actualizar el pedido."));
        } finally {
            boton.disabled = false;
        }
    });

    function mensajesFiltrados() {
        const texto = document.getElementById("message-search").value.trim().toLowerCase();
        const filtro = document.getElementById("message-status-filter").value;
        return estado.mensajes.filter(mensaje =>
            (filtro === "todos" || mensaje.estado === filtro)
            && (!texto || [mensaje.nombre, mensaje.correo, mensaje.asunto]
                .some(valor => valor?.toLowerCase().includes(texto)))
        );
    }

    function renderizarMensajes() {
        const cuerpo = document.getElementById("messages-table-body");
        const contador = document.getElementById("messages-count");
        contador.textContent = estado.mensajes.length;
        contador.hidden = estado.mensajes.length === 0;
        cuerpo.replaceChildren();

        const mensajes = mensajesFiltrados();
        if (!mensajes.length) {
            const fila = nodo("tr");
            const vacio = celda("", "No se encontraron mensajes.");
            vacio.colSpan = 6;
            vacio.className = "empty-state";
            fila.appendChild(vacio);
            cuerpo.appendChild(fila);
            return;
        }

        mensajes.forEach(mensaje => {
            const acciones = nodo("div", undefined, "row-actions");
            const ver = botonIcono("ver", `Ver mensaje de ${mensaje.nombre}`);
            ver.addEventListener("click", () => abrirMensaje(mensaje));
            acciones.appendChild(ver);
            const fila = nodo("tr");
            fila.append(
                celda("Cliente", mensaje.nombre),
                celda("Correo", mensaje.correo),
                celda("Asunto", mensaje.asunto),
                celda("Fecha", fecha(mensaje.created_at)),
                celda("Estado", badge(mensaje.estado)),
                celda("Acciones", acciones)
            );
            cuerpo.appendChild(fila);
        });
    }

    function abrirMensaje(mensaje) {
        estado.mensajeActual = mensaje;
        document.getElementById("message-dialog-title").textContent = mensaje.asunto;
        document.getElementById("message-detail-status").value = mensaje.estado;

        const resumen = nodo("div", undefined, "message-meta");
        [["Cliente", mensaje.nombre], ["Correo", mensaje.correo], ["Teléfono", mensaje.telefono || "No indicado"], ["Fecha", fecha(mensaje.created_at)]].forEach(([titulo, valor]) => {
            const dato = nodo("div");
            dato.append(nodo("span", titulo), nodo("strong", valor));
            resumen.appendChild(dato);
        });
        const contenido = nodo("div", undefined, "message-body");
        contenido.append(nodo("span", "Mensaje"), nodo("p", mensaje.mensaje));
        document.getElementById("message-detail").replaceChildren(resumen, contenido);
        document.getElementById("message-dialog").showModal();
    }

    document.getElementById("message-search").addEventListener("input", renderizarMensajes);
    document.getElementById("message-status-filter").addEventListener("change", renderizarMensajes);
    document.getElementById("messages-refresh").addEventListener("click", async evento => {
        evento.currentTarget.disabled = true;
        await cargarMensajes().catch(error => mostrarAviso(mensajeError(error, "No se pudieron actualizar los mensajes.")));
        evento.currentTarget.disabled = false;
    });
    document.getElementById("message-status-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const mensaje = estado.mensajeActual;
        if (!mensaje) return;
        const boton = document.getElementById("message-save-btn");
        boton.disabled = true;
        const { error } = await window.libreriaSupabase
            .from("contact_messages")
            .update({ estado: document.getElementById("message-detail-status").value })
            .eq("id", mensaje.id);
        boton.disabled = false;
        if (error) return mostrarAviso(mensajeError(error, "No se pudo actualizar el mensaje."));
        document.getElementById("message-dialog").close();
        await cargarMensajes();
        mostrarAviso("Estado del mensaje actualizado.", "success");
    });
    function usuariosFiltrados() {
        const texto = document.getElementById("user-search").value.trim().toLowerCase();
        const rol = document.getElementById("user-role-filter").value;
        return estado.usuarios.filter(usuario =>
            (rol === "todos" || usuario.rol === rol)
            && (!texto || [`${usuario.nombres} ${usuario.apellidos}`, usuario.correo]
                .some(valor => valor?.toLowerCase().includes(texto)))
        );
    }

    function renderizarUsuarios() {
        const cuerpo = document.getElementById("users-table-body");
        cuerpo.replaceChildren();
        const usuarios = usuariosFiltrados();
        if (!usuarios.length) {
            const fila = nodo("tr");
            const vacio = celda("", "No se encontraron usuarios.");
            vacio.colSpan = 5;
            vacio.className = "empty-state";
            fila.appendChild(vacio);
            cuerpo.appendChild(fila);
            return;
        }
        usuarios.forEach(usuario => {
            const identidad = nodo("div");
            identidad.append(nodo("strong", `${usuario.nombres} ${usuario.apellidos}`.trim()), nodo("small", usuario.correo));
            const acciones = nodo("div", undefined, "row-actions");
            const editar = botonIcono("editar", `Editar ${usuario.nombres}`);
            editar.addEventListener("click", () => abrirUsuario(usuario));
            acciones.appendChild(editar);
            const fila = nodo("tr");
            fila.append(
                celda("Usuario", identidad),
                celda("Rol", usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1)),
                celda("Estado", badge(usuario.activo ? "activo" : "inactivo")),
                celda("Registro", new Date(usuario.creado_en).toLocaleDateString("es-DO")),
                celda("Acciones", acciones)
            );
            cuerpo.appendChild(fila);
        });
    }

    function abrirUsuario(usuario = null) {
        const nuevo = !usuario;
        document.getElementById("user-form").reset();
        document.getElementById("user-id").value = usuario?.id || "";
        document.getElementById("user-first-name").value = usuario?.nombres || "";
        document.getElementById("user-last-name").value = usuario?.apellidos || "";
        document.getElementById("user-role").value = usuario?.rol || "cliente";
        document.getElementById("user-active").checked = usuario?.activo ?? true;
        document.getElementById("new-user-fields").hidden = !nuevo;
        document.getElementById("user-email").required = nuevo;
        document.getElementById("user-password").required = nuevo;
        document.getElementById("user-dialog-title").textContent = nuevo ? "Nuevo usuario" : "Editar usuario";
        document.getElementById("user-dialog").showModal();
    }

    document.getElementById("new-user-btn").addEventListener("click", () => abrirUsuario());
    document.getElementById("user-search").addEventListener("input", renderizarUsuarios);
    document.getElementById("user-role-filter").addEventListener("change", renderizarUsuarios);
    document.getElementById("user-form").addEventListener("submit", async evento => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        if (!formulario.reportValidity()) return;
        const id = document.getElementById("user-id").value;
        const datos = {
            nombres: document.getElementById("user-first-name").value,
            apellidos: document.getElementById("user-last-name").value,
            rol: document.getElementById("user-role").value,
            activo: document.getElementById("user-active").checked
        };
        const boton = document.getElementById("user-save-btn");
        boton.disabled = true;
        let error;
        if (id) {
            ({ error } = await window.libreriaSupabase.rpc("actualizar_usuario_admin", {
                p_usuario_id: id,
                p_nombres: datos.nombres,
                p_apellidos: datos.apellidos,
                p_activo: datos.activo,
                p_rol: datos.rol
            }));
        } else {
            ({ error } = await window.libreriaSupabase.functions.invoke("bright-action", {
                body: {
                    ...datos,
                    correo: document.getElementById("user-email").value,
                    password: document.getElementById("user-password").value
                }
            }));
        }
        boton.disabled = false;
        if (error) {
            const mensajeAlternativo = id
                ? "No se pudo actualizar el usuario."
                : "La función para crear usuarios no está disponible en Supabase.";
            return mostrarAviso(await mensajeErrorFuncion(error, mensajeAlternativo));
        }
        document.getElementById("user-dialog").close();
        await cargarUsuarios();
        mostrarAviso(id ? "Usuario actualizado." : "Usuario creado.", "success");
    });

    document.getElementById("dashboard-refresh").addEventListener("click", async evento => {
        evento.currentTarget.disabled = true;
        await cargarTodo();
        evento.currentTarget.disabled = false;
    });

    async function cargarTodo() {
        mostrarAviso("");
        const tareas = [cargarPedidos(), cargarProductos(), cargarCategorias(), cargarMovimientos(), cargarConfiguracionNegocio()];
        if (window.libreriaRol === "administrador") tareas.push(cargarUsuarios(), cargarMensajes());
        const resultados = await Promise.allSettled(tareas);
        const fallo = resultados.find(resultado => resultado.status === "rejected");
        if (fallo) mostrarAviso(mensajeError(fallo.reason, "No se pudo completar la carga del panel."));
    }

    let panelIniciado = false;
    async function iniciarPanel() {
        if (panelIniciado || !window.libreriaUsuario) return;
        panelIniciado = true;
        configurarRol(window.libreriaRol);
        if (["dashboard", "productos", "inventario", "pedidos", "mensajes", "usuarios", "configuracion"].includes(moduloInicial)) {
            abrirModulo(moduloInicial);
        }
        await cargarTodo();
    }

    document.addEventListener("libreria:auth-lista", iniciarPanel, { once: true });
    iniciarPanel();
});
