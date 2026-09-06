
/**
 * Librería Quisqueya - Validación del Formulario de Contacto (Fase 2)
 * Cumple con los requerimientos de la rúbrica:
 * 1. Validación de campos obligatorios y formatos (correo, números).
 * 2. Mensajes de error visibles en la interfaz insertados dinámicamente en el DOM (sin alert()).
 * 3. Respuesta dinámica en la página sin recargarla (event.preventDefault()).
 * 4. Funciones estructuradas con parámetros y valores de retorno.
 */

// =============================================================================
// FUNCIONES PURAS DE VALIDACIÓN (Parámetros y Retorno)
// =============================================================================

/**
 * Comprueba si un valor de texto está vacío o contiene solo espacios.
 * @param {string} valor - Texto a evaluar.
 * @returns {boolean} true si está vacío, false si contiene caracteres.
 */
function esCampoVacio(valor) {
    return valor.trim() === "";
}

/**
 * Valida la estructura sintáctica de una dirección de correo electrónico.
 * Utiliza el método predefinido RegExp.test().
 * @param {string} correo - Cadena con el correo a verificar.
 * @returns {boolean} true si el formato es válido.
 */
function esCorreoValido(correo) {
    const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return patronCorreo.test(correo.trim());
}

/**
 * Valida si una cadena contiene exclusivamente caracteres numéricos.
 * Utiliza el método predefinido RegExp.test().
 * @param {string} numero - Cadena a evaluar.
 * @returns {boolean} true si solo contiene dígitos del 0 al 9.
 */
function esNumeroValido(numero) {
    const patronNumeros = /^[0-9]+$/;
    return patronNumeros.test(numero.trim());
}

/**
 * Verifica si un texto cumple con una longitud mínima de caracteres.
 * @param {string} texto - Texto a medir.
 * @param {number} longitudMinima - Cantidad mínima esperada.
 * @returns {boolean} true si cumple la longitud mínima.
 */
function cumpleLongitudMinima(texto, longitudMinima) {
    return texto.trim().length >= longitudMinima;
}


// =============================================================================
// MANIPULACIÓN DINÁMICA DEL DOM (Inserción y Limpieza de Errores)
// =============================================================================

/**
 * Muestra un mensaje de error visual directamente en el DOM, debajo del campo.
 * @param {HTMLElement} campo - Elemento input, select o textarea con error.
 * @param {string} mensaje - Texto descriptivo del error para el usuario.
 */
function mostrarErrorCampo(campo, mensaje) {
    campo.classList.add("field-error");
    campo.setAttribute("aria-invalid", "true");

    const contenedor = campo.closest(".form-group");
    if (!contenedor) return;

    // Buscar si ya existe el elemento de error para no duplicarlo
    let errorElemento = contenedor.querySelector(".field-error-text");
    if (!errorElemento) {
        errorElemento = document.createElement("p");
        errorElemento.className = "field-error-text";
        errorElemento.setAttribute("role", "alert");
        contenedor.appendChild(errorElemento);
    }
    errorElemento.textContent = mensaje;
}

/**
 * Limpia el estado de error y remueve el mensaje del DOM de un campo específico.
 * @param {HTMLElement} campo - Elemento a limpiar.
 */
function limpiarErrorCampo(campo) {
    campo.classList.remove("field-error");
    campo.setAttribute("aria-invalid", "false");

    const contenedor = campo.closest(".form-group");
    if (!contenedor) return;

    const errorElemento = contenedor.querySelector(".field-error-text");
    if (errorElemento) {
        errorElemento.remove();
    }
}

/**
 * Limpia todos los errores visuales del formulario.
 * @param {HTMLFormElement} formulario - Formulario a limpiar.
 */
function limpiarTodosLosErrores(formulario) {
    const camposConError = formulario.querySelectorAll(".field-error");
    camposConError.forEach(campo => limpiarErrorCampo(campo));

    const mensajesError = formulario.querySelectorAll(".field-error-text");
    mensajesError.forEach(msg => msg.remove());

    const feedbackContenedor = document.getElementById("contact-feedback");
    if (feedbackContenedor) {
        feedbackContenedor.innerHTML = "";
    }
}


