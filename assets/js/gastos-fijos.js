import {
  initPage,
  $,
  esc,
  icon,
  badge,
  setStats,
  obligationDetails,
  movementDetails,
  renderAttention,
  modal,
  clearFormError,
  submitForm,
  cents,
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
} from "./ui.js?v=20261006-alertas-v9";
import { saveExpense } from "./database.js?v=20261005-periodos-v8";
import {
  evidenceForm,
  evidenceButton,
} from "./evidence.js?v=20261002-control-v7";
import {
  money,
  today,
  dateLabel,
  periodRange,
  obligations,
  scheduleAt,
} from "./finanzas.js?v=20261005-periodos-v8";
const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
function scheduleLabel(s) {
  if (s.frequency === "semanal") return weekdays[s.weekDay];
  if (s.frequency === "quincenal") return `Días ${s.halfDay1} y ${s.halfDay2}`;
  if (s.frequency === "anual")
    return `Día ${s.monthDay} de ${months[s.cycleMonth - 1]}, cada año`;
  if (s.frequency === "bimestral")
    return `Día ${s.monthDay}, cada 2 meses desde ${months[s.cycleMonth - 1]}`;
  return `Día ${s.monthDay} de cada mes`;
}
let ctx,
  filtered = [],
  dueMap = new Map(),
  periodDues = [];
