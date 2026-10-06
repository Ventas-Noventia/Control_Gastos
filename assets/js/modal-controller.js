// Bootstrap espera a que termine la animación antes de permitir hide().
// Guarda el cierre solicitado durante la apertura, sin usar propiedades privadas.
const controllers = new WeakMap();
export function getModal(element) {
  if (controllers.has(element)) return controllers.get(element);
  const instance = bootstrap.Modal.getOrCreateInstance(element);
  const hide = instance.hide.bind(instance);
  let opening = false,
    pendingClose = false;
  element.addEventListener("show.bs.modal", () => {
    opening = true;
  });
  element.addEventListener("shown.bs.modal", () => {
    opening = false;
    if (pendingClose) {
      pendingClose = false;
      hide();
    }
  });
  element.addEventListener("hidden.bs.modal", () => {
    opening = false;
    pendingClose = false;
  });
  instance.hide = () => {
    if (opening) pendingClose = true;
    else hide();
  };
  controllers.set(element, instance);
  return instance;
}
