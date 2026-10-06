export const categories = [
  "Luz",
  "Agua",
  "Gas",
  "Internet",
  "Telefonía",
  "Cuentas de ChatGPT",
  "Renta bazar",
  "Renta almacén",
  "Renta vivienda",
  "Papelería",
  "Insumos",
  "Mantenimiento",
  "Transporte",
  "Combustible",
  "Seguridad",
  "Impuestos",
  "Seguros",
  "Servicios",
  "Inmuebles",
  "Despensa",
  "Limpieza",
  "Tecnología",
  "Sueldos",
  "Suscripciones",
  "Otros",
];
export const money = (cents) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    cents / 100,
  );
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function addDays(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isDate(date) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !isNaN(Date.parse(date + "T12:00:00Z")) &&
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date
  );
}
export function periodRange(type, anchor) {
  const [year, month, day] = anchor.split("-").map(Number);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (type === "semana") {
    const wd = new Date(anchor + "T12:00:00Z").getUTCDay();
    const from = addDays(anchor, -((wd + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  if (type === "quincena")
    return {
      from: `${prefix}-${day <= 15 ? "01" : "16"}`,
      to: `${prefix}-${day <= 15 ? "15" : String(last)}`,
    };
  return { from: `${prefix}-01`, to: `${prefix}-${last}` };
}
export function scheduleAt(schedules, expenseId, date) {
  return schedules
    .filter((s) => s.expenseId === expenseId && s.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}
export function obligations(state, from, to) {
  const paid = new Map();
  for (const m of state.movements)
    if (!m.deletedAt && m.kind === "egreso" && m.sourceId && m.date <= to) {
      const key = `${m.sourceType}:${m.sourceId}:${m.sourceType === "fijo" ? m.dueDate : ""}`;
      paid.set(key, (paid.get(key) ?? 0) + m.amountCents);
    }
  const out = [];
  const push = (base, completed = false) => {
    const p = paid.get(base.key) ?? 0;
    const r = Math.max(0, base.amountCents - p);
    out.push({
      ...base,
      paidCents: p,
      remainingCents: completed ? 0 : r,
      status: completed
        ? "Completado"
        : r === 0 && base.amountCents > 0
          ? "Pagado"
          : base.dueDate < today()
            ? "Vencido"
            : p > 0
              ? "Pago parcial"
              : base.sourceType === "fijo"
                ? "A tiempo"
                : "Pendiente",
    });
  };
  for (const t of state.tasks)
    if (!t.deletedAt && t.dueDate >= from && t.dueDate <= to)
      push(
        {
          key: `pendiente:${t.id}:`,
          sourceType: "pendiente",
          sourceId: t.id,
          title: t.title,
          category: t.category,
          dueDate: t.dueDate,
          amountCents: t.amountCents,
        },
        t.status === "completado" && t.amountCents === 0,
      );
  for (const e of state.expenses) {
    if (e.startDate > to) continue;
    const versions = state.schedules
      .filter((s) => s.expenseId === e.id)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    for (let i = 0; i < versions.length; i++) {
      const s = versions[i];
      if (!s.active) continue;
      const start = [from, e.startDate, s.effectiveDate].sort().at(-1);
      const end = [
        to,
        ...(versions[i + 1]
          ? [addDays(versions[i + 1].effectiveDate, -1)]
          : []),
        ...(e.deletedAt ? [addDays(e.deletedAt, -1)] : []),
      ].sort()[0];
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const dt = new Date(d + "T12:00:00Z"),
          day = dt.getUTCDate(),
          last = new Date(
            Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0),
          ).getUTCDate();
        const due =
          s.frequency === "semanal"
            ? dt.getUTCDay() === s.weekDay
            : s.frequency === "quincenal"
              ? day === s.halfDay1 || day === Math.min(s.halfDay2, last)
              : day === Math.min(s.monthDay, last);
        if (due)
          push({
            key: `fijo:${e.id}:${d}`,
            sourceType: "fijo",
            sourceId: e.id,
            title: e.title,
            category: e.category,
            dueDate: d,
            amountCents: s.amountCents,
          });
      }
    }
  }
  return out.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title),
  );
}
export function reconcile(state, from, to, category = "todos") {
  const live = state.movements.filter((m) => !m.deletedAt),
    signed = (m) => (m.kind === "egreso" ? -m.amountCents : m.amountCents);
  const opening = live
      .filter((m) => m.date < from)
      .reduce((s, m) => s + signed(m), 0),
    inRange = live.filter((m) => m.date >= from && m.date <= to),
    incomes = inRange
      .filter((m) => m.kind === "ingreso")
      .reduce((s, m) => s + m.amountCents, 0),
    payments = inRange
      .filter((m) => m.kind === "egreso")
      .reduce((s, m) => s + m.amountCents, 0),
    adjustments = inRange
      .filter((m) => m.kind === "saldo_inicial")
      .reduce((s, m) => s + m.amountCents, 0),
    planned = obligations(state, from, to),
    remaining = planned.reduce((s, o) => s + o.remainingCents, 0);
  return {
    from,
    to,
    opening,
    incomes,
    payments,
    adjustments,
    closing: opening + incomes + adjustments - payments,
    planned: planned.reduce((s, o) => s + o.amountCents, 0),
    remaining,
    projected: opening + incomes + adjustments - payments - remaining,
    movements: inRange
      .filter((m) => category === "todos" || m.category === category)
      .sort((a, b) => b.date.localeCompare(a.date)),
    obligations: planned.filter(
      (o) => category === "todos" || o.category === category,
    ),
  };
}
