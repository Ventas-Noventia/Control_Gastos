import { loadTaskActivity } from "./database.js?v=20261002-control-v7";
import { esc } from "./ui.js?v=20261002-control-v7";
import { money, dateLabel } from "./finanzas.js?v=20261002-control-v7";
import { evidenceButton } from "./evidence.js?v=20261002-control-v7";

const unknown = "Sin registro previo";
const actions = {
  creado: "Creó el pendiente",
  editado: "Modificó el pendiente",
  finalizado: "Finalizó el pendiente",
  reabierto: "Reabrió el pendiente",
  eliminado: "Eliminó el pendiente",
  pago_registrado: "Registró un pago",
  pago_editado: "Editó un pago",
  pago_eliminado: "Eliminó un pago",
};
const fields = {
  title: "nombre",
  description: "notas",
  category: "categoría",
  amount_cents: "importe",
  due_date: "fecha límite",
  priority: "prioridad",
  status: "estado",
  links: "enlaces de compra",
};
export function activityDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}
export function responsibleSummary(task, closed) {
  return `<div class="task-responsibles"><span><small>Creó</small><strong>${esc(task.createdByName || unknown)}</strong></span>${closed ? `<span><small>Finalizó</small><strong>${esc(task.completedByName || unknown)}</strong></span>` : ""}</div>`;
}
export function responsibleDetail(task, closed) {
  const entry = (label, name, date) =>
    `<div><dt>${label}</dt><dd><strong>${esc(name)}</strong>${date ? `<small>${esc(activityDate(date))} · CDMX</small>` : ""}</dd></div>`;
  return `<section class="task-detail-section"><h3>Responsables</h3><dl class="task-audit-summary">${entry("Creado por", task.createdByName || unknown, task.createdAt)}${entry("Última modificación por", task.updatedByName || unknown, task.updatedAt)}${entry("Finalizado por", closed ? task.completedByName || unknown : "Aún pendiente", closed ? task.completedAt : null)}</dl></section>`;
}
export function responsibleExport(task, closed) {
  return [
    task.createdByName || unknown,
    activityDate(task.createdAt),
    task.updatedByName || unknown,
    activityDate(task.updatedAt),
    closed ? task.completedByName || unknown : "",
    closed ? activityDate(task.completedAt) : "",
  ];
}
function describe(entry) {
  const details = entry.details ?? {};
  if (entry.action === "editado") {
    const changed = Array.isArray(details.fields)
      ? details.fields.map((key) => fields[key]).filter(Boolean)
      : [];
    return changed.length ? `Cambió: ${changed.join(", ")}.` : "";
  }
  if (
    entry.action.startsWith("pago_") &&
    Number.isFinite(details.amountCents)
  ) {
    const previous =
      entry.action === "pago_editado" &&
      Number.isFinite(details.previousAmountCents) &&
      details.previousAmountCents !== details.amountCents
        ? `Antes ${money(details.previousAmountCents)}. `
        : "";
    const evidenceChange =
      entry.action === "pago_editado" &&
      details.previousEvidencePath !== details.evidencePath
        ? details.evidencePath
          ? " · Adjuntó o cambió la evidencia"
          : " · Retiró la evidencia"
        : "";
    return `${previous}${money(details.amountCents)}${details.date ? ` · Pago con fecha ${dateLabel(details.date)}` : ""}${evidenceChange}`;
  }
  return "";
}
export function showTaskActivity(target, taskId) {
  let entries = [],
    hasMore = true,
    loading = false,
    errorMessage = "";
  function render() {
    target.innerHTML = `<h3>Actividad del pendiente</h3><p class="task-activity-help">Cambios más recientes primero. Fechas y horas de Ciudad de México.</p><ol class="task-activity-list">${entries.map((entry) => `<li class="task-activity-item"><span class="task-activity-dot ${entry.action === "finalizado" ? "is-complete" : ""}" aria-hidden="true"></span><div><strong>${esc(actions[entry.action] || "Actualizó el pendiente")}</strong><p>${esc(entry.actor_name || unknown)}</p><time datetime="${esc(entry.occurred_at)}">${esc(activityDate(entry.occurred_at))}</time>${describe(entry) ? `<small>${esc(describe(entry))}</small>` : ""}${evidenceButton(entry.details?.evidencePath)}${entry.details?.previousEvidencePath && entry.details.previousEvidencePath !== entry.details.evidencePath ? `<div class="activity-previous-evidence"><small>Evidencia anterior</small>${evidenceButton(entry.details.previousEvidencePath)}</div>` : ""}</div></li>`).join("")}</ol><p class="task-activity-message" role="status">${esc(loading ? "Cargando actividad…" : errorMessage || (!entries.length ? "Todavía no hay cambios registrados. El historial comienza al activar esta actualización." : ""))}</p>${hasMore ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-more-activity ${loading ? "disabled" : ""}>${errorMessage ? "Reintentar" : entries.length ? "Ver más actividad" : "Cargar actividad"}</button>` : ""}`;
    target
      .querySelector("[data-more-activity]")
      ?.addEventListener("click", loadMore);
  }
  async function loadMore() {
    if (loading || !hasMore || !target.isConnected) return;
    loading = true;
    errorMessage = "";
    render();
    try {
      const result = await loadTaskActivity(taskId, entries.at(-1)?.id ?? null);
      if (!target.isConnected) return;
      entries.push(...result.entries);
      hasMore = result.hasMore;
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
      if (target.isConnected) render();
    }
  }
  loadMore();
}
