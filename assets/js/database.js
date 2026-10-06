import { getClient } from "./supabase-client.js?v=20261002-control-v7";
import { currentProfile } from "./auth.js?v=20261002-control-v7";
import { loadAvatars } from "./avatars.js?v=20261002-control-v7";
/** Supabase limita normalmente cada respuesta a 1000 filas: carga todas por páginas. */
async function readAll(table, options = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let query = getClient()
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (options.live) query = query.is("deleted_at", null);
    const { data, error } = await query;
    if (error)
      throw new Error(
        `No se pudo leer ${table}. Verifica el SQL, los permisos y la conexión.`,
      );
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export async function loadState() {
  const actor = await currentProfile();
  if (!actor) throw new Error("La sesión terminó. Inicia sesión otra vez.");
  const [tasks, expenses, schedules, movements, users] = await Promise.all([
    readAll("control_tasks"),
    readAll("control_expenses"),
    readAll("control_schedules"),
    readAll("control_movements", { live: true }),
    actor.role === "admin" ? readAll("control_profiles") : Promise.resolve([]),
  ]);
  await loadAvatars(actor, users);
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    actor,
    users,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      amountCents: Number(t.amount_cents),
      dueDate: t.due_date,
      priority: t.priority,
      status: t.status,
      linksJson: JSON.stringify(t.links),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      createdBy: t.created_by,
      createdByName: t.created_by_name,
      updatedBy: t.updated_by,
      updatedByName: t.updated_by_name,
      completedBy: t.completed_by,
      completedByName: t.completed_by_name,
      completedAt: t.completed_at,
      deletedAt: t.deleted_at,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      startDate: e.start_date,
      updatedAt: e.updated_at,
      deletedAt: e.deleted_at,
      evidencePath: e.evidence_path,
    })),
    schedules: schedules.map((s) => ({
      id: s.id,
      expenseId: s.expense_id,
      effectiveDate: s.effective_date,
      amountCents: Number(s.amount_cents),
      frequency: s.frequency,
      weekDay: s.week_day,
      monthDay: s.month_day,
      halfDay1: s.half_day1,
      halfDay2: s.half_day2,
      active: s.active ? 1 : 0,
    })),
    movements: movements.map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      category: m.category,
      amountCents: Number(m.amount_cents),
      date: m.date,
      sourceType: m.source_type,
      sourceId: m.source_id,
      dueDate: m.due_date,
      note: m.note,
      recordedBy:
        names.get(m.recorded_by) ?? m.recorded_by ?? "Cuenta eliminada",
      deletedAt: m.deleted_at,
      singletonKey: m.singleton_key,
      evidencePath: m.evidence_path,
      createdAt: m.created_at,
    })),
  };
}
export async function taskAuditAvailable() {
  try {
    const { error } = await getClient()
      .from("control_task_activity")
      .select("id")
      .range(0, 0);
    return !error;
  } catch {
    return false;
  }
}
export async function loadTaskActivity(taskId, beforeId = null) {
  const size = 25;
  let query = getClient()
    .from("control_task_activity")
    .select("id,action,actor_name,occurred_at,details")
    .eq("task_id", taskId)
    .order("id", { ascending: false });
  if (beforeId !== null) query = query.lt("id", beforeId);
  const { data, error } = await query.range(0, size);
  if (error) throw new Error("No se pudo cargar la actividad del pendiente.");
  return { entries: data.slice(0, size), hasMore: data.length > size };
}
async function rpc(name, args) {
  const { data, error } = await getClient().rpc(name, args);
  if (error) {
    if (error.code === "42501")
      throw new Error(
        "Solo un administrador activo puede realizar esta operación.",
      );
    if (["23502", "23514", "22P02", "22007", "22008"].includes(error.code))
      throw new Error(
        "Revisa los campos obligatorios, las fechas, los enlaces y el importe.",
      );
    throw new Error(error.message || "No se pudo guardar. Intenta de nuevo.");
  }
  return data;
}
export const saveTask = (p) => rpc("control_save_task", { p_payload: p });
export const saveExpense = (p) => rpc("control_save_expense", { p_payload: p });
export const saveMovement = (p) =>
  rpc("control_save_movement", { p_payload: p });
export const deleteRecord = (table, id) =>
  rpc("control_delete_record", { p_table: table, p_id: id });
export const saveProfile = (p) =>
  rpc("control_manage_profile", {
    p_id: p.id,
    p_name: p.name,
    p_role: p.role,
    p_active: p.active,
  });
