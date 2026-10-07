import {
  $,
  modal,
  clearFormError,
  submitForm,
  cents,
  reloadAfterSave,
  assertAdmin,
  setCategory,
  readCategory,
} from "./ui.js?v=20261006-alertas-v9";
import { saveMovement } from "./database.js?v=20261005-periodos-v8";
import { today } from "./finanzas.js?v=20261005-periodos-v8";
export function setupMovementForm(ctx, onReload, opening = false) {
  const prefix = opening ? "opening" : "income",
    form = $("#" + prefix + "-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await submitForm(form, async () => {
      assertAdmin(ctx);
      const f = form.elements;
      await saveMovement({
        id: f.id.value,
        kind: opening ? "saldo_inicial" : "ingreso",
        title: opening ? "Saldo inicial" : f.title.value.trim(),
        category: opening ? "Saldo inicial" : readCategory(form),
        amountCents: cents(f.amount.value, opening, opening),
        date: f.date.value,
        note: f.note.value,
      });
      await reloadAfterSave(ctx);
      onReload();
    });
    if (ok) modal(prefix + "-modal").hide();
  });
  return (movement) => {
    form.reset();
    clearFormError(form);
    $("#" + prefix + "-modal-title").textContent = opening
      ? "Saldo inicial"
      : movement
        ? "Editar ingreso"
        : "Registrar ingreso";
    form.elements.id.value = movement?.id ?? crypto.randomUUID();
    form.elements.amount.value = (movement?.amountCents ?? 0) / 100;
    form.elements.date.value = movement?.date ?? today();
    form.elements.date.max = today();
    form.elements.note.value = movement?.note ?? "";
    if (!opening) {
      form.elements.title.value = movement?.title ?? "";
      setCategory(form, movement?.category ?? "");
    }
    modal(prefix + "-modal").show();
  };
}
