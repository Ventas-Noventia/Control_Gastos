import {
  initPage,
  $,
  esc,
  icon,
  setStats,
  exportCSV,
  emptyRow,
  setupDeletion,
  rowActions,
  pageError,
} from "./ui.js?v=20261001-menu-superior-v4";
import { setupMovementForm } from "./movimiento-form.js?v=20261001-menu-superior-v4";
import { money, today, dateLabel, periodRange } from "./finanzas.js?v=20261001-menu-superior-v4";
let ctx,
  filtered = [];
const month = periodRange("mes", today());
function render() {
  const incomes = ctx.state.movements.filter((m) => m.kind === "ingreso"),
    q = $("#search").value.trim().toLowerCase(),
    from = $("#from").value,
    to = $("#to").value;
  filtered = incomes
    .filter(
      (m) =>
        m.date >= from &&
        m.date <= to &&
        (m.title + " " + m.category + " " + m.note).toLowerCase().includes(q),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const current = incomes.filter(
    (m) => m.date >= month.from && m.date <= month.to,
  );
  setStats([
    {
      label: "Ingresos del mes",
      value: money(current.reduce((s, m) => s + m.amountCents, 0)),
      detail: `${dateLabel(month.from)} — ${dateLabel(month.to)}`,
      icon: "wallet2",
      accent: true,
    },
    {
      label: "Entradas del mes",
      value: current.length,
      detail: "Movimientos registrados",
      icon: "receipt",
    },
    {
      label: "Total de la consulta",
      value: money(filtered.reduce((s, m) => s + m.amountCents, 0)),
      detail: `${filtered.length} ingresos en el rango seleccionado`,
      icon: "arrow-down-left",
    },
  ]);
  $("#to").min = from;
  $("#income-rows").innerHTML = filtered.length
    ? filtered
        .map(
          (m) =>
            `<tr><td><div class="item-title"><span class="category-icon income-icon">${icon("arrow-down-left")}</span><div><strong>${esc(m.title)}</strong><small>${esc(m.category)}</small></div></div></td><td>${dateLabel(m.date)}</td><td><strong class="income-amount">+${money(m.amountCents)}</strong></td><td><span class="table-notes">${esc(m.note || "—")}</span></td><td>${ctx.admin ? rowActions("movements", m) : "—"}</td></tr>`,
        )
        .join("")
    : emptyRow(
        5,
        "Sin ingresos en esta consulta",
        "Los ingresos registrados aparecerán aquí con su fecha.",
      );
}
try {
  ctx = await initPage("ingresos", "Ingresos");
  $("#from").value = month.from;
  $("#to").value = month.to;
  const edit = setupMovementForm(ctx, render);
  render();
  setupDeletion(ctx, render);
  document.addEventListener("control:updated", render);
  $("#new-income").addEventListener("click", () => {
    if (ctx.admin) edit(null);
  });
  ["search", "from", "to"].forEach((id) =>
    $("#" + id).addEventListener(id === "search" ? "input" : "change", render),
  );
  $("#income-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (b && ctx.admin)
      edit(ctx.state.movements.find((m) => m.id === b.dataset.edit));
  });
  $("#export-incomes").addEventListener("click", () =>
    exportCSV(`ingresos-${$("#from").value}-${$("#to").value}.csv`, [
      [
        "Concepto",
        "Categoría",
        "Fecha",
        "Importe MXN",
        "Notas",
        "Registrado por",
      ],
      ...filtered.map((m) => [
        m.title,
        m.category,
        m.date,
        m.amountCents / 100,
        m.note,
        m.recordedBy,
      ]),
    ]),
  );
} catch (error) {
  pageError(error);
}