const form = $("#expense-form");
const evidence = evidenceForm(form);
function expenseStatus(expense) {
  const dues = periodDues.filter((o) => o.sourceId === expense.id);
  if (!dues.length) return "Sin vencimiento";
  if (dues.every((o) => o.remainingCents === 0)) return "Pagado";
  if (dues.some((o) => o.status === "Vencido")) return "Vencido";
  if (dues.some((o) => o.paidCents > 0)) return "Pago parcial";
  return "A tiempo";
}
function lastPayment(o) {
  return ctx.state.movements
    .filter(
      (m) =>
        !m.deletedAt &&
        m.kind === "egreso" &&
        m.sourceType === "fijo" &&
        m.sourceId === o.sourceId &&
        m.dueDate === o.dueDate,
    )
    .sort((a, b) =>
      (b.createdAt || b.date).localeCompare(a.createdAt || a.date),
    )[0];
}
function currentSchedule(expense) {
  return (
    scheduleAt(ctx.state.schedules, expense.id, today()) ??
    scheduleAt(ctx.state.schedules, expense.id, "2100-12-31")
  );
}
function render() {
  const state = ctx.state,
    range = periodRange($("#period").value, $("#anchor").value || today()),
    dues = obligations({ ...state, tasks: [] }, range.from, range.to),
    expenses = state.expenses.filter((e) => !e.deletedAt);
  dueMap = new Map(dues.map((o) => [o.key, o]));
  periodDues = dues;
  setStats([
    {
      label: "Gastos registrados",
      details: () => ({
        description:
          "Catálogo de gastos no eliminados. El importe vigente es por pago, no un total mensual.",
        columns: [
          "Concepto",
          "Categoría",
          "Frecuencia",
          "Día de pago",
          "Importe por pago",
          "Inicio",
          "Programación",
        ],
        rows: ctx.state.expenses
          .filter((e) => !e.deletedAt)
          .map((e) => {
            const s = currentSchedule(e);
            return {
              cells: [
                e.title,
                e.category,
                s?.frequency || "Sin programación",
                s ? scheduleLabel(s) : "—",
                money(s?.amountCents || 0),
                dateLabel(e.startDate),
                s?.effectiveDate > today()
                  ? "Programado"
                  : s?.active
                    ? "Activo"
                    : "Pausado",
              ],
            };
          }),
      }),
      value: expenses.length,
      detail: "Servicios y compromisos recurrentes",
      icon: "arrow-repeat",
    },
    {
      label: "Programado en el periodo",
      details: () =>
        obligationDetails(
          periodDues,
          "Vencimientos incluidos en el periodo seleccionado.",
        ),
      value: money(dues.reduce((s, o) => s + o.amountCents, 0)),
      detail: `${dateLabel(range.from)} — ${dateLabel(range.to)}`,
      icon: "calendar3",
    },
    {
      label: "Pagado de lo programado",
      details: () => {
        const cutoff = periodRange(
          $("#period").value,
          $("#anchor").value || today(),
        ).to;
        const keys = new Set(
          periodDues.map((o) => `${o.sourceId}:${o.dueDate}`),
        );
        return movementDetails(
          ctx.state.movements.filter(
            (m) =>
              !m.deletedAt &&
              m.kind === "egreso" &&
              m.sourceType === "fijo" &&
              keys.has(`${m.sourceId}:${m.dueDate}`) &&
              m.date <= cutoff,
          ),
          "Pagos ligados a los vencimientos seleccionados y realizados hasta el corte. Incluye pagos anteriores al inicio de la consulta.",
        );
      },
      value: money(dues.reduce((s, o) => s + o.paidCents, 0)),
      detail: "Pagos ligados a estos vencimientos",
      icon: "check2-all",
    },
    {
      label: "Por cubrir en el periodo",
      details: () =>
        obligationDetails(
          periodDues.filter((o) => o.remainingCents > 0),
          "Vencimientos con saldo por pagar al corte seleccionado.",
          "remainingCents",
        ),
      value: money(dues.reduce((s, o) => s + o.remainingCents, 0)),
      detail: "Compromisos que siguen abiertos",
      icon: "wallet2",
      accent: true,
    },
  ]);
  renderAttention(ctx, "fijo");
  const q = $("#search").value.trim().toLowerCase(),
    frequency = $("#frequency").value,
    statusFilter = $("#expense-status").value;
  filtered = expenses
    .filter(
      (e) =>
        (e.title + " " + e.category).toLowerCase().includes(q) &&
        (frequency === "todos" ||
          currentSchedule(e)?.frequency === frequency) &&
        (statusFilter === "todos" || expenseStatus(e) === statusFilter),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  $("#result-count").textContent = `${filtered.length} registros`;
  $("#expense-rows").innerHTML = filtered.length
    ? filtered
        .map((e) => {
          const s = currentSchedule(e);
          if (!s) return "";
          const future = state.schedules
            .filter((v) => v.expenseId === e.id && v.effectiveDate > today())
            .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0];
          const ownDues = dues.filter((o) => o.sourceId === e.id);
          return `<tr><td><div class="item-title"><span class="category-icon">${icon("arrow-repeat")}</span><div><strong>${esc(e.title)}</strong><small>${esc(e.category)}</small><span class="expense-mobile-status">${badge(expenseStatus(e))}</span>${evidenceButton(e.evidencePath)}</div></div></td><td><span class="status-badge purple text-capitalize">${esc(s.frequency)}</span><small class="cell-small">${esc(scheduleLabel(s))}</small></td><td class="money-cell"><strong>${money(s.amountCents)}</strong>${future ? `<small>Cambio desde ${dateLabel(future.effectiveDate)}</small>` : ""}</td><td>${badge(s.effectiveDate > today() ? "Programado" : s.active ? "Activo" : "Pausado")}</td><td>${badge(expenseStatus(e))}${ownDues.length ? `<small class="cell-small">${ownDues.filter((o) => o.remainingCents === 0).length} de ${ownDues.length} vencimientos pagados</small>` : ""}</td><td>${ctx.admin ? rowActions("expenses", e) : "—"}</td></tr>`;
        })
        .join("")
    : emptyRow(
        6,
        "Programa tus gastos",
        "Agrega luz, agua, renta, sueldos o suscripciones y define su frecuencia.",
        expenses.length
          ? ""
          : `<button type="button" class="btn btn-primary empty-create-button" data-new-expense data-admin-visible aria-controls="expense-modal" aria-haspopup="dialog" ${ctx.admin ? "" : "disabled"}>${icon("plus-lg")}Agregar mi primer gasto fijo</button>`,
      );
  $("#due-rows").innerHTML = dues.length
    ? dues
        .map((o) => {
          const payment = lastPayment(o);
          return `<tr><td><strong>${esc(o.title)}</strong><small class="cell-small">${esc(o.category)}</small><span class="expense-mobile-status">${badge(o.status)}</span></td><td>${dateLabel(o.dueDate)}</td><td>${money(o.amountCents)}</td><td><strong>${money(o.remainingCents)}</strong><small class="cell-small">${money(o.paidCents)} pagados al corte</small></td><td>${badge(o.status)}${o.status === "Vencido" && o.paidCents > 0 ? '<small class="cell-small">Con pago parcial</small>' : ""}</td><td><div class="row-actions">${ctx.admin && o.remainingCents > 0 ? `<button class="btn btn-sm btn-soft" data-pay="${esc(o.key)}">Registrar pago</button>` : ""}${ctx.admin && payment ? `<button class="btn icon-button" data-edit-payment="${esc(payment.id)}" data-due-key="${esc(o.key)}" title="Editar último pago" aria-label="Editar último pago de ${esc(o.title)}">${icon("pencil")}</button><button class="btn icon-button danger-icon" data-delete="movements" data-id="${esc(payment.id)}" data-name="${esc(payment.title)}" title="Eliminar último pago" aria-label="Eliminar último pago de ${esc(o.title)}">${icon("trash3")}</button>` : ""}${payment ? evidenceButton(payment.evidencePath) : ""}</div></td></tr>`;
        })
        .join("")
    : emptyRow(
        6,
        "Sin vencimientos en este periodo",
        "Los gastos aparecerán según los días de pago que configures.",
      );
}
function adjustFields() {
  const f = form.elements.frequency.value;
  $("#weekly-fields").hidden = f !== "semanal";
  $("#monthly-fields").hidden = !["mensual", "bimestral", "anual"].includes(f);
  const cycle = ["bimestral", "anual"].includes(f);
  $("#cycle-fields").hidden = !cycle;
  form.elements.cycleMonth.required = cycle;
  $("#cycle-month-label").textContent =
    f === "anual" ? "Mes de pago anual" : "Mes de referencia del ciclo";
  $("#cycle-month-help").textContent =
    f === "anual"
      ? "Un pago cada año en este mes, a partir de la fecha de inicio."
      : "Un pago cada dos meses: enero genera enero, marzo, mayo…; febrero genera febrero, abril, junio… A partir de la fecha de inicio.";
  form.elements.monthDay.required = !$("#monthly-fields").hidden;
  form.elements.halfDay1.required = form.elements.halfDay2.required =
    f === "quincenal";
  $("#half-fields").hidden = f !== "quincenal";
}
function edit(expense) {
  form.reset();
  evidence.reset(expense?.evidencePath);
  clearFormError(form);
  $("#expense-modal-title").textContent = expense
    ? "Editar gasto fijo"
    : "Nuevo gasto fijo";
  const s = expense
    ? scheduleAt(ctx.state.schedules, expense.id, "2100-12-31")
    : null;
  const values = {
    id: expense?.id ?? "",
    title: expense?.title ?? "",
    description: expense?.description ?? "",
    amount: (s?.amountCents ?? 0) / 100,
    frequency: s?.frequency ?? "mensual",
    startDate: expense?.startDate ?? today(),
    effectiveDate: s?.effectiveDate > today() ? s.effectiveDate : today(),
    weekDay: s?.weekDay ?? 1,
    monthDay: s?.monthDay ?? 1,
    cycleMonth: s?.cycleMonth ?? Number(today().slice(5, 7)),
    halfDay1: s?.halfDay1 ?? 1,
    halfDay2: s?.halfDay2 ?? 16,
  };
  for (const [k, v] of Object.entries(values)) form.elements[k].value = v;
  setCategory(form, expense?.category ?? "");
  form.elements.active.checked = s?.active !== 0;
  $("#start-field").hidden = !!expense;
  $("#effective-field").hidden = !expense;
  form.elements.startDate.required = !expense;
  form.elements.effectiveDate.required = !!expense;
  form.elements.effectiveDate.min =
    expense?.startDate > today() ? expense.startDate : today();
  adjustFields();
  modal("expense-modal").show();
}
try {
  ctx = await initPage("gastos-fijos", "Gastos fijos");
  const alertDate = new URLSearchParams(location.search).get("vence");
  $("#anchor").value =
    /^\d{4}-\d{2}-\d{2}$/.test(alertDate || "") && !isNaN(Date.parse(alertDate))
      ? alertDate
      : today();
  const tooltips = [
    ...document.querySelectorAll('[data-bs-toggle="tooltip"]'),
  ].map(
    (el) =>
      new bootstrap.Tooltip(el, {
        trigger: "hover focus",
        container: "#expense-modal",
      }),
  );
  $("#expense-modal").addEventListener("hide.bs.modal", () =>
    tooltips.forEach((tooltip) => tooltip.hide()),
  );
  const openPayment = payments(ctx, render);
  render();
  setupDeletion(ctx, render);
  document.addEventListener("control:updated", render);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-new-expense]");
    if (button && !button.disabled && ctx.admin) edit(null);
  });
  ["search", "frequency", "expense-status", "period", "anchor"].forEach((id) =>
    $("#" + id).addEventListener(id === "search" ? "input" : "change", render),
  );
  form.elements.frequency.addEventListener("change", adjustFields);
  $("#expense-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (b && ctx.admin)
      edit(ctx.state.expenses.find((x) => x.id === b.dataset.edit));
  });
  $("#due-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pay]");
    if (b && ctx.admin) openPayment(dueMap.get(b.dataset.pay));
    const editButton = e.target.closest("[data-edit-payment]");
    if (editButton && ctx.admin)
      openPayment(
        dueMap.get(editButton.dataset.dueKey),
        ctx.state.movements.find(
          (m) => m.id === editButton.dataset.editPayment,
        ),
      );
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await submitForm(form, async () => {
      assertAdmin(ctx);
      const f = form.elements;
      await evidence.save((evidencePath) =>
        saveExpense({
          id: f.id.value || undefined,
          title: f.title.value.trim(),
          description: f.description.value,
          category: readCategory(form),
          amountCents: cents(f.amount.value),
          frequency: f.frequency.value,
          startDate: f.startDate.value,
          effectiveDate: f.effectiveDate.value,
          weekDay: Number(f.weekDay.value),
          monthDay: Number(f.monthDay.value),
          cycleMonth: Number(f.cycleMonth.value),
          halfDay1: Number(f.halfDay1.value),
          halfDay2: Number(f.halfDay2.value),
          active: f.active.checked,
          evidencePath,
        }),
      );
      await reloadAfterSave(ctx);
      render();
    });
    if (ok) modal("expense-modal").hide();
  });
  $("#export-expenses").addEventListener("click", () =>
    exportCSV("gastos-fijos.csv", [
      [
        "Concepto",
        "Categoría",
        "Periodicidad",
        "Calendario de pago",
        "Importe vigente MXN",
        "Desde",
        "Activo",
        "Estado del periodo",
        "Evidencia",
      ],
      ...filtered.map((e) => {
        const s = currentSchedule(e);
        return [
          e.title,
          e.category,
          s.frequency,
          scheduleLabel(s),
          s.amountCents / 100,
          e.startDate,
          s.active ? "Sí" : "No",
          expenseStatus(e),
          e.evidencePath ? "Sí" : "No",
        ];
      }),
    ]),
  );
} catch (error) {
  pageError(error);
}
