/* Confirmación del pedido mediante el servidor local. Las claves de Gmail nunca llegan aquí. */
window.crearCheckout = function ({ obtenerCarrito, vaciarCarrito }) {
    const boton = document.getElementById("checkout-btn");
    const estado = document.getElementById("checkout-status");
    const descargar = document.getElementById("invoice-download");
    const reenviar = document.getElementById("invoice-retry");
    let ocupado = false;
    let ultimoPedido = null;
    let pendiente = null;
    try { pendiente = JSON.parse(localStorage.getItem("libreriaPedidoPendiente")); } catch (_) { /* Almacenamiento opcional. */ }

    function guardarPendiente(valor) {
        pendiente = valor;
        try {
            if (valor) localStorage.setItem("libreriaPedidoPendiente", JSON.stringify(valor));
            else localStorage.removeItem("libreriaPedidoPendiente");
        } catch (_) { /* El pedido sigue protegido contra doble clic durante esta sesión. */ }
    }
    function bloquear(valor) {
        ocupado = valor;
        boton.disabled = valor;
        reenviar.disabled = valor;
        boton.textContent = valor ? "Preparando factura…" : "Confirmar pedido y enviar factura";
    }
    async function solicitar(ruta, datos) {
        if (location.protocol === "file:") throw new Error("Abre el proyecto con INICIAR-LIBRERIA.cmd para generar y enviar facturas.");
        async function conectar(url, opciones) {
            try { return await fetch(url, opciones); }
            catch (_) { throw new Error("No hay conexión con el servidor de facturas. Mantén INICIAR-LIBRERIA.cmd abierto y entra en http://127.0.0.1:8000."); }
        }
        const configuracion = await conectar("/api/config");
        if (!configuracion.ok || !configuracion.headers.get("content-type")?.includes("application/json")) throw new Error("Abre http://127.0.0.1:8000 con INICIAR-LIBRERIA.cmd en ejecución para usar las facturas.");
        const { token } = await configuracion.json();
        const respuesta = await conectar(ruta, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Libreria-Token": token },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || "No se pudo confirmar el pedido.");
        return resultado;
    }
    function mostrar(pedido) {
        ultimoPedido = pedido;
        estado.textContent = `${pedido.numero} · Total RD$ ${pedido.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}. ${pedido.mensaje}`;
        estado.dataset.estado = pedido.estado;
        descargar.href = `/api/facturas/${pedido.id}`;
        descargar.download = `${pedido.numero}.pdf`;
        descargar.hidden = false;
        reenviar.hidden = pedido.estado === "enviado";
        try { localStorage.setItem("libreriaUltimaFactura", JSON.stringify(pedido)); } catch (_) { /* Opcional. */ }
    }
    try {
        const anterior = JSON.parse(localStorage.getItem("libreriaUltimaFactura"));
        if (anterior && anterior.id && anterior.numero) mostrar(anterior);
    } catch (_) { /* No hay factura anterior. */ }
    if (pendiente) estado.textContent = "Hay un pedido sin respuesta confirmada. Pulsa confirmar para recuperar su factura sin duplicarlo.";

    boton.addEventListener("click", async () => {
        if (ocupado) return;
        const carrito = obtenerCarrito();
        if (!pendiente && !carrito.length) {
            estado.textContent = "Agrega al menos un libro al carrito.";
            return;
        }
        bloquear(true);
        estado.textContent = "Generando tu factura y preparando el correo…";
        try {
            if (location.protocol === "file:") throw new Error("Abre el proyecto con INICIAR-LIBRERIA.cmd para generar y enviar facturas.");
            if (!pendiente) guardarPendiente({ id: crypto.randomUUID(), productos: carrito.map(({ id, cantidad }) => ({ id, cantidad })) });
            const snapshot = pendiente.productos;
            const pedido = await solicitar("/api/pedidos", pendiente);
            vaciarCarrito(snapshot);
            guardarPendiente(null);
            mostrar(pedido);
        } catch (error) {
            estado.textContent = `${error.message} Tu carrito se conserva.`;
            estado.dataset.estado = "pendiente";
        } finally { bloquear(false); }
    });
    reenviar.addEventListener("click", async () => {
        if (ocupado || !ultimoPedido) return;
        if ((ultimoPedido.estado === "incierto" || ultimoPedido.estado === "enviando") &&
            !confirm("El envío anterior no pudo confirmarse. Revisa primero tu correo. ¿Quieres intentar enviarlo otra vez?")) return;
        bloquear(true);
        estado.textContent = "Enviando la factura…";
        try { mostrar(await solicitar("/api/reenviar", { id: ultimoPedido.id })); }
        catch (error) { estado.textContent = error.message; }
        finally { bloquear(false); }
    });
    return { estaOcupado: () => ocupado };
};
