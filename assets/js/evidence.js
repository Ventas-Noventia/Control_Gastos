import { getClient } from "./supabase-client.js?v=20261002-control-v7";
import { currentProfile } from "./auth.js?v=20261002-control-v7";
import { getModal } from "./modal-controller.js?v=20261002-control-v7";

const bucket = "control-evidence";
const validPath = (path) =>
  typeof path === "string" &&
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(path);

export function evidenceButton(path) {
  return validPath(path)
    ? `<button type="button" class="btn btn-sm evidence-button" data-evidence="${path}">Ver evidencia</button>`
    : "";
}

async function validateFile(file) {
  if (!file.size || file.size > 5242880)
    throw new Error("La evidencia debe pesar entre 1 byte y 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const pdf = ascii(0, 5) === "%PDF-";
  const format = png
    ? ["png", "image/png"]
    : jpg
      ? ["jpg", "image/jpeg"]
      : webp
        ? ["webp", "image/webp"]
        : pdf
          ? ["pdf", "application/pdf"]
          : null;
  if (!format)
    throw new Error("Selecciona una imagen PNG, JPG, WEBP o un PDF válido.");
  return format;
}

export function evidenceForm(form) {
  const input = form.querySelector("[data-evidence-input]");
  const current = form.querySelector("[data-evidence-current]");
  const remove = form.querySelector("[data-evidence-remove]");
  let previous = null;
  return {
    reset(path) {
      previous = path || null;
      input.value = "";
      remove.checked = false;
      current.hidden = !validPath(previous);
      current.querySelector("[data-evidence]").dataset.evidence =
        previous || "";
    },
    async save(operation) {
      const file = input.files[0];
      let uploaded = null;
      let path = remove.checked ? null : previous;
      if (file) {
        const [extension, contentType] = await validateFile(file);
        const actor = await currentProfile();
        if (!actor || actor.role !== "admin")
          throw new Error(
            "Solo un administrador activo puede adjuntar evidencias.",
          );
        uploaded = `${actor.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await getClient()
          .storage.from(bucket)
          .upload(uploaded, file, {
            contentType,
            upsert: false,
          });
        if (error)
          throw new Error(
            "No se pudo subir la evidencia. Revisa la actualización y la conexión.",
          );
        path = uploaded;
      }
      try {
        const result = await operation(path);
        previous = path;
        return result;
      } catch (error) {
        if (uploaded) {
          try {
            await getClient().storage.from(bucket).remove([uploaded]);
          } catch {
            /* La base impide borrar una evidencia que sí quedó guardada. */
          }
        }
        throw error;
      }
    },
  };
}

let viewerInstalled = false;
export function setupEvidenceViewer() {
  if (viewerInstalled) return;
  viewerInstalled = true;
  let element,
    returnModal,
    request = 0;
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-evidence]");
    if (!button || !validPath(button.dataset.evidence)) return;
    if (!element) {
      element = document.createElement("div");
      element.id = "evidence-modal";
      element.className = "modal fade";
      element.tabIndex = -1;
      element.setAttribute("aria-labelledby", "evidence-title");
      element.innerHTML =
        '<div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="evidence-title">Evidencia</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body evidence-preview" aria-live="polite"></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button></div></div></div>';
      document.body.append(element);
      element.addEventListener("hidden.bs.modal", () => {
        request++;
        const parent = returnModal;
        returnModal = null;
        parent?.show();
      });
    }
    const token = ++request;
    const body = element.querySelector(".modal-body");
    body.textContent = "Cargando evidencia…";
    const parent = button.closest(".modal.show");
    if (parent && parent !== element) {
      returnModal = getModal(parent);
      parent.addEventListener(
        "hidden.bs.modal",
        () => {
          if (token === request) getModal(element).show();
        },
        { once: true },
      );
      returnModal.hide();
    } else getModal(element).show();
    try {
      const path = button.dataset.evidence;
      const { data, error } = await getClient()
        .storage.from(bucket)
        .createSignedUrl(path, 600);
      if (error || !data?.signedUrl)
        throw new Error(
          "No se pudo abrir la evidencia. Revisa tu sesión y vuelve a intentarlo.",
        );
      if (token !== request) return;
      body.replaceChildren();
      if (path.endsWith(".pdf")) {
        const text = document.createElement("p");
        text.textContent =
          "Evidencia en PDF. Puedes abrirla para revisarla o descargarla.";
        body.append(text);
      } else {
        const img = document.createElement("img");
        img.src = data.signedUrl;
        img.alt = "Evidencia adjunta al registro";
        img.addEventListener("error", () => {
          img.hidden = true;
        });
        body.append(img);
      }
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "btn btn-primary mt-3";
      link.textContent = "Abrir archivo";
      body.append(link);
    } catch (error) {
      if (token === request) body.textContent = error.message;
    }
  });
}
