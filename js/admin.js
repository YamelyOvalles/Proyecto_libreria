/**
 * Librería Quisqueya - Lógica del Módulo Administrativo (Fase 2)
 * 
 * Funcionalidades operativas:
 * 1. Carga y persistencia de pedidos en localStorage (sincronizados con el catálogo).
 * 2. Cálculo en tiempo real de métricas e indicadores clave de rendimiento (KPIs).
 * 3. Filtrado por estado de despacho y búsqueda por texto.
 * 4. Manipulación del DOM para renderizar la tabla semántica y actualizar estados sin recargar la página.
 * 5. Uso intensivo de funciones puras modulares importadas desde funciones.js.
 */

// Clave de almacenamiento en localStorage para los pedidos del sistema
const CLAVE_PEDIDOS_STORAGE = "libreria_pedidos_sistema";

// Colección inicial de pedidos de demostración (si no existen pedidos previos en el navegador)
const PEDIDOS_POR_DEFECTO = [
    {
        id: "b72e7092-864f-4eee-a560-72d2dd7671f9",
        numero: "LQ-20260906-B72E7092",
        fecha: "06/09/2026 11:38 (UTC-4)",
        correo: "adamsdleons3@gmail.com",
        cliente: "adamsdleons3",
        productos: [
            { id: 1, titulo: "Cien años de soledad", precio: 1150, cantidad: 1, subtotal: 1150 }
        ],
        total: 1150,
        cantidad: 1,
        estado: "pendiente",
        mensaje: "Factura generada y en espera de confirmación de despacho."
    },
    {
        id: "a1f3c490-55e1-4c5b-9d41-334455667788",
        numero: "LQ-20260905-A1F3C490",
        fecha: "05/09/2026 16:20 (UTC-4)",
        correo: "cliente.lector@quisqueya.com",
        cliente: "cliente.lector",
        productos: [
            { id: 2, titulo: "El Principito", precio: 750, cantidad: 1, subtotal: 750 },
            { id: 3, titulo: "1984", precio: 900, cantidad: 1, subtotal: 900 }
        ],
        total: 1650,
        cantidad: 2,
        estado: "procesado",
        mensaje: "Pedido preparado en empaque para entrega."
    },
    {
        id: "89d12e7b-88a2-47d3-9821-aabbccddeeff",
        numero: "LQ-20260904-89D12E7B",
        fecha: "04/09/2026 10:15 (UTC-4)",
        correo: "maria.lopez@dominio.do",
        cliente: "maria.lopez",
        productos: [
            { id: 4, titulo: "Don Quijote de la Mancha", precio: 1350, cantidad: 1, subtotal: 1350 }
        ],
        total: 1350,
        cantidad: 1,
        estado: "entregado",
        mensaje: "Entregado en sucursal Piantini."
    }
];

// Arreglo en memoria con los pedidos activos
let listaPedidos = [];

/**
 * Obtiene los pedidos desde localStorage o inicializa con los valores por defecto.
 * @returns {Array<Object>} Arreglo de pedidos.
 */
function cargarPedidos() {
    try {
        const datosLocales = localStorage.getItem(CLAVE_PEDIDOS_STORAGE);
        if (datosLocales) {
            const parseados = JSON.parse(datosLocales);
            if (Array.isArray(parseados) && parseados.length > 0) {
                return parseados;
            }
        }
    } catch (error) {
        console.warn("No se pudieron cargar los pedidos de localStorage, inicializando por defecto.", error);
    }

    // Si está vacío, guardar y retornar los pedidos de demostración iniciales
    guardarPedidos(PEDIDOS_POR_DEFECTO);
    return [...PEDIDOS_POR_DEFECTO];
}

/**
 * Persiste la lista de pedidos en localStorage.
 * @param {Array<Object>} pedidos - Arreglo de pedidos a guardar.
 */
function guardarPedidos(pedidos) {
    try {
        localStorage.setItem(CLAVE_PEDIDOS_STORAGE, JSON.stringify(pedidos));
    } catch (error) {
        console.error("Error al guardar pedidos en localStorage:", error);
    }
}

/**
 * Calcula y actualiza en el DOM los cuatro indicadores clave (KPIs) del panel.
 * Utiliza las funciones estructuradas de funciones.js:
 * - calcularTotalIngresos()
 * - calcularUnidadesVendidas()
 * - filtrarPedidosPorEstado()
 * - formatearMonedaRD()
 */
function actualizarMetricas() {
    const metricTotalOrders = document.getElementById("metric-total-orders");
    const metricTotalRevenue = document.getElementById("metric-total-revenue");
    const metricPendingOrders = document.getElementById("metric-pending-orders");
    const metricTotalUnits = document.getElementById("metric-total-units");

    // 1. Conteo total de órdenes registradas
    if (metricTotalOrders) {
        metricTotalOrders.textContent = listaPedidos.length;
    }

    // 2. Facturación total acumulada en pesos
    if (metricTotalRevenue) {
        const ingresosTotales = calcularTotalIngresos(listaPedidos);
        metricTotalRevenue.textContent = formatearMonedaRD(ingresosTotales);
    }

    // 3. Cantidad de órdenes con estado "pendiente"
    if (metricPendingOrders) {
        const pendientes = filtrarPedidosPorEstado(listaPedidos, "pendiente");
        metricPendingOrders.textContent = pendientes.length;
    }

    // 4. Conteo de unidades de libros vendidas
    if (metricTotalUnits) {
        const unidades = calcularUnidadesVendidas(listaPedidos);
        metricTotalUnits.textContent = unidades;
    }
}

