import {
  initPage,
  $,
  esc,
  icon,
  badge,
  setStats,
  modal,
  clearFormError,
  submitForm,
  reloadAfterSave,
  pageError,
} from "./ui.js?v=20261001-menu-superior-v4";
import { saveProfile } from "./database.js";
let ctx;
const form = $("#profile-form");
function render() {
  const users = ctx.state.users;
  setStats([
    {
      label: "Usuarios registrados",
      value: users.length,
      detail: "Cuentas de acceso",
      icon: "people",
    },
    {
      label: "Administradores",
      value: users.filter((u) => u.role === "admin" && u.active).length,
      detail: "Crean, editan y eliminan",
      icon: "shield-check",
    },
    {
      label: "Consulta",
      value: users.filter((u) => u.role === "consulta" && u.active).length,
      detail: "Revisan y exportan",
      icon: "eye",
      accent: true,
    },
  ]);
  $("#user-rows").innerHTML = users
    .map(
      (u) =>
        `<tr><td><div class="item-title"><span class="avatar">${esc(u.name.slice(0, 2).toUpperCase())}</span><strong>${esc(u.name)}</strong></div></td><td>${esc(u.email)}</td><td><span class="status-badge ${u.role === "admin" ? "purple" : "muted"}">${u.role === "admin" ? "Administrador" : "Consulta"}</span></td><td>${badge(u.active ? "Activo" : "Desactivado")}</td><td>${u.id === ctx.state.actor.id ? '<span class="muted">Tu cuenta</span>' : `<button class="btn icon-button" data-edit="${esc(u.id)}" aria-label="Editar ${esc(u.name)}" title="Editar">${icon("pencil")}</button>`}</td></tr>`,
    )
    .join("");
}
function edit(user) {
  form.reset();
  clearFormError(form);
  for (const k of ["id", "name", "email", "role"])
    form.elements[k].value = user[k];
  form.elements.active.checked = user.active;
  modal("profile-modal").show();
}
try {
  ctx = await initPage("usuarios", "Usuarios", true);
  render();
  document.addEventListener("control:updated", render);
  $("#user-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (b) edit(ctx.state.users.find((u) => u.id === b.dataset.edit));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await submitForm(form, async () => {
      const f = form.elements;
      await saveProfile({
        id: f.id.value,
        name: f.name.value.trim(),
        role: f.role.value,
        active: f.active.checked,
      });
      await reloadAfterSave(ctx);
      render();
    });
    if (ok) modal("profile-modal").hide();
  });
} catch (error) {
  pageError(error);
}
