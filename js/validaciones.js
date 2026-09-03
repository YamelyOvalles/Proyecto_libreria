
// Verifica que un campo no esté vacío
function esCampoVacio(valor) {
    return valor.trim() === "";
}

// Verifica si el formato de correo es válido
function esCorreoValido(correo) {
    const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return patronCorreo.test(correo.trim());
}

// Verifica si una cadena contiene solo números
function esNumeroValido(numero) {
    const patronNumeros = /^[0-9]+$/;
    return patronNumeros.test(numero.trim());
}

function validarFormulario(evento) {
  
    evento.preventDefault();

    const campoNombre = document.getElementById("nombre");
    const campoCorreo = document.getElementById("correo");
    const campoTelefono = document.getElementById("telefono");

    // Validar Nombre (Obligatorio)
    if (campoNombre && esCampoVacio(campoNombre.value)) {
        alert("El campo nombre es obligatorio.");
        campoNombre.focus();
        return false;
    }

    // Validar Correo (Obligatorio y Formato correcto)
    if (campoCorreo) {
        if (esCampoVacio(campoCorreo.value)) {
            alert("El campo correo es obligatorio.");
            campoCorreo.focus();
            return false;
        }
        if (!esCorreoValido(campoCorreo.value)) {
            alert("Por favor, ingresa un correo electrónico válido (ejemplo@correo.com).");
            campoCorreo.focus();
            return false;
        }
    }

    // Validar Teléfono (Solo números)
    if (campoTelefono && !esCampoVacio(campoTelefono.value)) {
        if (!esNumeroValido(campoTelefono.value)) {
            alert("El teléfono debe contener únicamente números.");
            campoTelefono.focus();
            return false;
        }
    }

    alert("¡Formulario validado con éxito!");
    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.querySelector("form");
    if (formulario) {
        formulario.addEventListener("submit", validarFormulario);
    }
});