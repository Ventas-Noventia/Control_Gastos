import {
  money,
  dateLabel,
  today,
  addDays,
  obligations,
} from "./finanzas.js?v=20261005-periodos-v8";
import { getModal } from "./modal-controller.js?v=20261002-control-v7";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const priorityLabel = (p) =>
  ({ alta: "Alta", media: "Media", baja: "Baja" })[p] || "—";
export function taskDetails(tasks, byId, description = "", admin = false) {
  return {
    description,
    summary: [
      { label: "Registros", value: tasks.length },
      {
        label: "Por cubrir en esta lista",
        value: money(
          tasks.reduce(
            (sum, t) => sum + (byId.get(t.id)?.remainingCents || 0),
            0,
          ),
        ),
      },
    ],
    columns: [
      "Pendiente",
      "Categoría",
      "Fecha límite",
      "Prioridad",
      "Estado",
      "Estimado",
      "Pagado",
      "Por cubrir",
      "Creado por",
    ],
    rows: tasks.map((t) => {
      const o = byId.get(t.id);
      return {
        cells: [
          t.title,
          t.category,
          dateLabel(t.dueDate),
          priorityLabel(t.priority),
          t.status === "completado" ||
          (t.amountCents > 0 && o?.remainingCents === 0)
            ? "Completado"
            : o?.status,
          t.amountCents === 0 ? "Sin importe" : money(t.amountCents),
          money(o?.paidCents || 0),
          money(o?.remainingCents || 0),
          t.createdByName || "Sin registro previo",
        ],
        taskId: t.id,
        prioritize:
          admin &&
          t.status !== "completado" &&
          !(t.amountCents > 0 && o?.remainingCents === 0),
      };
    }),
  };
}
export function obligationDetails(
  items,
  description = "",
  amount = "amountCents",
) {
  return {
    description,
    columns: [
      "Concepto",
      "Categoría",
      "Origen",
      "Vencimiento",
      "Estado",
      "Programado",
      "Pagado al corte",
      "Por cubrir",
    ],
    rows: items.map((o) => ({
      cells: [
        o.title,
        o.category,
        o.sourceType === "fijo" ? "Gasto fijo" : "Pendiente",
        dateLabel(o.dueDate),
        o.status,
        money(o.amountCents),
        money(o.paidCents),
        money(o.remainingCents),
      ],
    })),
    summary: [
      {
        label: "Total de esta lista",
        value: money(items.reduce((sum, o) => sum + o[amount], 0)),
      },
    ],
  };
}
export function movementDetails(items, description = "", signed = false) {
  return {
    description,
    columns: [
      "Concepto",
      "Categoría",
      "Fecha",
      "Tipo",
      "Importe",
      "Registrado por",
      "Notas",
    ],
    rows: items.map((m) => ({
      cells: [
        m.title,
        m.category,
        dateLabel(m.date),
        m.kind === "egreso"
          ? "Pago"
          : m.kind === "ingreso"
            ? "Ingreso"
            : "Saldo inicial",
        money(signed && m.kind === "egreso" ? -m.amountCents : m.amountCents),
        m.recordedBy || "Sin registro",
        m.note || "—",
      ],
    })),
    summary: [
      {
        label: signed
          ? "Saldo de estos movimientos"
          : "Total de estos movimientos",
        value: money(
          items.reduce(
            (sum, m) =>
              sum +
              (signed && m.kind === "egreso" ? -m.amountCents : m.amountCents),
            0,
          ),
        ),
      },
    ],
  };
}
export function userDetails(users, description = "") {
  return {
    description,
    columns: ["Nombre", "Correo", "Rol", "Estado"],
    rows: users.map((u) => ({
      cells: [
        u.name,
        u.email,
        u.role === "admin" ? "Administrador" : "Consulta",
        u.active ? "Activo" : "Desactivado",
      ],
    })),
  };
}
// La alerta siempre usa la fecha real de CDMX y pagos realizados hasta hoy,
// independientemente del periodo histórico/futuro seleccionado en un dashboard.
export function attentionItems(state, scope = "todos", reference = today()) {
  const end = addDays(reference, 7);
  const tasks = state.tasks.filter(
    (t) => !t.deletedAt && t.status !== "completado",
  );
  const source = {
    ...state,
    tasks: scope === "fijo" ? [] : tasks,
    expenses:
      scope === "pendiente" ? [] : state.expenses.filter((e) => !e.deletedAt),
    movements: state.movements.filter(
      (m) => !m.deletedAt && m.date <= reference,
    ),
  };
  return obligations(source, "2000-01-01", end)
    .filter(
      (o) =>
        o.remainingCents > 0 ||
        (o.sourceType === "pendiente" &&
          o.amountCents === 0 &&
          o.status !== "Completado"),
    )
    .map((o) => ({
      ...o,
      urgency:
        o.dueDate < reference
          ? "Vencido"
          : o.dueDate === reference
            ? "Vence hoy"
            : "Por vencer",
      priority: tasks.find((t) => t.id === o.sourceId)?.priority,
    }))
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.priority === "alta" ? -1 : 0) - (b.priority === "alta" ? -1 : 0) ||
        a.title.localeCompare(b.title),
    );
}
let node,
  current,
  title,
  page = 0,
  query = "",
  returnFocus;
