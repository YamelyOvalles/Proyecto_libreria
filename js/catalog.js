// Catálogo de libros
let libros = [
    { titulo: "Cien años de soledad", autor: "Gabriel García Márquez", precio: 1150 },
    { titulo: "El Principito", autor: "Antoine de Saint-Exupéry", precio: 750 },
    { titulo: "1984", autor: "George Orwell", precio: 900 },
    { titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", precio: 1350 }
];

// Variable dinámica con el total de títulos
let totalLibros = libros.length;

// Función para buscar libros por título
function buscarLibro(nombre) {
    return libros.filter(libro =>
        libro.titulo.toLowerCase().includes(nombre.toLowerCase())
    );
}

// Mostrar resultados en consola
console.log("Total de libros en catálogo:", totalLibros);
console.log("Resultado de búsqueda:", buscarLibro("principito"));

// Mostrar el total de libros en pantalla
document.getElementById("contador").textContent =
    "Total de libros disponibles: " + libros.length
