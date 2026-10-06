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
  cents,
  validLinks,
  exportCSV,
  emptyRow,
  setupDeletion,
  payments,
  rowActions,
  reloadAfterSave,
  pageError,
  assertAdmin,
  setCategory,
  readCategory,
  availableCategories,
} from "./ui.js?v=20261002-control-v7";
import {
  saveTask,
  taskAuditAvailable,
} from "./database.js?v=20261002-control-v7";
import {
  responsibleSummary,
  responsibleDetail,
  responsibleExport,
  showTaskActivity,
} from "./task-activity.js?v=20261002-control-v7";
import {
  money,
  today,
  dateLabel,
  obligations,
} from "./finanzas.js?v=20261002-control-v7";
let ctx,
  tab = "activos",
  filtered = [],
  byId = new Map();
const form = $("#task-form");
function completed(task) {
  return (
    task.status === "completado" ||
    (task.amountCents > 0 && byId.get(task.id)?.remainingCents === 0)
  );
}
function render() {
  const state = ctx.state,
    tasks = state.tasks.filter((t) => !t.deletedAt);
  byId = new Map(
    obligations({ ...state, expenses: [] }, "2000-01-01", "2100-12-31").map(
      (o) => [o.sourceId, o],
    ),
  );
  const active = tasks.filter((t) => !completed(t));
  setStats([
    {
      label: "Pendientes activos",
      value: active.length,
      detail: "Por atender o completar",
      icon: "clipboard-check",
    },
    {
      label: "Por cubrir",
      value: money(
        active.reduce((s, t) => s + byId.get(t.id).remainingCents, 0),
      ),
      detail: "Importe pendiente de pago",
      icon: "wallet2",
      accent: true,
    },
    {
      label: "Fuera de fecha",
      value: active.filter((t) => t.dueDate < today()).length,
      detail: "Requieren seguimiento",
      icon: "clock",
    },
    {
      label: "Completados",
      value: tasks.filter(completed).length,
      detail: "Pagados o finalizados",
      icon: "check2-all",
    },
  ]);
  const previous = $("#category").value,
    categories = availableCategories(ctx.state);
  $("#category").innerHTML =
    '<option value="todos">Todas las categorías</option>' +
    categories
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
  $("#category").value = categories.includes(previous) ? previous : "todos";
  const query = $("#search").value.trim().toLowerCase(),
    category = $("#category").value;
  filtered = tasks
    .filter(
      (t) =>
        (tab === "todos" ||
          (tab === "completados" ? completed(t) : !completed(t))) &&
        (category === "todos" || t.category === category) &&
        (
          t.title +
          " " +
          t.category +
          " " +
          t.description +
          " " +
          (t.createdByName || "") +
          " " +
          (t.updatedByName || "") +
          " " +
          (t.completedByName || "")
        )
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  $("#result-count").textContent = `${filtered.length} registros`;
  $("#task-rows").innerHTML = filtered.length
    ? filtered
        .map((t) => {
          const o = byId.get(t.id),
            urls = JSON.parse(t.linksJson),
            status = completed(t)
              ? "Completado"
              : t.status === "en_proceso" && o.status !== "Vencido"
                ? "En proceso"
                : o.status;
          return `<tr><td><div class="item-title"><span class="category-icon">${icon(t.category === "Tecnología" ? "laptop" : t.category === "Despensa" ? "basket" : "clipboard-check")}</span><div><button class="title-button" data-detail="${esc(t.id)}">${esc(t.title)}</button><small>${esc(t.category)}${urls.length ? ` · ${urls.length} opciones` : ""}</small><div class="mobile-task-responsibles">${responsibleSummary(t, completed(t))}</div></div></div></td><td class="${t.dueDate < today() && !completed(t) ? "overdue" : ""}">${dateLabel(t.dueDate)}</td><td><span class="priority priority-${esc(t.priority)}">${icon("flag")}${{ alta: "Alta", media: "Media", baja: "Baja" }[t.priority]}</span></td><td class="money-cell"><strong>${money(t.amountCents)}</strong><small>${money(o.remainingCents)} por cubrir</small></td><td>${badge(status)}</td><td>${responsibleSummary(t, completed(t))}</td><td>${ctx.admin ? rowActions("tasks", t, o.remainingCents > 0 ? `<button class="btn btn-sm btn-soft" data-pay="${esc(t.id)}">Pagar</button>` : "") : `<button class="btn btn-sm btn-outline-secondary" data-detail="${esc(t.id)}">Ver</button>`}</td></tr>`;
        })
        .join("")
    : emptyRow(
        7,
        tasks.length ? "Sin coincidencias" : "Tu lista comienza aquí",
        "Agrega una compra o compromiso, define su fecha y compara hasta tres opciones.",
        tasks.length
          ? ""
          : `<button type="button" class="btn btn-primary empty-create-button" data-new-task data-admin-visible aria-controls="task-modal" aria-haspopup="dialog" ${ctx.admin ? "" : "disabled"}>${icon("plus-lg")}Agregar mi primer pendiente</button>`,
      );
}
function edit(task) {
  form.reset();
  clearFormError(form);
  $("#task-modal-title").textContent = task
    ? "Editar pendiente"
    : "Nuevo pendiente";
  const values = {
    id: task?.id ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    amount: (task?.amountCents ?? 0) / 100,
    dueDate: task?.dueDate ?? today(),
    priority: task?.priority ?? "media",
    status: task?.status ?? "pendiente",
  };
  for (const [key, value] of Object.entries(values))
    form.elements[key].value = value;
  setCategory(form, task?.category ?? "");
  const links = JSON.parse(task?.linksJson ?? "[]");
  for (let i = 1; i <= 3; i++)
    form.elements["link" + i].value = links[i - 1] ?? "";
  adjustStatus();
  modal("task-modal").show();
}
function adjustStatus() {
  const option = form.elements.status.querySelector('[value="completado"]'),
    hasAmount = Number(form.elements.amount.value) > 0;
  option.disabled = hasAmount;
  if (hasAmount && form.elements.status.value === "completado")
    form.elements.status.value = "pendiente";
}
function detail(task) {
  $("#detail-modal-title").textContent = task.title;
  const urls = JSON.parse(task.linksJson);
  $("#task-detail").innerHTML =
    `<div class="detail-grid"><div><span>Importe estimado</span><strong>${money(task.amountCents)}</strong></div><div><span>Fecha límite</span><strong>${dateLabel(task.dueDate)}</strong></div></div><p class="detail-notes">${esc(task.description || "Sin notas adicionales.")}</p><h3>Opciones de compra</h3><div class="purchase-links">${urls.length ? urls.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("link-45deg")}Opción ${i + 1}${icon("box-arrow-up-right")}</a>`).join("") : '<p class="muted">No se agregaron enlaces.</p>'}</div>${responsibleDetail(task, completed(task))}<section class="task-detail-section" id="task-activity"></section>`;
  showTaskActivity($("#task-activity"), task.id);
  modal("detail-modal").show();
}
try {
  ctx = await initPage("pendientes", "Pendientes");
  $("#task-audit-notice").hidden = !ctx.admin || (await taskAuditAvailable());
  const openPayment = payments(ctx, render);
  render();
  setupDeletion(ctx, render);
  document.addEventListener("control:updated", render);
  $("#task-modal").addEventListener("shown.bs.modal", () => {
    form.elements.title.focus();
  });
  $("#task-modal").addEventListener("hidden.bs.modal", () => {
    const button = $("#new-task");
    if (!button.disabled) button.focus();
    else $("#search").focus();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-new-task]");
    if (button && !button.disabled && ctx.admin) edit(null);
  });
  $("#search").addEventListener("input", render);
  $("#category").addEventListener("change", render);
  form.elements.amount.addEventListener("input", adjustStatus);
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((el) => {
        el.classList.toggle("active", el === b);
        el.setAttribute("aria-pressed", String(el === b));
      });
      render();
    }),
  );
  $("#task-rows").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const id = b.dataset.edit ?? b.dataset.detail ?? b.dataset.pay,
      t = ctx.state.tasks.find((t) => t.id === id);
    if (!t) return;
    if (b.dataset.detail) detail(t);
    if (b.dataset.edit && ctx.admin) edit(t);
    if (b.dataset.pay && ctx.admin) openPayment(byId.get(id));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await submitForm(form, async () => {
      assertAdmin(ctx);
      const f = form.elements;
      await saveTask({
        id: f.id.value || undefined,
        title: f.title.value.trim(),
        description: f.description.value,
        category: readCategory(form),
        amountCents: cents(f.amount.value, true),
        dueDate: f.dueDate.value,
        priority: f.priority.value,
        status: f.status.value,
        links: validLinks([f.link1.value, f.link2.value, f.link3.value]),
      });
      await reloadAfterSave(ctx);
      render();
    });
    if (ok) modal("task-modal").hide();
  });
  $("#export-tasks").addEventListener("click", () =>
    exportCSV("pendientes.csv", [
      [
        "Pendiente",
        "Categoría",
        "Fecha límite",
        "Prioridad",
        "Estado",
        "Importe MXN",
        "Pagado MXN",
        "Por cubrir MXN",
        "Enlace 1",
        "Enlace 2",
        "Enlace 3",
        "Creado por",
        "Fecha de creación CDMX",
        "Última modificación por",
        "Fecha de modificación CDMX",
        "Finalizado por",
        "Fecha de finalización CDMX",
      ],
      ...filtered.map((t) => {
        const o = byId.get(t.id);
        return [
          t.title,
          t.category,
          t.dueDate,
          t.priority,
          completed(t) ? "Completado" : o.status,
          t.amountCents / 100,
          o.paidCents / 100,
          o.remainingCents / 100,
          ...Array.from(
            { length: 3 },
            (_, i) => JSON.parse(t.linksJson)[i] || "",
          ),
          ...responsibleExport(t, completed(t)),
        ];
      }),
    ]),
  );
} catch (error) {
  pageError(error);
}
