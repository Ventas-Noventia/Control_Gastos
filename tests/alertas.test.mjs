import assert from "node:assert/strict";
import { attentionItems } from "../assets/js/dashboard-details.js";
const task = (id, dueDate, extra = {}) => ({
  id,
  title: id,
  category: "Otros",
  amountCents: 0,
  dueDate,
  priority: "media",
  status: "pendiente",
  deletedAt: null,
  ...extra,
});
const state = {
  tasks: [
    task("vencido", "2026-10-05"),
    task("hoy", "2026-10-06"),
    task("pronto", "2026-10-13"),
    task("fuera", "2026-10-14"),
    task("terminado", "2026-10-06", { status: "completado" }),
    task("borrado", "2026-10-06", { deletedAt: "now" }),
    task("pagado", "2026-10-06", { amountCents: 1000 }),
    task("parcial", "2026-10-07", { amountCents: 1000 }),
  ],
  expenses: [],
  schedules: [],
  movements: [
    {
      kind: "egreso",
      sourceType: "pendiente",
      sourceId: "pagado",
      amountCents: 1000,
      date: "2026-10-06",
    },
    {
      kind: "egreso",
      sourceType: "pendiente",
      sourceId: "parcial",
      amountCents: 500,
      date: "2026-10-06",
    },
  ],
};
const list = attentionItems(state, "pendiente", "2026-10-06");
assert.deepEqual(
  list.map((o) => o.sourceId),
  ["vencido", "hoy", "parcial", "pronto"],
);
assert.deepEqual(
  list.map((o) => o.urgency),
  ["Vencido", "Vence hoy", "Por vencer", "Por vencer"],
);
assert.equal(list.find((o) => o.sourceId === "parcial").remainingCents, 500);
assert.equal(attentionItems(state, "fijo", "2026-10-06").length, 0);
const fixed = {
  ...state,
  tasks: [],
  expenses: [
    {
      id: "luz",
      title: "Luz",
      category: "Luz",
      startDate: "2026-10-01",
      deletedAt: null,
    },
  ],
  schedules: [
    {
      expenseId: "luz",
      effectiveDate: "2026-10-01",
      frequency: "bimestral",
      cycleMonth: 10,
      monthDay: 10,
      amountCents: 10000,
      active: 1,
    },
  ],
  movements: [],
};
assert.equal(
  attentionItems(fixed, "fijo", "2026-10-06")[0].dueDate,
  "2026-10-10",
);
assert.equal(
  attentionItems(
    {
      ...fixed,
      movements: [
        {
          kind: "egreso",
          sourceType: "fijo",
          sourceId: "luz",
          dueDate: "2026-10-10",
          amountCents: 10000,
          date: "2026-10-06",
        },
      ],
    },
    "fijo",
    "2026-10-06",
  ).length,
  0,
);
assert.equal(
  attentionItems(
    {
      ...fixed,
      movements: [
        {
          kind: "egreso",
          sourceType: "fijo",
          sourceId: "luz",
          dueDate: "2026-10-10",
          amountCents: 10000,
          date: "2026-10-11",
        },
      ],
    },
    "fijo",
    "2026-10-06",
  ).length,
  1,
  "Un pago posterior a hoy no oculta la alerta actual",
);
assert.equal(
  attentionItems(
    { ...fixed, schedules: [{ ...fixed.schedules[0], active: 0 }] },
    "fijo",
    "2026-10-06",
  ).length,
  0,
);
assert.equal(
  attentionItems(
    { ...fixed, expenses: [{ ...fixed.expenses[0], deletedAt: "2026-10-05" }] },
    "fijo",
    "2026-10-06",
  ).length,
  0,
);
assert.equal(
  attentionItems(fixed, "fijo", "2026-12-06")[1].dueDate,
  "2026-12-10",
);
console.log(
  "Alerts passed: overdue/today/7-day boundary, free tasks, partial/total payments, deleted/completed/paused exclusions, cutoff and bimonthly recurrence.",
);
