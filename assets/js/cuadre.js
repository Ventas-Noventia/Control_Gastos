import {
  initPage,
  $,
  esc,
  icon,
  badge,
  setStats,
  movementDetails,
  obligationDetails,
  showDashboardDetails,
  renderAttention,
  exportCSV,
  emptyRow,
  setupDeletion,
  payments,
  rowActions,
  pageError,
} from "./ui.js?v=20261006-alertas-v9";
import { setupMovementForm } from "./movimiento-form.js?v=20261006-alertas-v9";
import { evidenceButton } from "./evidence.js?v=20261002-control-v7";
import {
  money,
  today,
  dateLabel,
  isDate,
  periodRange,
  reconcile,
} from "./finanzas.js?v=20261005-periodos-v8";
let ctx,
  report = null,
  range,
  view = "movimientos";
function render() {
  renderAttention(ctx, "todos");
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
      details: () =>
        movementDetails(
          ctx.state.movements.filter(
            (m) =>
              !m.deletedAt &&
              (m.date < range.from ||
                (m.kind === "saldo_inicial" && m.date <= range.to)),
          ),
          "Movimientos anteriores al periodo y apertura registrada dentro de él. Los pagos restan al saldo.",
          true,
        ),
      value: money(report.opening + report.adjustments),
      detail: "Saldo anterior + apertura del periodo",
      icon: "wallet2",
    },
    {
      label: "Ingresos recibidos",
      details: () =>
        movementDetails(
          report.movements.filter((m) => m.kind === "ingreso"),
          "Ingresos del periodo consultado.",
        ),
      value: money(report.incomes),
      detail: "Entradas registradas en el periodo",
      icon: "arrow-down-left",
    },
    {
      label: "Pagos realizados",
      details: () =>
        movementDetails(
          report.movements.filter((m) => m.kind === "egreso"),
          "Pagos realizados dentro del periodo, aunque su vencimiento corresponda a otro periodo.",
        ),
      value: money(report.payments),
      detail: "Salidas registradas en el periodo",
      icon: "arrow-up-right",
    },
    {
      label: "Saldo final de caja",
      details: () =>
        movementDetails(
          ctx.state.movements.filter((m) => !m.deletedAt && m.date <= range.to),
          "Todos los movimientos hasta el corte. Saldo inicial + ingresos − pagos; los pagos aparecen con signo negativo.",
          true,
        ),
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
    `<section class="projection-summary"><span class="eyebrow">COMPROMISOS DEL PERIODO</span><div><button type="button" class="projection-detail-button" data-report-detail="planned" aria-haspopup="dialog">Programado <strong>${money(report.planned)}</strong><small>Ver detalle →</small></button></div><div><button type="button" class="projection-detail-button" data-report-detail="remaining" aria-haspopup="dialog">Por cubrir <strong>${money(report.remaining)}</strong><small>Ver detalle →</small></button></div><small>Incluye pendientes y vencimientos de gastos fijos con fecha en esta consulta.</small></section><section class="projected-card ${report.projected < 0 ? "negative" : ""}"><span>Saldo después de cubrir lo pendiente</span><strong>${money(report.projected)}</strong><button type="button" class="btn btn-outline-secondary btn-sm" data-report-detail="projected" aria-haspopup="dialog">Ver cálculo</button><p>${report.projected < 0 ? "Hace falta dinero para cubrir todos los compromisos del periodo." : "Saldo de caja menos los compromisos que siguen pendientes."}</p></section>`;
  $("#movement-rows").innerHTML = report.movements.length
    ? report.movements
        .map(
          (m) =>
            `<tr><td><strong>${esc(m.title)}</strong><small class="cell-small">${esc(m.category)}</small>${m.note ? `<small class="cell-small table-notes">${esc(m.note)}</small>` : ""}${evidenceButton(m.evidencePath)}</td><td>${dateLabel(m.date)}</td><td><span class="status-badge muted">${m.kind === "saldo_inicial" ? "Apertura" : m.sourceType === "pendiente" ? "Pendiente" : m.sourceType === "fijo" ? "Gasto fijo" : "Ingreso"}</span></td><td><span class="income-amount">${m.kind !== "egreso" ? money(m.amountCents) : "—"}</span></td><td><span class="expense-amount">${m.kind === "egreso" ? money(m.amountCents) : "—"}</span></td><td>${ctx.admin ? (m.kind === "saldo_inicial" ? `<button class="btn icon-button" data-edit="${esc(m.id)}" title="Editar saldo" aria-label="Editar saldo inicial">${icon("pencil")}</button>` : rowActions("movements", m)) : "—"}</td></tr>`,
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
      "Evidencia",
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
      m.evidencePath ? "Sí" : "No",
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
  $("#projection").addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-detail]");
    if (!button || !report) return;
    const kind = button.dataset.reportDetail;
    if (kind === "planned")
      showDashboardDetails(
        "Compromisos programados",
        () =>
          obligationDetails(
            report.obligations,
            "Compromisos con vencimiento dentro de la consulta.",
          ),
        button,
      );
    else if (kind === "remaining")
      showDashboardDetails(
        "Compromisos por cubrir",
        () =>
          obligationDetails(
            report.obligations.filter((o) => o.remainingCents > 0),
            "Saldos que faltan por pagar al corte.",
            "remainingCents",
          ),
        button,
      );
    else
      showDashboardDetails(
        "Saldo después de cubrir lo pendiente",
        () => ({
          ...obligationDetails(
            report.obligations.filter((o) => o.remainingCents > 0),
            "Saldo final de caja menos compromisos por cubrir. Es una proyección; no registra pagos.",
            "remainingCents",
          ),
          summary: [
            { label: "Saldo final de caja", value: money(report.closing) },
            {
              label: "Menos compromisos por cubrir",
              value: money(report.remaining),
            },
            { label: "Saldo proyectado", value: money(report.projected) },
          ],
        }),
        button,
      );
  });
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
