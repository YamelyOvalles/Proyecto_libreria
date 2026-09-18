/** Valida y guarda los mensajes de contacto en Supabase. */
document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("contact-form");
    if (!formulario) return;

    const campos = {
        nombre: document.getElementById("nombre"),
        correo: document.getElementById("correo"),
        telefono: document.getElementById("telefono"),
        asunto: document.getElementById("asunto"),
        mensaje: document.getElementById("mensaje")
    };
    const boton = document.getElementById("contact-submit-btn");
    const feedback = document.getElementById("contact-feedback");
    let enviando = false;

    function limpiarError(campo) {
        campo.classList.remove("field-error");
        campo.setAttribute("aria-invalid", "false");
        campo.closest(".form-group")?.querySelector(".field-error-text")?.remove();
    }

    function mostrarError(campo, mensaje) {
        limpiarError(campo);
        campo.classList.add("field-error");
        campo.setAttribute("aria-invalid", "true");
        const error = document.createElement("p");
        error.className = "field-error-text";
        error.setAttribute("role", "alert");
        error.textContent = mensaje;
        campo.closest(".form-group")?.appendChild(error);
    }

    function mostrarFeedback(tipo, titulo, detalle) {
        const tarjeta = document.createElement("div");
        const encabezado = document.createElement("strong");
        const texto = document.createElement("p");
        tarjeta.className = `feedback-card ${tipo}`;
        tarjeta.setAttribute("role", tipo === "error" ? "alert" : "status");
        encabezado.className = "feedback-title";
        encabezado.textContent = titulo;
        texto.textContent = detalle;
        tarjeta.append(encabezado, texto);
        feedback.replaceChildren(tarjeta);
    }

    function mensajeErrorContacto(error) {
        if (error?.code === "PGRST202") {
            return "Falta activar el formulario incluido en database/database.sql.";
        }
        return window.mensajeErrorSupabase(error, error?.message || "Inténtalo nuevamente en unos minutos.");
    }

    function validar() {
        const errores = [];
        const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const telefonoLimpio = campos.telefono.value.replace(/[\s()+-]/g, "");

        if (campos.nombre.value.trim().length < 3) errores.push([campos.nombre, "Escribe un nombre de al menos 3 caracteres."]);
        if (!correoValido.test(campos.correo.value.trim())) errores.push([campos.correo, "Escribe un correo electrónico válido."]);
        if (!campos.asunto.value) errores.push([campos.asunto, "Selecciona el asunto del mensaje."]);
        if (campos.mensaje.value.trim().length < 10) errores.push([campos.mensaje, "El mensaje debe tener al menos 10 caracteres."]);
        if (telefonoLimpio && (!/^\d+$/.test(telefonoLimpio) || telefonoLimpio.length < 7)) {
            errores.push([campos.telefono, "Escribe un teléfono válido de al menos 7 dígitos."]);
        }

        errores.forEach(([campo, mensaje]) => mostrarError(campo, mensaje));
        errores[0]?.[0].focus();
        return errores.length === 0;
    }

    async function completarDatosUsuario() {
        if (!window.libreriaUsuario) return;
        campos.correo.value ||= window.libreriaUsuario.email || "";
        try {
            const perfil = await window.obtenerPerfilLibreria(window.libreriaUsuario.id);
            campos.nombre.value ||= [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ");
        } catch (error) {
            console.error("No se pudieron completar los datos del perfil.", error);
        }
    }

    Object.values(campos).forEach(campo => {
        campo.addEventListener("input", () => limpiarError(campo));
        campo.addEventListener("change", () => limpiarError(campo));
    });

    document.addEventListener("libreria:auth-lista", completarDatosUsuario, { once: true });
    completarDatosUsuario();

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (enviando) return;
        feedback.replaceChildren();
        Object.values(campos).forEach(limpiarError);
        if (!validar()) return;

        enviando = true;
        boton.disabled = true;
        boton.textContent = "Enviando…";

        try {
            if (!window.libreriaSupabase) throw new Error("No se pudo conectar con Supabase.");

            const { error } = await window.libreriaSupabase.rpc("enviar_mensaje_contacto", {
                p_nombre: campos.nombre.value.trim(),
                p_correo: campos.correo.value.trim().toLowerCase(),
                p_telefono: campos.telefono.value.trim() || null,
                p_asunto: campos.asunto.options[campos.asunto.selectedIndex].text,
                p_mensaje: campos.mensaje.value.trim()
            });
            if (error) throw error;

            formulario.reset();
            await completarDatosUsuario();
            mostrarFeedback("success", "Mensaje enviado correctamente", "Recibimos tu solicitud y la registramos de forma segura.");
        } catch (error) {
            mostrarFeedback(
                "error",
                "No se pudo enviar el mensaje",
                mensajeErrorContacto(error)
            );
        } finally {
            enviando = false;
            boton.disabled = false;
            boton.textContent = "Enviar mensaje";
        }
    });
});
