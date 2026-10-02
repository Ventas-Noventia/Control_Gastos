import {
  initPage,
  $,
  esc,
  icon,
  badge,
  setStats,
  exportCSV,
  emptyRow,
  setupDeletion,
  payments,
  rowActions,
  pageError,
} from "./ui.js?v=20261001-menu-superior-v4";
import { setupMovementForm } from "./movimiento-form.js?v=20261001-menu-superior-v4";
import {
  money,
  today,
  dateLabel,
  isDate,
  periodRange,
  reconcile,
} from "./finanzas.js?v=20261001-menu-superior-v4";
let ctx,
  report = null,
  range,
  view = "movimientos";
function render() {
  const period = $("#period").value;
  $("#custom-dates").hidden = period !== "personalizado";
  $("#anchor").hidden = period === "personalizado";
  range =
    period === "personalizado"
      ? { from: $("#from").value, to: $("#to").value }
      : periodRange(period, $("#anchor").value || today());
  const valid =
    isDate(range.from) &&
    isDate(range.to) &&
    range.from <= range.to &&
    Date.parse(range.to) - Date.parse(range.from) <= 366 * 86400000;
  $("#range-error").hidden = valid;
  $("#report-result").hidden = !valid;
  $("#export-report").disabled = !valid;
  $("#print-report").disabled = !valid;
  if (!valid) {
    report = null;
    return;
  }
  report = reconcile(ctx.state, range.from, range.to);
  $("#report-range").textContent =
    `Consulta del ${dateLabel(range.from)} al ${dateLabel(range.to)} · MXN`;
  setStats([
    {
      label: "Saldo al inicio",
      value: money(report.opening + report.adjustments),
      detail: "Saldo anterior + apertura del periodo",
      icon: "wallet2",
    },
    {
      label: "Ingresos recibidos",
      value: money(report.incomes),
      detail: "Entradas registradas en el periodo",
      icon: "arrow-down-left",
    },
    {
      label: "Pagos realizados",
      value: money(report.payments),
      detail: "Salidas registradas en el periodo",
      icon: "arrow-up-right",
    },
    {
      label: "Saldo final de caja",
      value: money(report.closing),
      detail: "Saldo inicial + ingresos − pagos",
      icon: "calculator",
      accent: true,
    },
  ]);
  $("#opening-notice").hidden = ctx.state.movements.some(
    (m) => m.kind === "saldo_inicial",
  );
  $("#projection").innerHTML =
    `<section class="projection-summary"><span class="eyebrow">COMPROMISOS DEL PERIODO</span><div><span>Programado</span><strong>${money(report.planned)}</strong></div><div><span>Por cubrir</span><strong>${money(report.remaining)}</strong></div><small>Incluye pendientes y vencimientos de gastos fijos con fecha en esta consulta.</small></section><section class="projected-card ${report.projected < 0 ? "negative" : ""}"><span>Saldo después de cubrir lo pendiente</span><strong>${money(report.projected)}</strong><p>${report.projected < 0 ? "Hace falta dinero para cubrir todos los compromisos del periodo." : "Saldo de caja menos los compromisos que siguen pendientes."}</p></section>`;
  $("#movement-rows").innerHTML = report.movements.length
    ? report.movements
        .map(
          (m) =>
            `<tr><td><strong>${esc(m.title)}</strong><small class="cell-small">${esc(m.category)}</small>${m.note ? `<small class="cell-small table-notes">${esc(m.note)}</small>` : ""}</td><td>${dateLabel(m.date)}</td><td><span class="status-badge muted">${m.kind === "saldo_inicial" ? "Apertura" : m.sourceType === "pendiente" ? "Pendiente" : m.sourceType === "fijo" ? "Gasto fijo" : "Ingreso"}</span></td><td><span class="income-amount">${m.kind !== "egreso" ? money(m.amountCents) : "—"}</span></td><td><span class="expense-amount">${m.kind === "egreso" ? money(m.amountCents) : "—"}</span></td><td>${ctx.admin ? (m.kind === "saldo_inicial" ? `<button class="btn icon-button" data-edit="${esc(m.id)}" title="Editar saldo" aria-label="Editar saldo inicial">${icon("pencil")}</button>` : rowActions("movements", m)) : "—"}</td></tr>`,
        )
        .join("")
    : emptyRow(
        6,
        "Sin movimientos en este periodo",
        "Los ingresos y pagos realizados aparecerán aquí con su fecha.",
      );
  $("#commitment-rows").innerHTML = report.obligations.length
    ? report.obligations
        .map(
          (o) =>
            `<tr><td><strong>${esc(o.title)}</strong><small class="cell-small">${esc(o.category)} · ${o.sourceType === "fijo" ? "Gasto fijo" : "Pendiente"}</small></td><td>${dateLabel(o.dueDate)}</td><td>${money(o.amountCents)}</td><td>${money(o.paidCents)}</td><td><strong>${money(o.remainingCents)}</strong></td><td>${badge(o.status)}</td></tr>`,
        )
        .join("")
    : emptyRow(
        6,
        "Sin compromisos en este periodo",
        "Aquí verás los pendientes y gastos fijos del rango seleccionado.",
      );
  $("#movement-view").hidden = view !== "movimientos";
  $("#commitment-view").hidden = view !== "compromisos";
  $("#table-caption").textContent =
    view === "movimientos"
      ? "Por fecha de movimiento"
      : "Por fecha de vencimiento";
}
function exportReport() {
  if (!report) return;
  exportCSV(`cuadre-${range.from}-${range.to}.csv`, [
    ["CONTROL · CUADRE"],
    ["Desde", range.from],
    ["Hasta", range.to],
    ["Moneda", "MXN"],
    [],
    ["Resumen", "Importe MXN"],
    ["Saldo anterior", report.opening / 100],
    ["Apertura del periodo", report.adjustments / 100],
    ["Ingresos recibidos", report.incomes / 100],
    ["Pagos realizados", report.payments / 100],
    ["Saldo final", report.closing / 100],
    ["Gastos programados", report.planned / 100],
    ["Por cubrir", report.remaining / 100],
    ["Saldo proyectado", report.projected / 100],
    [],
    ["MOVIMIENTOS"],
    [
      "Fecha",
      "Tipo",
      "Concepto",
      "Categoría",
      "Origen",
      "Entrada MXN",
      "Salida MXN",
      "Notas",
      "Registrado por",
    ],
    ...report.movements.map((m) => [
      m.date,
      m.kind,
      m.title,
      m.category,
      m.sourceType,
      m.kind === "egreso" ? 0 : m.amountCents / 100,
      m.kind === "egreso" ? m.amountCents / 100 : 0,
      m.note,
      m.recordedBy,
    ]),
    [],
    ["COMPROMISOS"],
    [
      "Vencimiento",
      "Concepto",
      "Categoría",
      "Origen",
      "Estado",
      "Programado MXN",
      "Pagado al corte MXN",
      "Por cubrir MXN",
    ],
    ...report.obligations.map((o) => [
      o.dueDate,
      o.title,
      o.category,
      o.sourceType,
      o.status,
      o.amountCents / 100,
      o.paidCents / 100,
      o.remainingCents / 100,
    ]),
  ]);
}
try {
  ctx = await initPage("cuadre", "Cuadre");
  const month = periodRange("mes", today());
  $("#anchor").value = today();
  $("#from").value = month.from;
  $("#to").value = month.to;
  const editOpening = setupMovementForm(ctx, render, true),
    editIncome = setupMovementForm(ctx, render),
    editPayment = payments(ctx, render);
  render();
  setupDeletion(ctx, render);
  document.addEventListener("control:updated", render);
  ["period", "anchor", "from", "to"].forEach((id) =>
    $("#" + id).addEventListener("change", render),
  );
  $("#edit-opening").addEventListener("click", () =>
    editOpening(ctx.state.movements.find((m) => m.kind === "saldo_inicial")),
  );
  $("#export-report").addEventListener("click", exportReport);
  $("#print-report").addEventListener("click", () => window.print());
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view;
      document.querySelectorAll("[data-view]").forEach((el) => {
        el.classList.toggle("active", el === b);
        el.setAttribute("aria-pressed", String(el === b));
      });
      render();
    }),
  );
  $("#movement-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (!b || !ctx.admin) return;
    const m = ctx.state.movements.find((m) => m.id === b.dataset.edit);
    if (!m) return;
    if (m.kind === "saldo_inicial") editOpening(m);
    else if (m.kind === "ingreso") editIncome(m);
    else
      editPayment(
        {
          key: m.id,
          sourceType: m.sourceType,
          sourceId: m.sourceId,
          title: m.title,
          category: m.category,
          dueDate: m.dueDate ?? m.date,
          amountCents: m.amountCents,
          paidCents: m.amountCents,
          remainingCents: 0,
          status: "Pagado",
        },
        m,
      );
  });
} catch (error) {
  pageError(error);
}