const pageSize = 20;
function ensureModal() {
  if (node) return;
  node = document.createElement("div");
  node.id = "dashboard-detail-modal";
  node.className = "modal fade";
  node.tabIndex = -1;
  node.setAttribute("aria-labelledby", "dashboard-detail-title");
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = `<div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="dashboard-detail-title"></h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar detalle"></button></div><div class="modal-body"><p id="dashboard-detail-description" class="muted"></p><div id="dashboard-detail-summary" class="insight-summary"></div><label for="dashboard-detail-search" class="form-label">Buscar en esta lista</label><input id="dashboard-detail-search" type="search" class="form-control mb-3" placeholder="Concepto, categoría, estado…"/><div class="table-responsive"><table class="table control-table"><thead id="dashboard-detail-head"></thead><tbody id="dashboard-detail-rows"></tbody></table></div><div class="insight-pagination"><span id="dashboard-detail-count" role="status"></span><div><button type="button" id="dashboard-detail-prev" class="btn btn-outline-secondary btn-sm">Anterior</button> <button type="button" id="dashboard-detail-next" class="btn btn-outline-secondary btn-sm">Siguiente</button></div></div></div><div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button></div></div></div>`;
  document.body.append(node);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && node.classList.contains("show"))
      getModal(node).hide();
  });
  node
    .querySelector("#dashboard-detail-search")
    .addEventListener("input", (e) => {
      query = e.target.value;
      page = 0;
      renderDetail();
    });
  node.querySelector("#dashboard-detail-prev").addEventListener("click", () => {
    page--;
    renderDetail();
  });
  node.querySelector("#dashboard-detail-next").addEventListener("click", () => {
    page++;
    renderDetail();
  });
  node.addEventListener("hidden.bs.modal", () => {
    returnFocus?.isConnected && returnFocus.focus();
  });
  node.addEventListener("click", (e) => {
    const button = e.target.closest("[data-insight-task]");
    if (!button) return;
    const payload = {
      id: button.dataset.insightTask,
      prioritize: button.dataset.prioritize === "true",
    };
    node.addEventListener(
      "hidden.bs.modal",
      () =>
        document.dispatchEvent(
          new CustomEvent("control:open-task", { detail: payload }),
        ),
      { once: true },
    );
    getModal(node).hide();
  });
  document.addEventListener("control:updated", () => {
    if (node.classList.contains("show")) renderDetail();
  });
}
function renderDetail() {
  const data = typeof current === "function" ? current() : current;
  const action = data.rows.some((r) => r.taskId || r.href);
  const rows = data.rows.filter((r) =>
    r.cells
      .join(" ")
      .toLocaleLowerCase("es")
      .includes(query.trim().toLocaleLowerCase("es")),
  );
  page = Math.min(
    Math.max(page, 0),
    Math.max(0, Math.ceil(rows.length / pageSize) - 1),
  );
  node.querySelector("#dashboard-detail-title").textContent = title;
  node.querySelector("#dashboard-detail-description").textContent =
    data.description || "";
  node.querySelector("#dashboard-detail-summary").innerHTML = (
    data.summary || []
  )
    .map(
      (s) =>
        `<div><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong></div>`,
    )
    .join("");
  node.querySelector("#dashboard-detail-head").innerHTML =
    `<tr>${data.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}${action ? '<th scope="col">Acciones</th>' : ""}</tr>`;
  node.querySelector("#dashboard-detail-rows").innerHTML = rows.length
    ? rows
        .slice(page * pageSize, (page + 1) * pageSize)
        .map(
          (r) =>
            `<tr>${r.cells.map((c) => `<td>${esc(c)}</td>`).join("")}${action ? `<td><div class="insight-actions">${r.taskId ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-insight-task="${esc(r.taskId)}">Ver pendiente</button>${r.prioritize ? `<button type="button" class="btn btn-sm btn-soft" data-insight-task="${esc(r.taskId)}" data-prioritize="true">Dar prioridad</button>` : ""}` : r.href ? `<a class="btn btn-sm btn-outline-secondary" href="${esc(r.href)}">${esc(r.linkLabel || "Ver registros")}</a>` : "—"}</div></td>` : ""}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${data.columns.length + Number(action)}"><p class="p-3 muted">${query ? "Sin coincidencias en esta lista." : data.emptyMessage || "No hay registros para este indicador."}</p></td></tr>`;
  node.querySelector("#dashboard-detail-count").textContent =
    `${rows.length} de ${data.rows.length} registros · Página ${page + 1} de ${Math.max(1, Math.ceil(rows.length / pageSize))}`;
  node.querySelector("#dashboard-detail-prev").disabled = page === 0;
  node.querySelector("#dashboard-detail-next").disabled =
    (page + 1) * pageSize >= rows.length;
}
export function showDashboardDetails(
  label,
  data,
  trigger = document.activeElement,
) {
  ensureModal();
  title = label;
  current = data;
  returnFocus = trigger;
  page = 0;
  query = "";
  node.querySelector("#dashboard-detail-search").value = "";
  renderDetail();
  getModal(node).show();
}
let clockStarted = false;
export function renderAttention(ctx, scope) {
  if (!clockStarted) {
    clockStarted = true;
    let date = today();
    setInterval(() => {
      if (date !== today()) {
        date = today();
        document.dispatchEvent(new CustomEvent("control:updated"));
      }
    }, 60000);
  }
  let banner = document.querySelector("#attention-notice");
  if (!banner) {
    banner = document.createElement("section");
    banner.id = "attention-notice";
    banner.className = "attention-notice";
    banner.setAttribute("aria-label", "Vencimientos que requieren atención");
    document.querySelector("#stats").before(banner);
  }
  const items = attentionItems(ctx.state, scope),
    overdue = items.filter((o) => o.urgency === "Vencido").length,
    dueToday = items.filter((o) => o.urgency === "Vence hoy").length,
    soon = items.length - overdue - dueToday;
  banner.hidden = !items.length;
  if (!items.length) return;
  banner.classList.toggle("has-overdue", overdue > 0);
  banner.innerHTML = `<div><strong>${overdue ? "Atiende primero los vencidos" : dueToday ? "Tienes vencimientos para hoy" : "Hay compromisos por vencer"}</strong><p>${overdue} vencidos · ${dueToday} vencen hoy · ${soon} en los próximos 7 días.</p><small>Prioriza lo más cercano. Aviso al ${dateLabel(today())}; los pagos cubiertos dejan de aparecer.</small></div><button type="button" class="btn btn-outline-secondary" id="show-attention">Ver vencimientos</button>`;
  banner.querySelector("button").addEventListener("click", (e) =>
    showDashboardDetails(
      "Vencimientos que requieren atención",
      () => ({
        description:
          "" +
          (ctx.admin && scope === "pendiente"
            ? " Dar prioridad abre la edición; guarda para aplicar el cambio."
            : " Consulta los registros que requieren seguimiento."),
        columns: [
          "Concepto",
          "Origen",
          "Vencimiento",
          "Atención",
          "Prioridad",
          "Por cubrir",
        ],
        rows: attentionItems(ctx.state, scope).map((o) => ({
          cells: [
            o.title,
            o.sourceType === "fijo" ? "Gasto fijo" : "Pendiente",
            dateLabel(o.dueDate),
            o.urgency,
            priorityLabel(o.priority),
            o.amountCents === 0 ? "Sin importe" : money(o.remainingCents),
          ],
          taskId:
            scope === "pendiente" && o.sourceType === "pendiente"
              ? o.sourceId
              : null,
          prioritize: ctx.admin,
          linkLabel:
            o.sourceType === "fijo" ? "Ver mes del gasto" : "Ver pendientes",
          href:
            o.sourceType === "fijo"
              ? `gastos-fijos.html?vence=${encodeURIComponent(o.dueDate)}`
              : scope !== "pendiente"
                ? "pendientes.html"
                : null,
        })),
      }),
      e.currentTarget,
    ),
  );
}
