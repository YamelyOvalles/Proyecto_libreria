# Bookstore Manager - Sistema Integrado

Sistema de gestión integral para librerías con módulos de inventario, servicios personalizados y gestión de operaciones retail.

## 📋 Descripción del Proyecto

**Bibliotheca Direct** es una solución completa de gestión para librerías que integra:
- **Login**: Autenticación segura de usuarios
- **Gestión de Inventario**: Control de productos, categorías y stock
- **Servicios Personalizados**: Configuración de tarifas (impresión, encuadernación, escaneo, etc.)
- **Interfaz Responsiva**: Diseño adaptable a dispositivos móviles y desktop

## 🎨 Características de Diseño

### Tema de Color (Bibliotheca Direct)
- **Primario**: Verde tierra (#4d662d)
- **Secundario**: Marrón (#725b3a)
- **Terciario**: Púrpura (#804d77)
- **Paleta Neutra**: Tonos claros y grises profesionales

### Tipografía
- **Display/Titulares**: Plus Jakarta Sans (600-700 weight)
- **Cuerpo**: Inter (400-600 weight)

### Componentes
- Formularios con validación
- Navegación por pestañas
- Cards adaptativas (Bento Grid)
- Botones primarios y secundarios
- Iconos Material Symbols

## 🗂️ Estructura del Proyecto

```
Proyecto libreria/
├── index.html              # Página de login
├── inventory.html          # Gestión de inventario
├── services.html           # Gestión de servicios
├── js/
│   └── app.js             # Lógica compartida de aplicación
├── bibliotheca_direct/
│   └── DESIGN.md          # Especificación de diseño
└── README.md              # Este archivo
```

## 🚀 Inicio Rápido

### 1. Abrir la Aplicación
Simplemente abre `index.html` en tu navegador:
```bash
open index.html
# o en Windows:
start index.html
```

### 2. Credenciales Demo
- **Email**: cualquier email válido
- **Password**: cualquier contraseña

### 3. Navegación
- **Página Principal**: Login
- **Inventario**: Gestión de productos (accesible tras login)
- **Servicios**: Configuración de tarifas y servicios
- **Perfil**: Placeholder para implementación futura

## 💻 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **Tailwind CSS**: Framework de utilidades para estilos
- **JavaScript Vanilla**: Sin dependencias externas (excepto Tailwind y Material Icons)
- **LocalStorage**: Persistencia de datos en cliente
- **Lucide Icons**: Iconografía consistente para servicios

## 📱 Características Responsivas

- **Mobile First**: Optimizado para dispositivos móviles
- **Breakpoints**: md: 768px (tablets y desktop)
- **Navegación Adaptativa**:
  - Mobile: TopAppBar + BottomNavBar
  - Desktop: SideNav fija + contenido principal

## 🔐 Autenticación y Almacenamiento

### Autenticación
- Login simple basado en email/password
- Storage en LocalStorage (demo)
- Protección de rutas en páginas sensibles

### Almacenamiento
```javascript
// Usar el módulo Storage:
Storage.setItem('productos', datos);
Storage.getItem('productos');
Storage.removeItem('productos');
```

## 📝 Gestión de Productos

### API Inventory
```javascript
// Agregar producto
Inventory.addProduct({
    name: 'Harry Potter',
    category: 'fiction',
    price: 19.99,
    cost: 12.00,
    stock: 50
});

// Obtener productos
const productos = Inventory.getProducts();

// Eliminar producto
Inventory.deleteProduct(productId);

// Actualizar producto
Inventory.updateProduct(productId, { stock: 45 });
```

## ⚙️ Servicios Disponibles

Predefinidos:
1. **Impresión**: $0.10 (B/N) - $0.50 (Color)
2. **Encuadernación**: $2.50-$4.00 (escalonado)
3. **Trámites Web**: $1.00-$1.50 (fijo)
4. **Escaneo**: $0.25 (por documento)

Extensible mediante:
```javascript
Services.addService({
    name: 'Nuevo Servicio',
    price: 5.00
});
```

## 🎯 Flujos de Usuarios

### Flujo de Login
1. Acceder a `index.html`
2. Ingresar credenciales
3. Sistema valida y guarda sesión
4. Redirige a Inventario

### Flujo de Inventario
1. Acceder a `inventory.html`
2. Escanear/ingresar código de barras
3. Completar información del producto
4. Registrar en sistema
5. Los datos se persisten en LocalStorage

### Flujo de Servicios
1. Acceder a `services.html`
2. Ver servicios disponibles con tarifas
3. (Implementar) Crear nuevos servicios
4. (Implementar) Editar tarifas

## 🔧 Desarrollo y Extensiones

### Agregar Nueva Página
1. Crear `nueva-pagina.html`
2. Copiar estructura base de navegación
3. Importar `js/app.js`
4. Actualizar links en navegación

### Integración con Backend
```javascript
// Reemplazar Storage con llamadas API
// Ejemplo:
fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
})
```

### Agregar Validación de Formularios
```javascript
// En cualquier formulario:
form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Validar datos
    // Enviar a servidor o guardar localmente
});
```

## 📦 Dependencias Externas

- **Tailwind CSS** (v3+): CDN incluido
- **Google Fonts**: Inter, Plus Jakarta Sans
- **Material Icons**: Material Symbols Outlined
- **Lucide Icons**: Para iconografía de servicios

## 🐛 Debugging

Abrir consola del navegador (F12) para ver:
- Logs de autenticación
- Estado del almacenamiento
- Errores de aplicación

```javascript
// Inspeccionar datos almacenados:
console.log(Storage.getItem('products'));
console.log(Auth.getCurrentUser());
```

## 📄 Licencia

Proyecto privado - Bibliotheca Direct (2024)

## 📞 Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.

---

**Nota**: Este es un sistema demo. Para producción, implementar:
- Backend robusto con validación
- Base de datos persistente
- Autenticación segura (JWT)
- HTTPS para transmisión segura
- Testing automatizado
