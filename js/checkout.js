/**
 * Librería Quisqueya - Confirmación de Pedidos y Checkout (Fase 2)
 * Maneja la confirmación de la orden, la persistencia en el almacenamiento local
 * (para sincronización inmediata con el panel administrativo) y la integración
 * opcional con el servidor local de facturas en Python.
 */
window.crearCheckout = function ({ obtenerCarrito, vaciarCarrito }) {
    const boton = document.getElementById("checkout-btn");
    const estado = document.getElementById("checkout-status");
    const descargar = document.getElementById("invoice-download");
    const reenviar = document.getElementById("invoice-retry");
    let ocupado = false;
    let ultimoPedido = null;
    let pendiente = null;

    try { 
        pendiente = JSON.parse(localStorage.getItem("libreriaPedidoPendiente")); 
    } catch (_) { /* Almacenamiento opcional */ }

    /**
     * Guarda o limpia el pedido pendiente en el almacenamiento local.
     */
    function guardarPendiente(valor) {
        pendiente = valor;
        try {
            if (valor) localStorage.setItem("libreriaPedidoPendiente", JSON.stringify(valor));
            else localStorage.removeItem("libreriaPedidoPendiente");
        } catch (_) { /* Protección durante la sesión */ }
    }

    /**
     * Bloquea o desbloquea los botones durante la ejecución de operaciones.
     */
    function bloquear(valor) {
        ocupado = valor;
        if (boton) {
            boton.disabled = valor;
            boton.textContent = valor ? "Procesando pedido…" : "Confirmar pedido y enviar factura";
        }
        if (reenviar) reenviar.disabled = valor;
    }

    /**
     * Guarda el pedido en la colección de pedidos del sistema en localStorage,
     * permitiendo que el módulo administrativo (admin.html) lo visualice de inmediato.
     * @param {Object} pedido - Objeto con datos del pedido.
     */
    function sincronizarConPanelAdministrativo(pedido) {
        try {
            let listaPedidos = JSON.parse(localStorage.getItem("libreria_pedidos_sistema") || "[]");
            const indiceExistente = listaPedidos.findIndex(p => p.id === pedido.id || p.numero === pedido.numero);
            if (indiceExistente >= 0) {
                listaPedidos[indiceExistente] = { ...listaPedidos[indiceExistente], ...pedido };
            } else {
                listaPedidos.unshift(pedido);
            }
            localStorage.setItem("libreria_pedidos_sistema", JSON.stringify(listaPedidos));
        } catch (e) {
            console.warn("No se pudo registrar en la base de pedidos local:", e);
        }
    }

    /**
     * Intenta conectar con el servidor local de facturas si está disponible.
     */
    async function solicitarServidor(ruta, datos) {
        if (location.protocol === "file:") {
            throw new Error("Modo local en navegador.");
        }
        const configuracion = await fetch("/api/config");
        if (!configuracion.ok || !configuracion.headers.get("content-type")?.includes("application/json")) {
            throw new Error("Servidor no detectado.");
        }
        const { token } = await configuracion.json();
        const respuesta = await fetch(ruta, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Libreria-Token": token },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || "No se pudo confirmar el pedido.");
        return resultado;
    }

    /**
     * Crea un pedido estructurado en el navegador para la Fase 2 (100% cliente).
     */
    function crearPedidoEnNavegador(idPedido, itemsCarrito) {
        const ahora = new Date();
        const fechaStr = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')} (UTC-4)`;
        const uuidCorto = idPedido.replace(/-/g, "").slice(0, 8).toUpperCase();
        const numPedido = `LQ-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${uuidCorto}`;
        const usuarioActual = sessionStorage.getItem("libreriaUser") || localStorage.getItem("libreriaUser") || "cliente@libreriaquisqueya.com";

        const productosDetalle = itemsCarrito.map(item => ({
            id: item.id,
            titulo: item.titulo,
            precio: item.precio,
            cantidad: item.cantidad,
            subtotal: item.precio * item.cantidad
        }));

        const totalMonto = productosDetalle.reduce((acc, p) => acc + p.subtotal, 0);
        const totalCant = productosDetalle.reduce((acc, p) => acc + p.cantidad, 0);

        return {
            id: idPedido,
            numero: numPedido,
            fecha: fechaStr,
            correo: usuarioActual,
            cliente: usuarioActual.split("@")[0],
            productos: productosDetalle,
            total: totalMonto,
            cantidad: totalCant,
            estado: "pendiente",
            mensaje: "Pedido confirmado con éxito y registrado en el panel operativo."
        };
    }

    /**
     * Muestra en el DOM el resultado del pedido confirmado.
     */
    function mostrar(pedido) {
        ultimoPedido = pedido;
        sincronizarConPanelAdministrativo(pedido);

        if (estado) {
            estado.textContent = `${pedido.numero} · Total RD$ ${pedido.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}. ${pedido.mensaje}`;
            estado.dataset.estado = pedido.estado;
        }

        if (descargar) {
            if (location.protocol !== "file:") {
                descargar.href = `/api/facturas/${pedido.id}`;
                descargar.download = `${pedido.numero}.pdf`;
                descargar.hidden = false;
            } else {
                descargar.hidden = true;
            }
        }

        if (reenviar) {
            reenviar.hidden = (pedido.estado === "enviado" || location.protocol === "file:");
        }

        try { 
            localStorage.setItem("libreriaUltimaFactura", JSON.stringify(pedido)); 
        } catch (_) { /* Opcional */ }
    }

    // Cargar factura previa si existe
    try {
        const anterior = JSON.parse(localStorage.getItem("libreriaUltimaFactura"));
        if (anterior && anterior.id && anterior.numero) mostrar(anterior);
    } catch (_) { /* Sin factura previa */ }

    if (pendiente && estado) {
        estado.textContent = "Hay un pedido pendiente por confirmar. Pulsa confirmar para procesarlo.";
    }

    // Evento de clic para confirmar compra
    if (boton) {
        boton.addEventListener("click", async () => {
            if (ocupado) return;
            const carrito = obtenerCarrito();

            if (!pendiente && (!carrito || !carrito.length)) {
                if (estado) estado.textContent = "Agrega al menos un libro al carrito para realizar el pedido.";
                return;
            }

            bloquear(true);
            if (estado) estado.textContent = "Procesando tu pedido en Librería Quisqueya…";

            const idPedido = pendiente ? pendiente.id : (crypto.randomUUID ? crypto.randomUUID() : "ped-" + Date.now());
            if (!pendiente) {
                guardarPendiente({ id: idPedido, productos: carrito.map(({ id, cantidad }) => ({ id, cantidad })) });
            }
            const snapshot = pendiente.productos;

            try {
                let pedidoFinal;
                try {
                    // Intento 1: Servidor Python local si está en ejecución
                    pedidoFinal = await solicitarServidor("/api/pedidos", pendiente);
                } catch (_) {
                    // Intento 2: Funcionamiento autónomo del navegador (Requisito Fase 2)
                    pedidoFinal = crearPedidoEnNavegador(idPedido, carrito);
                }

                vaciarCarrito(snapshot);
                guardarPendiente(null);
                mostrar(pedidoFinal);

            } catch (error) {
                if (estado) {
                    estado.textContent = `${error.message} Tu carrito se conserva.`;
                    estado.dataset.estado = "pendiente";
                }
            } finally {
                bloquear(false);
            }
        });
    }

    if (reenviar) {
        reenviar.addEventListener("click", async () => {
            if (ocupado || !ultimoPedido) return;
            bloquear(true);
            if (estado) estado.textContent = "Reenviando confirmación…";
            try {
                const actualizado = await solicitarServidor("/api/reenviar", { id: ultimoPedido.id });
                mostrar(actualizado);
            } catch (error) {
                if (estado) estado.textContent = error.message;
            } finally {
                bloquear(false);
            }
        });
    }

    return { estaOcupado: () => ocupado };
};

