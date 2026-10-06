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
  assertAdmin,
  emptyRow,
} from "./ui.js?v=20261005-periodos-v8";
import {
  adminAction,
  validateImage,
} from "./admin-api.js?v=20261002-control-v7";

let ctx,
  selected = null,
  deleting = null,
  previewUrl = null;
const form = $("#profile-form"),
  deleteForm = $("#delete-user-form");
function showAvatar(node, name, url) {
  node.textContent = (name || "US").slice(0, 2).toUpperCase();
  if (!url) return;
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.onerror = () => {
    node.textContent = (name || "US").slice(0, 2).toUpperCase();
  };
  node.replaceChildren(image);
}
function clearPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}
function preview() {
  clearPreview();
  const file = form.elements.image.files[0];
  if (file) {
    try {
      validateImage(file);
      previewUrl = URL.createObjectURL(file);
    } catch (error) {
      form.elements.image.value = "";
      form.querySelector(".form-error").textContent = error.message;
      form.querySelector(".form-error").hidden = false;
    }
  }
  const url =
    previewUrl ||
    (form.elements.removeImage.checked ? null : selected?.avatarUrl);
  showAvatar($("#profile-preview"), form.elements.name.value, url);
}
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
  const query = $("#user-search").value.trim().toLocaleLowerCase("es");
  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLocaleLowerCase("es").includes(query),
  );
  $("#user-rows").innerHTML =
    filtered
      .map((u) => {
        const own = u.id === ctx.state.actor.id;
        return `<tr><td><div class="item-title"><span class="avatar" data-avatar="${esc(u.id)}" aria-hidden="true"></span><div><strong>${esc(u.name)}</strong>${own ? '<small class="cell-small d-block">Tu cuenta</small>' : ""}</div></div></td>
      <td>${esc(u.email)}</td><td><span class="status-badge ${u.role === "admin" ? "purple" : "muted"}">${u.role === "admin" ? "Administrador" : "Consulta"}</span></td>
      <td>${badge(u.active ? "Activo" : "Desactivado")}</td><td><div class="row-actions">
      <button class="btn icon-button" data-edit="${esc(u.id)}" aria-label="Editar ${esc(u.name)}" title="Editar">${icon("pencil")}</button>
      <button class="btn icon-button danger-icon" data-delete="${esc(u.id)}" aria-label="Eliminar ${esc(u.name)}" title="${own ? "No puedes eliminar tu propia cuenta" : "Eliminar"}" ${own ? "disabled" : ""}>${icon("trash")}</button></div></td></tr>`;
      })
      .join("") ||
    emptyRow(5, "No hay coincidencias", "Prueba con otro nombre o correo.");
  $("#user-count").textContent =
    `${filtered.length} de ${users.length} usuarios`;
  document.querySelectorAll("[data-avatar]").forEach((node) => {
    const user = users.find((u) => u.id === node.dataset.avatar);
    showAvatar(node, user.name, user.avatarUrl);
  });
}
function edit(user = null) {
  assertAdmin(ctx);
  selected = user;
  form.reset();
  clearFormError(form);
  clearPreview();
  const f = form.elements,
    own = user?.id === ctx.state.actor.id;
  for (const field of ["id", "name", "email"])
    f[field].value = user?.[field] || "";
  f.role.value = user?.role || "consulta";
  f.active.checked = user ? user.active : true;
  f.role.disabled = own;
  f.active.disabled = own;
  f.password.required = !user;
  f.password.type = "password";
  f.passwordConfirm.required = !user;
  f.passwordConfirm.setCustomValidity("");
  $("#profile-password-toggle").setAttribute("aria-pressed", "false");
  $("#profile-password-toggle").setAttribute(
    "aria-label",
    "Mostrar contraseña",
  );
  $("#profile-modal-title").textContent = user
    ? "Editar usuario"
    : "Nuevo usuario";
  $("#profile-submit").textContent = user ? "Guardar cambios" : "Crear usuario";
  $("#profile-password-help").textContent = user
    ? "Déjala vacía para conservar la contraseña. Para cambiarla, escribe al menos 8 caracteres."
    : "Asigna una contraseña de al menos 8 caracteres para iniciar sesión.";
  $("#profile-own-note").hidden = !own;
  $("#profile-remove-row").hidden = !user?.avatar_path;
  preview();
  modal("profile-modal").show();
}
function checkPasswords() {
  const f = form.elements;
  f.passwordConfirm.required = !!f.password.value || !selected;
  f.passwordConfirm.setCustomValidity(
    f.password.value !== f.passwordConfirm.value
      ? "Las contraseñas no coinciden."
      : "",
  );
}
try {
  ctx = await initPage("usuarios", "Usuarios", true);
  render();
  document.addEventListener("control:updated", render);
  $("#user-search").addEventListener("input", render);
  $("#new-user").addEventListener("click", () => edit());
  $("#user-rows").addEventListener("click", (event) => {
    if (!ctx.admin) return;
    const button = event.target.closest("[data-edit],[data-delete]");
    if (!button || button.disabled) return;
    const user = ctx.state.users.find(
      (u) => u.id === (button.dataset.edit || button.dataset.delete),
    );
    if (!user) return;
    if (button.dataset.edit) edit(user);
    else {
      deleting = user;
      clearFormError(deleteForm);
      $("#delete-user-name").textContent = user.name;
      $("#delete-user-email").textContent = user.email;
      modal("delete-user-modal").show();
    }
  });
  form.elements.image.addEventListener("change", () => {
    form.elements.removeImage.checked = false;
    clearFormError(form);
    preview();
  });
  form.elements.removeImage.addEventListener("change", () => {
    if (form.elements.removeImage.checked) form.elements.image.value = "";
    preview();
  });
  form.elements.name.addEventListener("input", preview);
  form.elements.password.addEventListener("input", checkPasswords);
  form.elements.passwordConfirm.addEventListener("input", checkPasswords);
  $("#profile-password-toggle").addEventListener("click", () => {
    const visible = form.elements.password.type === "password";
    form.elements.password.type = visible ? "text" : "password";
    $("#profile-password-toggle").setAttribute(
      "aria-label",
      visible ? "Ocultar contraseña" : "Mostrar contraseña",
    );
    $("#profile-password-toggle").setAttribute("aria-pressed", String(visible));
  });
  $("#profile-modal").addEventListener("shown.bs.modal", () =>
    form.elements.name.focus(),
  );
  $("#profile-modal").addEventListener("hide.bs.modal", () => {
    form.elements.password.value = "";
    form.elements.passwordConfirm.value = "";
    form.elements.password.type = "password";
  });
  $("#profile-modal").addEventListener("hidden.bs.modal", () => {
    form.reset();
    clearPreview();
    selected = null;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    checkPasswords();
    if (!form.reportValidity()) return;
    const ok = await submitForm(form, async () => {
      assertAdmin(ctx);
      const f = form.elements,
        image = f.image.files[0];
      validateImage(image);
      if (new TextEncoder().encode(f.password.value).length > 72)
        throw new Error(
          "La contraseña admite como máximo 72 bytes; reduce su longitud.",
        );
      await adminAction(
        {
          action: selected ? "update" : "create",
          id: selected?.id,
          name: f.name.value.trim(),
          email: f.email.value.trim(),
          role: f.role.value,
          active: f.active.checked,
          password: f.password.value,
          removeImage: f.removeImage.checked,
        },
        image,
      );
      f.password.value = "";
      f.passwordConfirm.value = "";
      await reloadAfterSave(ctx);
      render();
    });
    if (ok) modal("profile-modal").hide();
  });
  deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ok = await submitForm(deleteForm, async () => {
      assertAdmin(ctx);
      if (!deleting || deleting.id === ctx.state.actor.id)
        throw new Error("No puedes eliminar tu propia cuenta.");
      await adminAction({ action: "delete", id: deleting.id });
      await reloadAfterSave(ctx);
      render();
    });
    if (ok) {
      deleting = null;
      modal("delete-user-modal").hide();
    }
  });
} catch (error) {
  pageError(error);
}
