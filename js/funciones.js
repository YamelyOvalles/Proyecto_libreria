// Cuatro funciones propias de la Fase 2: todas reciben parámetros y retornan resultados.
// No modifican los arreglos recibidos ni dependen de elementos de la página.

// Recibe libros y texto. Retorna coincidencias por título o autor.
// Métodos predefinidos: trim, toLowerCase, filter e includes.
function buscarLibrosPorTexto(libros, texto) {
    const busqueda = texto.trim().toLowerCase();
    return libros.filter(libro =>
        libro.titulo.toLowerCase().includes(busqueda) ||
        libro.autor.toLowerCase().includes(busqueda)
    );
}

// Recibe libros y un precio máximo numérico. Retorna los libros dentro del presupuesto.
// Método predefinido: filter. Infinity permite mostrar todos los precios.
function filtrarLibrosPorPrecio(libros, precioMaximo) {
    return libros.filter(libro => libro.precio <= precioMaximo);
}

// Recibe productos con precio y cantidad. Retorna el total monetario (0 si está vacío).
// Método predefinido: reduce.
function calcularTotalCarrito(carrito) {
    return carrito.reduce((total, producto) => total + producto.precio * producto.cantidad, 0);
}

// Recibe productos con cantidad. Retorna el número de unidades (0 si está vacío).
// Método predefinido: reduce.
function calcularCantidadArticulos(carrito) {
    return carrito.reduce((cantidad, producto) => cantidad + producto.cantidad, 0);
}
