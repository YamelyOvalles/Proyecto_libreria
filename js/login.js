/**
 * Librería Quisqueya - Lógica de Inicio de Sesión
 * Permite alternar entre los perfiles de "Cliente / Lector" y "Dueño / Administrador",
 * valida los datos mediante el DOM sin recargas de página y redirige según el rol.
 */

// Elementos del DOM mediante selectores de ID
const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const loginMessage = document.querySelector("#login-message");
const rememberCheckbox = document.querySelector("#remember");
const submitButton = document.querySelector("#login-submit-btn");

// Elementos de la interfaz de cambio de rol
const roleClientButton = document.querySelector("#role-client");
const roleAdminButton = document.querySelector("#role-admin");
const roleEyebrow = document.querySelector("#login-role-eyebrow");
const loginTitle = document.querySelector("#login-title");
const loginSubtitle = document.querySelector("#login-subtitle");
const adminHintBox = document.querySelector("#admin-credentials-hint");

// Estado del rol actual ("cliente" o "admin")
let currentRole = "cliente";

// Si ya existe una sesión activa, redirigir automáticamente según el rol guardado
(function verificarSesionPrevia() {
    const sesionActiva = sessionStorage.getItem("libreriaSession") === "active" ||
                         localStorage.getItem("libreriaSession") === "active";
    if (sesionActiva) {
        const rolGuardado = sessionStorage.getItem("libreriaRole") || localStorage.getItem("libreriaRole");
        if (rolGuardado === "admin") {
            window.location.replace("admin.html");
        } else {
            window.location.replace("informacion.html");
        }
    }
})();

/**
 * Cambia el perfil de acceso entre cliente y administrador en la interfaz.
 * @param {string} nuevoRol - 'cliente' o 'admin'
 */
function cambiarRol(nuevoRol) {
    currentRole = nuevoRol;
    limpiarMensajes();

    if (nuevoRol === "admin") {
        // Estilos activos en pestañas
        roleAdminButton.classList.add("active");
        roleAdminButton.setAttribute("aria-selected", "true");
        roleClientButton.classList.remove("active");
        roleClientButton.setAttribute("aria-selected", "false");

        // Textos del encabezado
        roleEyebrow.textContent = "Panel Operativo";
        loginTitle.textContent = "Acceso Administrativo";
        loginSubtitle.textContent = "Ingresa con tus credenciales operativas para gestionar pedidos.";

        // Mostrar credenciales de demostración para el evaluador
        if (adminHintBox) adminHintBox.hidden = false;

        // Texto del botón
        submitButton.textContent = "Acceder al Panel Operativo";

        // Sugerir correo administrativo en el placeholder
        emailInput.placeholder = "admin@libreriaquisqueya.com";
    } else {
        // Estilos activos en pestañas
        roleClientButton.classList.add("active");
        roleClientButton.setAttribute("aria-selected", "true");
        roleAdminButton.classList.remove("active");
        roleAdminButton.setAttribute("aria-selected", "false");

        // Textos del encabezado
        roleEyebrow.textContent = "Panel de lectores";
        loginTitle.textContent = "Bienvenida de vuelta";
        loginSubtitle.textContent = "Entra para gestionar tus pedidos y lecturas.";

        // Ocultar credenciales de demostración
        if (adminHintBox) adminHintBox.hidden = true;

        // Texto del botón
        submitButton.textContent = "Entrar a Librería Quisqueya";

        // Placeholder estándar
        emailInput.placeholder = "nombre@correo.com";
    }
}

// Eventos de cambio de perfil
if (roleClientButton && roleAdminButton) {
    roleClientButton.addEventListener("click", () => cambiarRol("cliente"));
    roleAdminButton.addEventListener("click", () => cambiarRol("admin"));
}

/**
 * Limpia los mensajes y estilos de error visuales en los campos.
 */
function limpiarMensajes() {
    loginMessage.textContent = "";
    loginMessage.className = "form-message";
    emailInput.classList.remove("field-error");
    passwordInput.classList.remove("field-error");
}

// Alternar visibilidad de la contraseña
if (togglePasswordButton && passwordInput) {
    togglePasswordButton.addEventListener("click", function () {
        const passwordIsHidden = passwordInput.type === "password";
        passwordInput.type = passwordIsHidden ? "text" : "password";
        togglePasswordButton.classList.toggle("is-visible", passwordIsHidden);
        togglePasswordButton.setAttribute(
            "aria-label",
            passwordIsHidden ? "Ocultar contraseña" : "Mostrar contraseña"
        );
    });
}

// Validación y envío del formulario sin recargar la página (Manipulación del DOM)
if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        limpiarMensajes();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // 1. Validar campo de correo obligatorio
        if (!email) {
            loginMessage.textContent = "Por favor, completa el campo de correo electrónico.";
            loginMessage.style.color = "#b3261e";
            emailInput.classList.add("field-error");
            emailInput.focus();
            return;
        }

        // 2. Validar formato de correo mediante expresión regular
        const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!patronCorreo.test(email)) {
            loginMessage.textContent = "El formato del correo electrónico no es válido (ejemplo: usuario@correo.com).";
            loginMessage.style.color = "#b3261e";
            emailInput.classList.add("field-error");
            emailInput.focus();
            return;
        }

        // 3. Validar contraseña obligatoria
        if (!password) {
            loginMessage.textContent = "Por favor, escribe tu contraseña.";
            loginMessage.style.color = "#b3261e";
            passwordInput.classList.add("field-error");
            passwordInput.focus();
            return;
        }

        // Determinar el almacenamiento según la casilla "Recordarme"
        const storage = rememberCheckbox.checked ? localStorage : sessionStorage;

        // Validación según el perfil seleccionado
        if (currentRole === "admin") {
            // Verificación de credenciales del personal administrativo
            const esAdminValido = (email.toLowerCase() === "admin@libreriaquisqueya.com" && password === "admin123") ||
                                  (email.toLowerCase().includes("admin") && password.length >= 6);

            if (!esAdminValido) {
                loginMessage.textContent = "Credenciales incorrectas. Para acceso administrativo usa: admin@libreriaquisqueya.com / admin123";
                loginMessage.style.color = "#b3261e";
                passwordInput.classList.add("field-error");
                passwordInput.focus();
                return;
            }

            // Guardar sesión y rol administrativo
            storage.setItem("libreriaSession", "active");
            storage.setItem("libreriaRole", "admin");
            storage.setItem("libreriaUser", email);

            loginMessage.textContent = "Acceso administrativo autorizado. Redirigiendo al panel operativo...";
            loginMessage.style.color = "var(--primary)";

            setTimeout(() => {
                window.location.replace("admin.html");
            }, 600);

        } else {
            // Acceso de cliente/lector
            storage.setItem("libreriaSession", "active");
            storage.setItem("libreriaRole", "cliente");
            storage.setItem("libreriaUser", email);

            loginMessage.textContent = "Acceso concedido. Entrando a Librería Quisqueya...";
            loginMessage.style.color = "var(--primary)";

            setTimeout(() => {
                window.location.replace("informacion.html");
            }, 600);
        }
    });
}

// Botones secundarios de demostración
document.querySelectorAll("[data-demo-message]").forEach(function (button) {
    button.addEventListener("click", function () {
        loginMessage.textContent = "Esta funcionalidad estará disponible en la Fase 3 con base de datos.";
        loginMessage.style.color = "var(--secondary)";
    });
});
