document.addEventListener("DOMContentLoaded", async () => {
    const parametros = new URLSearchParams(location.search);
    const tipo = parametros.get("tipo");
    const id = parametros.get("id");
    const accion = parametros.get("accion");
    const vieneDeAdmin = document.referrer.includes("admin.html");
    const regreso = vieneDeAdmin ? "admin.html#pedidos" : "tienda.html";
    document.getElementById("document-back").href = regreso;
    document.getElementById("document-back").textContent = vieneDeAdmin ? "Volver a pedidos" : "Volver a la tienda";
    document.getElementById("document-error-back").href = regreso;

    function mostrarError(mensaje) {
        document.getElementById("document-page").hidden = true;
        document.getElementById("document-error-text").textContent = mensaje;
        document.getElementById("document-error").hidden = false;
    }

    function texto(valor, alternativo = "No indicado") {
        return valor === null || valor === undefined || valor === "" ? alternativo : String(valor);
    }

    function moneda(valor) {
        return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(valor || 0));
    }

    function fecha(valor) {
        if (!valor) return "No aplica";
        return new Date(`${valor}T12:00:00`).toLocaleDateString("es-DO", {
            day: "2-digit", month: "2-digit", year: "numeric"
        });
    }

    function agregarDato(lista, etiqueta, valor, alternativo) {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = etiqueta;
        dd.textContent = texto(valor, alternativo);
        lista.append(dt, dd);
    }

    function agregarTotal(lista, etiqueta, valor, clase = "") {
        const fila = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        fila.className = clase;
        dt.textContent = etiqueta;
        dd.textContent = moneda(valor);
        fila.append(dt, dd);
        lista.appendChild(fila);
    }

    function agregarBloque(contenedor, titulo, contenido) {
        if (!contenido) return;
        const bloque = document.createElement("div");
        const encabezado = document.createElement("strong");
        const parrafo = document.createElement("p");
        bloque.className = "text-block";
        encabezado.textContent = titulo;
        parrafo.textContent = contenido;
        bloque.append(encabezado, parrafo);
        contenedor.appendChild(bloque);
    }

    function renderizar(documento) {
        const datos = documento.snapshot;
        const empresa = datos.empresa || {};
        const detalle = datos.documento || {};
        const cliente = datos.cliente || {};
        const totales = datos.totales || {};
        const esFactura = tipo === "factura";

        document.title = `${documento.numero} | ${texto(empresa.nombre_comercial, "Librería Quisqueya")}`;
        document.getElementById("document-logo").src = empresa.logo_url || "assets/logo-quisqueya-profesional.png";
        document.getElementById("business-name").textContent = texto(empresa.nombre_comercial, "Librería Quisqueya");
        document.getElementById("business-tagline").textContent = empresa.eslogan || "";
        document.getElementById("business-contact").textContent = [
            empresa.razon_social,
            empresa.rnc ? `RNC: ${empresa.rnc}` : null,
            [empresa.direccion, empresa.ciudad, empresa.provincia, empresa.pais].filter(Boolean).join(", "),
            [empresa.telefono, empresa.correo].filter(Boolean).join(" · ")
        ].filter(Boolean).join("\n");

        document.getElementById("document-type").textContent = esFactura ? "Factura" : "Cotización";
        document.getElementById("document-number").textContent = documento.numero;
        const fechas = document.getElementById("document-dates");
        agregarDato(fechas, "Emisión", fecha(documento.fecha_emision));
        if (esFactura && documento.ncf) agregarDato(fechas, "NCF", documento.ncf);
        if (!esFactura) agregarDato(fechas, "Válida hasta", fecha(documento.valida_hasta));
        if (esFactura && documento.fecha_vencimiento) agregarDato(fechas, "Vencimiento", fecha(documento.fecha_vencimiento));

        const clienteDatos = document.getElementById("client-data");
        agregarDato(clienteDatos, "Cliente", cliente.nombre);
        agregarDato(clienteDatos, "RNC / Cédula", cliente.documento);
        agregarDato(clienteDatos, "Teléfono", cliente.telefono);
        agregarDato(clienteDatos, "Correo", cliente.correo);
        agregarDato(clienteDatos, "Dirección", cliente.direccion);

        const ventaDatos = document.getElementById("sale-data");
        agregarDato(ventaDatos, "Pedido", datos.pedido?.numero);
        agregarDato(ventaDatos, esFactura ? "Facturado por" : "Atendido por", detalle.atendido_por);
        agregarDato(ventaDatos, "Forma de pago", texto(detalle.metodo_pago).replaceAll("_", " "));
        if (esFactura) agregarDato(ventaDatos, "Condición", texto(detalle.condicion_pago).replaceAll("_", " "));
        else agregarDato(ventaDatos, "Entrega estimada", detalle.tiempo_entrega);

        const cuerpo = document.getElementById("document-items");
        (datos.articulos || []).forEach(articulo => {
            const fila = document.createElement("tr");
            const cantidad = document.createElement("td");
            const descripcion = document.createElement("td");
            const precio = document.createElement("td");
            const descuento = document.createElement("td");
            const total = document.createElement("td");
            cantidad.textContent = articulo.cantidad;
            descripcion.textContent = texto(articulo.descripcion);
            if (articulo.isbn) {
                const isbn = document.createElement("span");
                isbn.className = "item-isbn";
                isbn.textContent = `ISBN: ${articulo.isbn}`;
                descripcion.appendChild(isbn);
            }
            precio.textContent = moneda(articulo.precio_unitario);
            descuento.textContent = `${Number(articulo.descuento_pct || 0)}%`;
            total.textContent = moneda(articulo.total);
            fila.append(cantidad, descripcion, precio, descuento, total);
            cuerpo.appendChild(fila);
        });

        const textos = document.getElementById("document-texts");
        agregarBloque(textos, "Condiciones", detalle.condiciones);
        agregarBloque(textos, "Notas", detalle.notas);
        agregarBloque(textos, "Observaciones del pedido", datos.pedido?.notas);

        const listaTotales = document.getElementById("document-totals");
        agregarTotal(listaTotales, "Subtotal", totales.subtotal);
        if (Number(totales.descuento) > 0) agregarTotal(listaTotales, "Descuento", -Number(totales.descuento));
        if (detalle.mostrar_itbis) agregarTotal(listaTotales, `ITBIS incluido (${Number(detalle.itbis_pct || 0)}%)`, totales.itbis);
        if (Number(totales.costo_envio) > 0) agregarTotal(listaTotales, "Envío", totales.costo_envio);
        agregarTotal(listaTotales, "Total", totales.total, "grand-total");

        document.getElementById("footer-business").textContent = texto(empresa.nombre_comercial, "Librería Quisqueya");
        document.getElementById("footer-contact").textContent = [empresa.telefono, empresa.correo, empresa.sitio_web].filter(Boolean).join(" · ");
        document.getElementById("document-page").hidden = false;
    }

    document.getElementById("document-print").addEventListener("click", () => window.print());

    if (!window.libreriaSupabaseConfigurado || !["cotizacion", "factura"].includes(tipo) || !id) {
        mostrarError("El enlace del documento no es válido o Supabase no está configurado.");
        return;
    }

    const { data: sesion } = await window.libreriaSupabase.auth.getSession();
    if (!sesion.session) {
        location.replace(`login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
        return;
    }

    const tabla = tipo === "cotizacion" ? "cotizaciones" : "facturas";
    const { data, error } = await window.libreriaSupabase.from(tabla).select("*").eq("id", id).single();
    if (error || !data) {
        mostrarError(error?.message || "No tienes permiso para consultar este documento.");
        return;
    }

    renderizar(data);
    if (["imprimir", "descargar"].includes(accion)) {
        document.getElementById("document-help").textContent = accion === "descargar"
            ? "En Destino selecciona “Guardar como PDF”."
            : "Selecciona tu impresora y confirma la impresión.";
        setTimeout(() => window.print(), 350);
    }
});
