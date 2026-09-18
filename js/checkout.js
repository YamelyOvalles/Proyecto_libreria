// Confirma pedidos en Supabase.
window.crearCheckout = function ({ obtenerCarrito, vaciarCarrito }) {
    const boton = document.getElementById("checkout-btn");
    const estado = document.getElementById("checkout-status");
    const entrega = document.getElementById("delivery-method");
    const pago = document.getElementById("payment-method");
    const sucursal = document.getElementById("pickup-branch");
    const camposSucursal = document.getElementById("pickup-fields");
    const camposDireccion = document.getElementById("address-fields");
    let ocupado = false;

    function informar(texto, tipo = "pendiente") {
        if (!estado) return;
        estado.textContent = texto;
        estado.dataset.estado = tipo;
    }

    function bloquear(valor) {
        ocupado = valor;
        boton.disabled = valor;
        boton.textContent = valor ? "Procesando pedido…" : "Confirmar pedido";
    }

    async function cargarSucursales() {
        if (!window.libreriaSupabase) return;
        const { data, error } = await window.libreriaSupabase
            .from("sucursales").select("id,nombre,ciudad").eq("activo", true).order("nombre");
        sucursal.replaceChildren();
        if (error) {
            const opcion = new Option("No se pudieron cargar las sucursales", "");
            sucursal.add(opcion);
            return;
        }
        data.forEach(item => sucursal.add(new Option(`${item.nombre} — ${item.ciudad}`, item.id)));
    }

    function alternarEntrega() {
        const domicilio = entrega.value === "domicilio";
        camposDireccion.hidden = !domicilio;
        camposSucursal.hidden = domicilio;
    }

    function leerDireccion() {
        const valores = {
            destinatario: document.getElementById("delivery-recipient").value.trim(),
            telefono: document.getElementById("delivery-phone").value.trim(),
            linea_1: document.getElementById("delivery-line1").value.trim(),
            sector: document.getElementById("delivery-sector").value.trim() || null,
            ciudad: document.getElementById("delivery-city").value.trim(),
            provincia: document.getElementById("delivery-province").value.trim(),
            referencia: document.getElementById("delivery-reference").value.trim() || null
        };
        if (!valores.destinatario || !valores.telefono || !valores.linea_1 || !valores.ciudad || !valores.provincia) {
            throw new Error("Completa los datos obligatorios de la dirección.");
        }
        return valores;
    }

    function leerDatosPedido(domicilio) {
        const comunes = {
            telefono_cliente: document.getElementById("checkout-customer-phone").value.trim() || null,
            documento: document.getElementById("checkout-customer-document").value.trim() || null
        };
        return domicilio ? { ...leerDireccion(), ...comunes } : comunes;
    }

    async function buscarCotizacion(pedidoId) {
        for (let intento = 0; intento < 3; intento += 1) {
            const { data, error } = await window.libreriaSupabase
                .from("cotizaciones")
                .select("id")
                .eq("pedido_id", pedidoId)
                .maybeSingle();
            if (error) throw error;
            if (data?.id) return data;
            await new Promise(resolver => setTimeout(resolver, 250));
        }
        return null;
    }

    entrega.addEventListener("change", alternarEntrega);
    alternarEntrega();
    cargarSucursales();

    boton.addEventListener("click", async () => {
        if (ocupado) return;
        if (!obtenerCarrito().length) return informar("Agrega al menos un libro al carrito.");
        if (!window.libreriaSupabase) return informar("Supabase todavía no está configurado.");

        try {
            const domicilio = entrega.value === "domicilio";
            if (!domicilio && !sucursal.value) throw new Error("Selecciona una sucursal.");
            bloquear(true);
            informar("Validando existencias y creando el pedido…");

            const { data, error } = await window.libreriaSupabase.rpc("crear_pedido_desde_carrito", {
                p_metodo_entrega: entrega.value,
                p_sucursal_id: domicilio ? null : Number(sucursal.value),
                p_metodo_pago: pago.value,
                p_direccion: leerDatosPedido(domicilio),
                p_notas: null
            });
            if (error) throw error;

            vaciarCarrito();
            informar(`${data.numero} confirmado. Preparando cotización…`, "enviado");

            try {
                const cotizacion = await buscarCotizacion(data.id);
                if (cotizacion) {
                    window.location.assign(`documento.html?tipo=cotizacion&id=${encodeURIComponent(cotizacion.id)}&accion=imprimir`);
                    return;
                }
                informar(`${data.numero} fue confirmado, pero la cotización todavía no está disponible. El administrador podrá consultarla desde el pedido.`, "enviado");
            } catch (errorCotizacion) {
                console.error("El pedido se creó, pero no se pudo abrir su cotización:", errorCotizacion);
                informar(`${data.numero} fue confirmado. No se pudo abrir la cotización automáticamente.`, "enviado");
            }
        } catch (error) {
            informar(window.mensajeErrorSupabase(error, error.message || "No se pudo crear el pedido."));
        } finally {
            bloquear(false);
        }
    });

    return { estaOcupado: () => ocupado };
};

