const loginForm = document.querySelector("#login-form");
const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const loginMessage = document.querySelector("#login-message");

// Si ya hay una sesión no es necesario mostrar nuevamente el acceso.
if (
    sessionStorage.getItem("libreriaSession") === "active" ||
    localStorage.getItem("libreriaSession") === "active"
) {
    window.location.replace("informacion.html");
}

togglePasswordButton.addEventListener("click", function () {
    const passwordIsHidden = passwordInput.type === "password";
    passwordInput.type = passwordIsHidden ? "text" : "password";
    togglePasswordButton.classList.toggle("is-visible", passwordIsHidden);
    togglePasswordButton.setAttribute(
        "aria-label",
        passwordIsHidden ? "Ocultar contraseña" : "Mostrar contraseña"
    );
});

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!loginForm.checkValidity()) {
        loginMessage.textContent = "Completa el correo y la contraseña.";
        loginForm.reportValidity();
        return;
    }

    const storage = document.querySelector("#remember").checked
        ? localStorage
        : sessionStorage;

    storage.setItem("libreriaSession", "active");
    window.location.replace("informacion.html");
});

document.querySelectorAll("[data-demo-message]").forEach(function (button) {
    button.addEventListener("click", function () {
        loginMessage.textContent = "Esta opción estará disponible cuando se conecte la base de datos.";
    });
});
