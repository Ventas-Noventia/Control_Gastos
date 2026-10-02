import { currentProfile, signIn, nextPage } from "./auth.js";
import { getClient } from "./supabase-client.js";
const form = document.getElementById("login-form"),
  errorBox = document.getElementById("login-error");
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}
try {
  getClient();
  const profile = await currentProfile();
  if (profile) location.replace(nextPage());
} catch (error) {
  showError(error.message);
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = "Ingresando…";
  try {
    const profile = await signIn(
      form.elements.email.value,
      form.elements.password.value,
    );
    if (!profile) throw new Error("No se pudo verificar la cuenta.");
    location.replace(nextPage());
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sesión";
    form.elements.password.value = "";
  }
});
document.getElementById("toggle-password").addEventListener("click", () => {
  const input = form.elements.password,
    button = document.getElementById("toggle-password");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.setAttribute(
    "aria-label",
    visible ? "Ocultar contraseña" : "Mostrar contraseña",
  );
  button.setAttribute("aria-pressed", String(visible));
});
