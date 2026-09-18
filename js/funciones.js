// Funciones reutilizables del catalogo, carrito y panel.

function buscarLibrosPorTexto(libros, texto) {
    if (!Array.isArray(libros)) return [];
    const busqueda = (texto || "").trim().toLowerCase();
    if (!busqueda) return [...libros];

    return libros.filter(libro =>
        libro.titulo.toLowerCase().includes(busqueda) ||
        libro.autor.toLowerCase().includes(busqueda)
    );
}

function filtrarLibrosPorPrecio(libros, precioMaximo) {
    if (!Array.isArray(libros)) return [];
    const limite = typeof precioMaximo === "number" && !isNaN(precioMaximo) ? precioMaximo : Infinity;
    return libros.filter(libro => libro.precio <= limite);
}


function obtenerMontoTotal(carrito) {
    if (!Array.isArray(carrito)) return 0;
    return carrito.reduce((total, item) => {
        const precio = Number(item.precio) || 0;
        const cantidad = Number(item.cantidad) || 0;
        return total + (precio * cantidad);
    }, 0);
}

function obtenerCantidadArticulos(carrito) {
    if (!Array.isArray(carrito)) return 0;
    return carrito.reduce((cantidad, item) => cantidad + (Number(item.cantidad) || 0), 0);
}


function filtrarPedidosPorEstado(pedidos, estado) {
    if (!Array.isArray(pedidos)) return [];
    const estadoFiltro = (estado || "").trim().toLowerCase();
    if (!estadoFiltro || estadoFiltro === "todos") return [...pedidos];

    return pedidos.filter(pedido => (pedido.estado || "").toLowerCase() === estadoFiltro);
}

function buscarPedidosPorTexto(pedidos, textoBusqueda) {
    if (!Array.isArray(pedidos)) return [];
    const query = (textoBusqueda || "").trim().toLowerCase();
    if (!query) return [...pedidos];

    return pedidos.filter(pedido =>
        (pedido.numero || "").toLowerCase().includes(query) ||
        (pedido.correo || "").toLowerCase().includes(query) ||
        (pedido.cliente || "").toLowerCase().includes(query)
    );
}

function calcularTotalIngresos(pedidos) {
    if (!Array.isArray(pedidos)) return 0;
    return pedidos.reduce((acumulado, pedido) => acumulado + (Number(pedido.total) || 0), 0);
}

function calcularUnidadesVendidas(pedidos) {
    if (!Array.isArray(pedidos)) return 0;
    return pedidos.reduce((total, pedido) => total + (Number(pedido.cantidad) || 0), 0);
}

function formatearMonedaRD(monto) {
    const valor = Number(monto) || 0;
    return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