// =============================================================================
// CONTROLADOR PRINCIPAL DEL FORMULARIO DE CONTACTO
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("contact-form");
    if (!formulario) return;

    // Referencias a los campos del formulario
    const campoNombre = document.getElementById("nombre");
    const campoCorreo = document.getElementById("correo");
    const campoTelefono = document.getElementById("telefono");
    const campoMotivo = document.getElementById("motivo");
    const campoMensaje = document.getElementById("mensaje");
    const feedbackContenedor = document.getElementById("contact-feedback");

    // Limpieza de errores en tiempo real conforme el usuario escribe o interactúa
    [campoNombre, campoCorreo, campoTelefono, campoMotivo, campoMensaje].forEach(campo => {
        if (campo) {
            campo.addEventListener("input", () => limpiarErrorCampo(campo));
            campo.addEventListener("change", () => limpiarErrorCampo(campo));
        }
    });

    // Escuchar el evento submit del formulario
    formulario.addEventListener("submit", (evento) => {
        // Prevenir la recarga predeterminada del navegador
        evento.preventDefault();

        // Limpiar errores previos
        limpiarTodosLosErrores(formulario);

        let hayErrores = false;
        let primerCampoConError = null;

        // 1. Validar Nombre (Obligatorio, mínimo 3 caracteres)
        if (esCampoVacio(campoNombre.value)) {
            mostrarErrorCampo(campoNombre, "El nombre completo es obligatorio.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoNombre;
        } else if (!cumpleLongitudMinima(campoNombre.value, 3)) {
            mostrarErrorCampo(campoNombre, "El nombre debe tener al menos 3 caracteres.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoNombre;
        }

        // 2. Validar Correo Electrónico (Obligatorio y formato válido)
        if (esCampoVacio(campoCorreo.value)) {
            mostrarErrorCampo(campoCorreo, "El correo electrónico es obligatorio.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoCorreo;
        } else if (!esCorreoValido(campoCorreo.value)) {
            mostrarErrorCampo(campoCorreo, "Ingresa un correo electrónico válido (ejemplo: usuario@correo.com).");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoCorreo;
        }

        // 3. Validar Teléfono (Opcional, pero si se escribe debe contener solo números)
        if (!esCampoVacio(campoTelefono.value)) {
            const soloDigitos = campoTelefono.value.replace(/[\s\-()+]/g, "");
            if (!esNumeroValido(soloDigitos) || soloDigitos.length < 7) {
                mostrarErrorCampo(campoTelefono, "El teléfono debe contener solo números (mínimo 7 dígitos).");
                hayErrores = true;
                if (!primerCampoConError) primerCampoConError = campoTelefono;
            }
        }

        // 4. Validar Motivo de Consulta (Obligatorio)
        if (esCampoVacio(campoMotivo.value)) {
            mostrarErrorCampo(campoMotivo, "Selecciona una opción sobre el motivo de tu mensaje.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoMotivo;
        }

        // 5. Validar Mensaje (Obligatorio, mínimo 10 caracteres)
        if (esCampoVacio(campoMensaje.value)) {
            mostrarErrorCampo(campoMensaje, "El mensaje o consulta es obligatorio.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoMensaje;
        } else if (!cumpleLongitudMinima(campoMensaje.value, 10)) {
            mostrarErrorCampo(campoMensaje, "Tu mensaje debe tener al menos 10 caracteres para entender tu solicitud.");
            hayErrores = true;
            if (!primerCampoConError) primerCampoConError = campoMensaje;
        }

        // Si existen errores, enfocar el primer campo con falla y detener el flujo
        if (hayErrores) {
            if (primerCampoConError) primerCampoConError.focus();
            return;
        }

        // =========================================================================
        // RESPUESTA DINÁMICA EN EL DOM (Sin recargar la página - Fase 2)
        // =========================================================================
        const nombreIngresado = campoNombre.value.trim();
        const correoIngresado = campoCorreo.value.trim();
        const motivoSeleccionado = campoMotivo.options[campoMotivo.selectedIndex].text;

        // Construir e inyectar tarjeta de éxito en el DOM
        if (feedbackContenedor) {
            feedbackContenedor.innerHTML = `
                <div class="feedback-card success" role="status">
                    <span class="feedback-title">¡Mensaje preparado con éxito!</span>
                    <p>Gracias <strong>${nombreIngresado}</strong> por ponerte en contacto con Librería Quisqueya. Hemos registrado tu solicitud sobre <em>${motivoSeleccionado}</em>.</p>
                    <p>Nos comunicaremos contigo a <strong>${correoIngresado}</strong> en un plazo máximo de 24 horas laborables.</p>
                </div>
            `;
        }

        // Restablecer los campos del formulario
        formulario.reset();
    });
});