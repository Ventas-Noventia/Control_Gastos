import assert from "node:assert/strict";
import {
  obligations,
  reconcile,
  periodRange,
  isDate,
} from "../assets/js/finanzas.js";
const base = {
  actor: {
    email: "test@example.com",
    name: "Test",
    role: "admin",
    owner: true,
  },
  tasks: [],
  expenses: [],
  schedules: [],
  movements: [],
  users: [],
};
const expense = {
  id: "fixed",
  title: "Renta",
  category: "Servicios",
  description: "",
  startDate: "2026-01-01",
  updatedAt: "",
  deletedAt: null,
};
const schedule = {
  id: "s1",
  expenseId: "fixed",
  effectiveDate: "2026-01-01",
  amountCents: 10000,
  frequency: "mensual",
  weekDay: 1,
  monthDay: 31,
  halfDay1: 1,
  halfDay2: 31,
  active: 1,
};
const fixed = { ...base, expenses: [expense], schedules: [schedule] };
assert.equal(isDate("2026-02-30"), false);
assert.deepEqual(periodRange("quincena", "2026-02-28"), {
  from: "2026-02-16",
  to: "2026-02-28",
});
assert.deepEqual(periodRange("semana", "2026-10-01"), {
  from: "2026-09-28",
  to: "2026-10-04",
});
assert.equal(
  obligations(fixed, "2026-02-01", "2026-02-28")[0].dueDate,
  "2026-02-28",
);
assert.equal(
  obligations(fixed, "2028-02-01", "2028-02-29")[0].dueDate,
  "2028-02-29",
);
assert.deepEqual(
  obligations(
    { ...fixed, schedules: [{ ...schedule, frequency: "quincenal" }] },
    "2026-02-01",
    "2026-02-28",
  ).map((o) => o.dueDate),
  ["2026-02-01", "2026-02-28"],
);
assert.deepEqual(
  obligations(
    { ...fixed, schedules: [{ ...schedule, frequency: "semanal" }] },
    "2026-10-01",
    "2026-10-31",
  ).map((o) => o.dueDate),
  ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"],
);
const revised = {
  ...fixed,
  schedules: [
    schedule,
    { ...schedule, id: "s2", effectiveDate: "2026-10-01", amountCents: 15000 },
  ],
};
assert.deepEqual(
  obligations(revised, "2026-09-01", "2026-10-31").map((o) => o.amountCents),
  [10000, 15000],
);
assert.equal(
  obligations(
    { ...fixed, expenses: [{ ...expense, deletedAt: "2026-10-01" }] },
    "2026-09-01",
    "2026-10-31",
  ).length,
  1,
);
assert.equal(
  obligations(
    {
      ...fixed,
      schedules: [
        schedule,
        { ...schedule, id: "paused", effectiveDate: "2026-10-01", active: 0 },
      ],
    },
    "2026-09-01",
    "2026-10-31",
  ).length,
  1,
);
const task = {
  id: "t1",
  title: "Laptop",
  category: "Tecnología",
  description: "",
  amountCents: 30000,
  dueDate: "2026-09-15",
  priority: "media",
  status: "pendiente",
  linksJson: "[]",
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};
const movement = (id, kind, amountCents, date, extra = {}) => ({
  id,
  kind,
  amountCents,
  date,
  title: "Movimiento",
  category: "Servicios",
  sourceType: "manual",
  sourceId: null,
  dueDate: null,
  note: "",
  recordedBy: "test",
  deletedAt: null,
  singletonKey: null,
  ...extra,
});
const pay = movement("p1", "egreso", 10000, "2026-10-01", {
  sourceType: "pendiente",
  sourceId: "t1",
});
const cash = {
  ...base,
  tasks: [task],
  movements: [
    movement("open", "saldo_inicial", 50000, "2026-09-01"),
    movement("in", "ingreso", 20000, "2026-09-10"),
    pay,
  ],
};
assert.equal(
  reconcile(cash, "2026-09-01", "2026-09-30").remaining,
  30000,
  "Payment after cutoff must not change historical remaining",
);
const october = reconcile(cash, "2026-10-01", "2026-10-31");
assert.equal(october.opening, 70000);
assert.equal(october.closing, 60000);
assert.equal(october.incomes, 0);
assert.equal(october.payments, 10000);
assert.equal(
  obligations(cash, "2026-09-01", "2026-10-31")[0].remainingCents,
  20000,
);
assert.equal(
  obligations(
    {
      ...cash,
      movements: cash.movements.map((m) =>
        m.id === "p1" ? { ...m, deletedAt: "now" } : m,
      ),
    },
    "2026-09-01",
    "2026-10-31",
  )[0].remainingCents,
  30000,
);
const zero = obligations(
  { ...base, tasks: [{ ...task, amountCents: 0, dueDate: "2099-01-01" }] },
  "2099-01-01",
  "2099-01-01",
)[0];
assert.equal(zero.status, "Pendiente");
const completed = obligations(
  { ...base, tasks: [{ ...task, amountCents: 0, status: "completado" }] },
  "2026-09-01",
  "2026-09-30",
)[0];
assert.equal(completed.status, "Completado");
assert.equal(
  reconcile(
    {
      ...base,
      movements: [movement("c", "saldo_inicial", -10000, "2026-01-01")],
    },
    "2026-01-01",
    "2026-01-31",
  ).closing,
  -10000,
);
console.log(
  "Finance checks passed: recurrence, leap years, cost history, cutoff, carry-forward, partial payments and reversal.",
);

