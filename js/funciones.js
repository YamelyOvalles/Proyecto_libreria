/**
 * Librería Quisqueya - Funciones Reutilizables de Negocio (Fase 2)
 * 
 * Cumplimiento del Requerimiento 2:
 * - Mínimo 4 funciones propias (aquí se implementan 8 funciones).
 * - Todas las funciones reciben parámetros formales y retornan un resultado explícito.
 * - Hacen uso de métodos predefinidos del lenguaje (filter, reduce, includes, toLowerCase, trim, toLocaleString).
 * - Son funciones puras: no mutan los datos originales ni dependen de elementos del DOM.
 */

// =============================================================================
// FUNCIONES PARA EL CATÁLOGO DE LIBROS
// =============================================================================

/**
 * Filtra un arreglo de libros buscando coincidencias en el título o autor.
 * Métodos predefinidos utilizados: trim(), toLowerCase(), filter(), includes().
 * 
 * @param {Array<Object>} libros - Arreglo de libros con propiedades titulo y autor.
 * @param {string} texto - Término de búsqueda ingresado por el usuario.
 * @returns {Array<Object>} Nuevo arreglo con los libros que coinciden con la búsqueda.
 */
function buscarLibrosPorTexto(libros, texto) {
    if (!Array.isArray(libros)) return [];
    const busqueda = (texto || "").trim().toLowerCase();
    if (!busqueda) return [...libros];

    return libros.filter(libro =>
        libro.titulo.toLowerCase().includes(busqueda) ||
        libro.autor.toLowerCase().includes(busqueda)
    );
}

/**
 * Filtra los libros cuyo precio sea menor o igual al valor máximo establecido.
 * Método predefinido utilizado: filter().
 * 
 * @param {Array<Object>} libros - Arreglo de libros a evaluar.
 * @param {number} precioMaximo - Límite presupuestario (o Infinity para sin límite).
 * @returns {Array<Object>} Nuevo arreglo con los libros dentro del rango de precio.
 */
function filtrarLibrosPorPrecio(libros, precioMaximo) {
    if (!Array.isArray(libros)) return [];
    const limite = typeof precioMaximo === "number" && !isNaN(precioMaximo) ? precioMaximo : Infinity;
    return libros.filter(libro => libro.precio <= limite);
}


// =============================================================================
// FUNCIONES PARA EL CARRITO DE COMPRAS
// =============================================================================

/**
 * Calcula el monto total a pagar sumando los subtotales de cada producto en el carrito.
 * Método predefinido utilizado: reduce().
 * 
 * @param {Array<Object>} carrito - Arreglo de ítems con precio y cantidad.
 * @returns {number} Suma acumulada total en pesos (0 si el carrito está vacío).
 */
function obtenerMontoTotal(carrito) {
    if (!Array.isArray(carrito)) return 0;
    return carrito.reduce((total, item) => {
        const precio = Number(item.precio) || 0;
        const cantidad = Number(item.cantidad) || 0;
        return total + (precio * cantidad);
    }, 0);
}

/**
 * Calcula el número total de unidades de libros agregadas al carrito.
 * Método predefinido utilizado: reduce().
 * 
 * @param {Array<Object>} carrito - Arreglo de ítems con propiedad cantidad.
 * @returns {number} Cantidad acumulada de artículos.
 */
function obtenerCantidadArticulos(carrito) {
    if (!Array.isArray(carrito)) return 0;
    return carrito.reduce((cantidad, item) => cantidad + (Number(item.cantidad) || 0), 0);
}


// =============================================================================
// FUNCIONES PARA EL MÓDULO ADMINISTRATIVO Y GESTIÓN DE PEDIDOS
// =============================================================================

/**
 * Filtra la lista de pedidos según el estado seleccionado (pendiente, procesado, etc.).
 * Métodos predefinidos utilizados: filter(), toLowerCase(), trim().
 * 
 * @param {Array<Object>} pedidos - Arreglo de objetos de pedido.
 * @param {string} estado - Estado a filtrar ('todos' o un estado específico).
 * @returns {Array<Object>} Arreglo con los pedidos que coinciden con el estado.
 */
function filtrarPedidosPorEstado(pedidos, estado) {
    if (!Array.isArray(pedidos)) return [];
    const estadoFiltro = (estado || "").trim().toLowerCase();
    if (!estadoFiltro || estadoFiltro === "todos") return [...pedidos];

    return pedidos.filter(pedido => (pedido.estado || "").toLowerCase() === estadoFiltro);
}

/**
 * Busca pedidos por número identificador, correo o nombre de cliente.
 * Métodos predefinidos utilizados: filter(), toLowerCase(), trim(), includes().
 * 
 * @param {Array<Object>} pedidos - Arreglo de pedidos.
 * @param {string} textoBusqueda - Texto a buscar.
 * @returns {Array<Object>} Arreglo con los pedidos coincidentes.
 */
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

/**
 * Calcula los ingresos brutos totales facturados a partir de una lista de pedidos.
 * Método predefinido utilizado: reduce().
 * 
 * @param {Array<Object>} pedidos - Arreglo con todos los pedidos.
 * @returns {number} Monto total facturado.
 */
function calcularTotalIngresos(pedidos) {
    if (!Array.isArray(pedidos)) return 0;
    return pedidos.reduce((acumulado, pedido) => acumulado + (Number(pedido.total) || 0), 0);
}

/**
 * Calcula el número total de unidades de libros despachadas o vendidas en los pedidos.
 * Método predefinido utilizado: reduce().
 * 
 * @param {Array<Object>} pedidos - Arreglo de pedidos.
 * @returns {number} Total de libros vendidos.
 */
function calcularUnidadesVendidas(pedidos) {
    if (!Array.isArray(pedidos)) return 0;
    return pedidos.reduce((total, pedido) => total + (Number(pedido.cantidad) || 0), 0);
}

/**
 * Formatea un valor numérico como moneda de la República Dominicana (RD$).
 * Métodos predefinidos utilizados: Number.toLocaleString().
 * 
 * @param {number} monto - Valor numérico a formatear.
 * @returns {string} Cadena formateada, por ejemplo: "RD$ 1,150.00".
 */
function formatearMonedaRD(monto) {
    const valor = Number(monto) || 0;
    return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

