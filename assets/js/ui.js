import { showDashboardDetails } from "./dashboard-details.js?v=20261006-alertas-v9";
export {
  showDashboardDetails,
  renderAttention,
  taskDetails,
  obligationDetails,
  movementDetails,
  userDetails,
} from "./dashboard-details.js?v=20261006-alertas-v9";
import { requireProfile, signOut } from "./auth.js?v=20261002-control-v7";
import { loadState } from "./database.js?v=20261005-periodos-v8";
import { loadBrand } from "./branding.js?v=20261002-control-v7";
import { getModal } from "./modal-controller.js?v=20261002-control-v7";
import {
  evidenceForm,
  setupEvidenceViewer,
} from "./evidence.js?v=20261002-control-v7";
import {
  categories,
  today,
  dateLabel,
  money,
} from "./finanzas.js?v=20261005-periodos-v8";
export const $ = (selector) => document.querySelector(selector);
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name) =>
  `<i class="bi bi-${name}" aria-hidden="true"></i>`;
export function badge(status) {
  const cls = ["Pagado", "Completado", "Activo"].includes(status)
    ? "success"
    : status === "Vencido"
      ? "danger"
      : ["Pago parcial", "A tiempo"].includes(status)
        ? "purple"
        : "muted";
  return `<span class="status-badge ${cls}">${esc(status)}</span>`;
}
export function toast(message, variant = "success") {
  const element = document.createElement("div");
  element.className = `toast align-items-center border-0 text-bg-${variant}`;
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  $("#toast-container").append(element);
  const instance = new bootstrap.Toast(element, { delay: 5000 });
  instance.show();
  element.addEventListener("hidden.bs.toast", () => {
    instance.dispose();
    element.remove();
  });
}
export function pageError(error) {
  if ($("#page-loading")) $("#page-loading").hidden = true;
  if ($("#session-link")) $("#session-link").hidden = false;
  const target = $("#page-error");
  if (target) {
    target.textContent = error.message || String(error);
    target.hidden = false;
  }
}
export function emptyRow(columns, title, description, action = "") {
  return `<tr><td colspan="${columns}"><div class="empty-state">${icon("clipboard-check")}<strong>${esc(title)}</strong><p>${esc(description)}</p>${action}</div></td></tr>`;
}
export function setStats(items) {
  const stats = $("#stats");
  stats.innerHTML = items
    .map((s, i) => {
      const tag = s.details ? "button" : "article";
      return `<${tag} ${s.details ? `type="button" data-stat-detail="${i}" aria-haspopup="dialog" aria-controls="dashboard-detail-modal" aria-label="Ver detalle de ${esc(s.label)}"` : ""} class="stat ${s.accent ? "accent-stat" : ""} ${s.details ? "interactive-stat" : ""}"><span class="stat-label">${esc(s.label)}${icon(s.icon)}</span><strong>${esc(s.value)}</strong><small>${esc(s.detail)}</small>${s.details ? '<span class="stat-detail-hint">Ver detalle →</span>' : ""}</${tag}>`;
    })
    .join("");
  stats.querySelectorAll("[data-stat-detail]").forEach((button) =>
    button.addEventListener("click", () => {
      const s = items[Number(button.dataset.statDetail)];
      showDashboardDetails(s.label, s.details, button);
    }),
  );
}
export function modal(id) {
  const node = document.getElementById(id);
  return getModal(node);
}
export function clearFormError(form) {
  const node = form.querySelector(".form-error");
  if (node) {
    node.hidden = true;
    node.textContent = "";
  }
}
export async function submitForm(form, operation) {
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return false;
  const text = button.textContent;
  button.disabled = true;
  button.textContent = "Guardando…";
  clearFormError(form);
  try {
    await operation();
    toast("Cambios guardados");
    return true;
  } catch (error) {
    const node = form.querySelector(".form-error");
    if (node) {
      node.textContent = error.message;
      node.hidden = false;
    } else toast(error.message, "danger");
    return false;
  } finally {
    button.disabled = false;
    button.textContent = text;
  }
}
export function cents(value, allowZero = false, allowNegative = false) {
  const n = Number(value);
  const result = Math.round(n * 100);
  if (
    String(value).trim() === "" ||
    !Number.isFinite(n) ||
    !Number.isSafeInteger(result) ||
    Math.abs(result) > 100000000000 ||
    (!allowNegative && result < (allowZero ? 0 : 1))
  )
    throw new Error("Escribe un importe válido con hasta dos decimales.");
  if (Math.abs(n * 100 - result) > 0.0001)
    throw new Error("El importe debe tener como máximo dos decimales.");
  return result;
}
export function validLinks(values) {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        const u = new URL(value);
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password ||
          value.length > 2048
        )
          throw new Error();
        return u.toString();
      } catch {
        throw new Error("Cada enlace debe empezar con http:// o https://.");
      }
    });
}
export function exportCSV(filename, rows) {
  const safe = (cell) =>
    typeof cell === "number"
      ? String(cell)
      : '"' +
        (/^\s*[=+\-@]/.test(String(cell)) ? "'" : "") +
        String(cell ?? "").replaceAll('"', '""') +
        '"';
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function navigation(profile, page) {
  const links = [
    ["pendientes", "clipboard-check", "Pendientes"],
    ["gastos-fijos", "arrow-repeat", "Gastos fijos"],
    ["ingresos", "wallet2", "Ingresos"],
    ["cuadre", "bar-chart", "Cuadre"],
    ...(profile.role === "admin" ? [["usuarios", "people", "Usuarios"]] : []),
    ...(profile.role === "admin" ? [["marca", "image", "Marca"]] : []),
  ];
  return links
    .map(
      ([name, i, label]) =>
        `<a href="${name}.html" class="nav-link ${name === page ? "active" : ""}" ${name === page ? 'aria-current="page"' : ""}>${icon(i)}${label}</a>`,
    )
    .join("");
}
function syncProfile(profile, page, loading = false) {
  const admin = profile.active && profile.role === "admin";
  $("#primary-nav").innerHTML = navigation(profile, page);
  $(".user-name").textContent = profile.name;
  $(".user-name").title = profile.name;
  $(".user-role").textContent =
    profile.role === "admin" ? "Administrador" : "Consulta";
  const avatar = $(".user-block .avatar");
  avatar.replaceChildren();
  if (profile.avatarUrl) {
    const image = document.createElement("img");
    image.src = profile.avatarUrl;
    image.alt = "";
    image.onerror = () => {
      avatar.textContent = profile.name.slice(0, 2).toUpperCase();
    };
    avatar.append(image);
  } else avatar.textContent = profile.name.slice(0, 2).toUpperCase();
  $("#header-role").textContent =
    profile.role === "admin" ? "Admin" : "Consulta";
  document.querySelectorAll("[data-admin]").forEach((el) => {
    el.hidden = !admin;
  });
  document.querySelectorAll("[data-admin-visible]").forEach((button) => {
    button.hidden = false;
    button.disabled = loading || !admin;
    if (!admin) button.title = "Para agregar registros necesitas el rol admin.";
    else button.removeAttribute("title");
  });
  document.querySelectorAll("[data-create-permission]").forEach((note) => {
    note.hidden = admin;
  });
}
export function assertAdmin(ctx) {
  if (!ctx.admin)
    throw new Error(
      "Tu cuenta es de consulta. Para guardar necesitas el rol admin.",
    );
}
function setupNavigation() {
  const menu = $("#main-menu");
  const toggle = $("#menu-toggle");
  const compact = window.matchMedia("(max-width: 1199.98px)");
  const close = () =>
    bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false }).hide();
  menu.addEventListener("click", (event) => {
    if (compact.matches && event.target.closest("a.nav-link")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      compact.matches &&
      menu.classList.contains("show")
    ) {
      close();
      toggle.focus();
    }
  });
  compact.addEventListener("change", () => {
    if (!compact.matches) close();
  });
}
export async function initPage(page, title, adminOnly = false) {
  setupEvidenceViewer();
  setupNavigation();
  await loadBrand();
  const profile = await requireProfile(adminOnly);
  syncProfile(profile, page, true);
  $("#header-page").textContent = title;
  $("#header-date").textContent = dateLabel(today());
  $("#logout").addEventListener("click", () =>
    signOut().catch((e) => toast(e.message, "danger")),
  );
  let state = await loadState();
  const ctx = {
    get state() {
      return state;
    },
    get admin() {
      return state.actor.active && state.actor.role === "admin";
    },
    async reload() {
      state = await loadState();
      syncProfile(state.actor, page);
      fillCategories(state);
      document.dispatchEvent(new CustomEvent("control:updated"));
      return state;
    },
  };
  syncProfile(state.actor, page);
  fillCategories(state);
  $("#refresh").addEventListener("click", async () => {
    try {
      await ctx.reload();
      toast("Información actualizada");
    } catch (e) {
      toast(e.message, "danger");
    }
  });
  window.addEventListener("focus", () => {
    ctx.reload().catch(() => {});
  });
  $("#page-loading").hidden = true;
  $("#page-content").hidden = false;
  return ctx;
}
const initializedCategoryPickers = new WeakSet();
function isNewCategory(select) {
  return select.selectedOptions[0]?.hasAttribute("data-new-category");
}
function syncCategoryPicker(select, focus = false) {
  const container = select.form.querySelector("[data-category-custom]");
  const input = select.form.elements.categoryCustom;
  const custom = !!isNewCategory(select);
  container.hidden = !custom;
  input.disabled = !custom;
  if (custom && focus) input.focus();
}
export function setCategory(form, value = "") {
  const select = form.elements.category;
  const option = [...select.options].find(
    (o) => !o.hasAttribute("data-new-category") && o.value === value,
  );
  select.selectedIndex = option ? option.index : select.options.length - 1;
  form.elements.categoryCustom.value = option ? "" : value;
  syncCategoryPicker(select);
}
export function readCategory(form) {
  const select = form.elements.category;
  const value = (
    isNewCategory(select) ? form.elements.categoryCustom.value : select.value
  ).trim();
  if (!value) throw new Error("Elige una categoría o escribe una nueva.");
  return value;
}
export function availableCategories(state) {
  const unique = new Set(
    [
      ...categories,
      ...state.tasks.map((t) => t.category),
      ...state.expenses.map((e) => e.category),
      ...state.movements
        .filter((m) => m.kind !== "saldo_inicial")
        .map((m) => m.category),
    ]
      .map((category) => category.trim())
      .filter(Boolean),
  );
  return [...unique].sort((a, b) => a.localeCompare(b, "es-MX"));
}
function fillCategories(state) {
  const names = availableCategories(state);
  const options = names
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join("");
  document.querySelectorAll("[data-category-select]").forEach((select) => {
    const previous = select.value;
    const custom = isNewCategory(select);
    select.innerHTML =
      '<option value="">Selecciona una categoría</option>' +
      options +
      '<option value="__nueva_categoria__" data-new-category>+ Agregar nueva categoría…</option>';
    if (custom) select.selectedIndex = select.options.length - 1;
    else select.value = names.includes(previous) ? previous : "";
    if (!initializedCategoryPickers.has(select)) {
      select.addEventListener("change", () => syncCategoryPicker(select, true));
      initializedCategoryPickers.add(select);
    }
    syncCategoryPicker(select);
  });
}
export async function reloadAfterSave(ctx) {
  try {
    await ctx.reload();
  } catch {
    toast(
      "El registro quedó guardado. Actualiza la página para ver los cambios.",
      "warning",
    );
  }
}
let deleting = false;
export function setupDeletion(ctx, onReload) {
  const form = $("#delete-form");
  let pending;
  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-delete]");
    if (!button || !ctx.admin) return;
    pending = { table: button.dataset.delete, id: button.dataset.id };
    $("#delete-name").textContent = button.dataset.name;
    $("#delete-detail").textContent =
      button.dataset.delete === "movements"
        ? "El saldo y el importe pendiente se recalcularán."
        : "Los pagos registrados se conservan en el cuadre.";
    clearFormError(form);
    modal("delete-modal").show();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pending || deleting) return;
    deleting = true;
    const { deleteRecord } =
      await import("./database.js?v=20261005-periodos-v8");
    const ok = await submitForm(form, async () => {
      await deleteRecord(pending.table, pending.id);
      await reloadAfterSave(ctx);
      onReload();
    });
    deleting = false;
    if (ok) modal("delete-modal").hide();
  });
}
export function rowActions(table, item, extra = "") {
  return `<div class="row-actions">${extra}<button class="btn icon-button" data-edit="${esc(item.id)}" title="Editar" aria-label="Editar ${esc(item.title ?? item.name)}">${icon("pencil")}</button><button class="btn icon-button danger-icon" data-delete="${table}" data-id="${esc(item.id)}" data-name="${esc(item.title)}" title="Eliminar" aria-label="Eliminar ${esc(item.title)}">${icon("trash3")}</button></div>`;
}
export function payments(ctx, onReload) {
  const form = $("#payment-form");
  const evidence = evidenceForm(form);
  let obligation, movement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!obligation) return;
    const { saveMovement } =
      await import("./database.js?v=20261005-periodos-v8");
    const ok = await submitForm(form, async () => {
      await evidence.save((evidencePath) =>
        saveMovement({
          id: form.elements.id.value,
          kind: "egreso",
          title: obligation.title,
          category: obligation.category,
          amountCents: cents(form.elements.amount.value),
          date: form.elements.date.value,
          note: form.elements.note.value,
          sourceType: obligation.sourceType,
          sourceId: obligation.sourceId,
          dueDate: obligation.sourceType === "fijo" ? obligation.dueDate : null,
          evidencePath,
        }),
      );
      await reloadAfterSave(ctx);
      onReload();
    });
    if (ok) modal("payment-modal").hide();
  });
  return (o, m) => {
    obligation = o;
    movement = m;
    form.reset();
    evidence.reset(m?.evidencePath);
    clearFormError(form);
    form.elements.id.value = m?.id ?? crypto.randomUUID();
    form.elements.amount.value = (m?.amountCents ?? o.remainingCents) / 100;
    form.elements.date.value = m?.date ?? today();
    form.elements.date.max = today();
    form.elements.note.value = m?.note ?? "";
    $("#payment-modal-title").textContent = m
      ? "Editar pago"
      : "Registrar pago";
    $("#payment-concept").textContent = o.title;
    $("#payment-remaining").textContent = money(o.remainingCents);
    modal("payment-modal").show();
  };
}