/**
 * Renderiza la tabla semántica con los pedidos filtrados en el DOM.
 * @param {Array<Object>} pedidosAMostrar - Lista de pedidos a desplegar en las filas.
 */
function renderizarTablaPedidos(pedidosAMostrar) {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Mensaje si no existen coincidencias con los filtros aplicados
    if (pedidosAMostrar.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--muted);">
                    No se encontraron pedidos que coincidan con el criterio de búsqueda o estado seleccionado.
                </td>
            </tr>
        `;
        return;
    }

    // Construir cada fila de la tabla
    pedidosAMostrar.forEach((pedido) => {
        const tr = document.createElement("tr");

        // Construir la lista de artículos comprados
        const listaItemsHtml = (pedido.productos || []).map(p => 
            `<li><strong>${p.cantidad}x</strong> ${p.titulo} (${formatearMonedaRD(p.subtotal)})</li>`
        ).join("");

        // Clase css del badge según el estado
        const estadoLimpio = (pedido.estado || "pendiente").toLowerCase();
        const badgeClase = `badge-${estadoLimpio}`;

        tr.innerHTML = `
            <td>
                <strong>${pedido.numero || pedido.id.slice(0, 8)}</strong>
            </td>
            <td>${pedido.fecha || "Reciente"}</td>
            <td>
                <div>${pedido.cliente || "Cliente"}</div>
                <small style="color: var(--muted);">${pedido.correo || ""}</small>
            </td>
            <td>
                <ul class="order-items-list">
                    ${listaItemsHtml}
                </ul>
            </td>
            <td>
                <strong>${formatearMonedaRD(pedido.total)}</strong>
            </td>
            <td>
                <span class="badge-status ${badgeClase}" id="badge-estado-${pedido.id}">
                    ${estadoLimpio.charAt(0).toUpperCase() + estadoLimpio.slice(1)}
                </span>
            </td>
            <td>
                <select class="status-select" data-pedido-id="${pedido.id}" aria-label="Cambiar estado del pedido ${pedido.numero}">
                    <option value="pendiente" ${estadoLimpio === "pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="procesado" ${estadoLimpio === "procesado" ? "selected" : ""}>Procesado</option>
                    <option value="enviado" ${estadoLimpio === "enviado" ? "selected" : ""}>Enviado</option>
                    <option value="entregado" ${estadoLimpio === "entregado" ? "selected" : ""}>Entregado</option>
                </select>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Escuchar cambios de estado en cada select individual
    tbody.querySelectorAll(".status-select").forEach(select => {
        select.addEventListener("change", (evento) => {
            const pedidoId = evento.target.getAttribute("data-pedido-id");
            const nuevoEstado = evento.target.value;
            actualizarEstadoPedido(pedidoId, nuevoEstado);
        });
    });
}

/**
 * Actualiza el estado de un pedido específico, lo persiste y actualiza la vista.
 * @param {string} id - Identificador del pedido.
 * @param {string} nuevoEstado - Nuevo estado asignado ('pendiente', 'procesado', etc.).
 */
function actualizarEstadoPedido(id, nuevoEstado) {
    const indice = listaPedidos.findIndex(p => p.id === id);
    if (indice >= 0) {
        listaPedidos[indice].estado = nuevoEstado;
        guardarPedidos(listaPedidos);

        // Actualizar el badge visual en la fila correspondiente
        const badge = document.getElementById(`badge-estado-${id}`);
        if (badge) {
            badge.className = `badge-status badge-${nuevoEstado}`;
            badge.textContent = nuevoEstado.charAt(0).toUpperCase() + nuevoEstado.slice(1);
        }

        // Recalcular métricas de inmediato
        actualizarMetricas();
    }
}

/**
 * Aplica los filtros combinados de búsqueda por texto y selección de estado.
 */
function aplicarFiltros() {
    const campoBusqueda = document.getElementById("admin-search-input");
    const filtroEstado = document.getElementById("admin-status-filter");

    const texto = campoBusqueda ? campoBusqueda.value : "";
    const estado = filtroEstado ? filtroEstado.value : "todos";

    // 1. Filtrar por término de búsqueda (título, número o cliente)
    let resultado = buscarPedidosPorTexto(listaPedidos, texto);

    // 2. Filtrar por estado seleccionado
    resultado = filtrarPedidosPorEstado(resultado, estado);

    // Renderizar la tabla con el resultado procesado
    renderizarTablaPedidos(resultado);
}

// =============================================================================
// INICIALIZACIÓN DEL CONTROLADOR ADMINISTRATIVO
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Cargar la lista inicial de pedidos
    listaPedidos = cargarPedidos();

    // Actualizar métricas iniciales
    actualizarMetricas();

    // Renderizar tabla con todos los pedidos
    renderizarTablaPedidos(listaPedidos);

    // Asignar listeners a los controles de la barra de herramientas
    const campoBusqueda = document.getElementById("admin-search-input");
    const filtroEstado = document.getElementById("admin-status-filter");
    const btnRefrescar = document.getElementById("admin-refresh-btn");

    if (campoBusqueda) {
        campoBusqueda.addEventListener("input", aplicarFiltros);
    }

    if (filtroEstado) {
        filtroEstado.addEventListener("change", aplicarFiltros);
    }

    if (btnRefrescar) {
        btnRefrescar.addEventListener("click", () => {
            listaPedidos = cargarPedidos();
            actualizarMetricas();
            aplicarFiltros();
        });
    }
});