// Los ciclos largos respetan mes, inicio, años bisiestos y versiones históricas.
const longCycle = (frequency, cycleMonth, extra = {}) => ({
  ...fixed,
  schedules: [{ ...schedule, frequency, cycleMonth, ...extra }],
});
assert.deepEqual(
  obligations(longCycle("bimestral", 11), "2026-11-01", "2027-04-30").map(
    (o) => o.dueDate,
  ),
  ["2026-11-30", "2027-01-31", "2027-03-31"],
);
assert.deepEqual(
  obligations(longCycle("bimestral", 2), "2026-01-01", "2026-06-30").map(
    (o) => o.dueDate,
  ),
  ["2026-02-28", "2026-04-30", "2026-06-30"],
);
assert.deepEqual(
  obligations(longCycle("anual", 2), "2026-01-01", "2028-12-31").map(
    (o) => o.dueDate,
  ),
  ["2026-02-28", "2027-02-28", "2028-02-29"],
);
assert.equal(
  obligations(
    {
      ...longCycle("anual", 2),
      expenses: [{ ...expense, startDate: "2026-03-01" }],
    },
    "2026-01-01",
    "2026-12-31",
  ).length,
  0,
);
assert.deepEqual(
  obligations(
    {
      ...fixed,
      schedules: [
        schedule,
        {
          ...schedule,
          id: "s3",
          effectiveDate: "2026-04-01",
          frequency: "bimestral",
          cycleMonth: 5,
          amountCents: 20000,
        },
      ],
    },
    "2026-01-01",
    "2026-08-31",
  ).map((o) => [o.dueDate, o.amountCents]),
  [
    ["2026-01-31", 10000],
    ["2026-02-28", 10000],
    ["2026-03-31", 10000],
    ["2026-05-31", 20000],
    ["2026-07-31", 20000],
  ],
);
assert.deepEqual(periodRange("bimestre", "2028-02-14"), {
  from: "2028-01-01",
  to: "2028-02-29",
});
assert.deepEqual(periodRange("bimestre", "2026-12-14"), {
  from: "2026-11-01",
  to: "2026-12-31",
});
assert.deepEqual(periodRange("anio", "2026-06-14"), {
  from: "2026-01-01",
  to: "2026-12-31",
});
const yearly = longCycle("anual", 2);
assert.equal(
  reconcile(
    {
      ...yearly,
      movements: [
        movement("annual", "egreso", 4000, "2026-03-01", {
          sourceType: "fijo",
          sourceId: "fixed",
          dueDate: "2026-02-28",
        }),
      ],
    },
    "2026-01-01",
    "2026-12-31",
  ).remaining,
  6000,
);
assert.equal(
  reconcile(
    {
      ...yearly,
      movements: [
        movement("annual", "egreso", 4000, "2026-03-01", {
          sourceType: "fijo",
          sourceId: "fixed",
          dueDate: "2026-02-28",
        }),
      ],
    },
    "2026-01-01",
    "2026-02-28",
  ).remaining,
  10000,
);
console.log(
  "Long-cycle checks passed: bimonthly, annual, leap days, start cutoff, cost history, payments and period ranges.",
);
