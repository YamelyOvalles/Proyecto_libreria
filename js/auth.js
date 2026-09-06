/*
 * Protección básica para esta etapa sin servidor.
 * Sirve para practicar el flujo de acceso, pero no sustituye una autenticación real.
 */
(function protectPage() {
    const hasSession = sessionStorage.getItem("libreriaSession") === "active";
    const isRemembered = localStorage.getItem("libreriaSession") === "active";

    if (!hasSession && !isRemembered) {
        window.location.replace("index.html");
    }
}());
