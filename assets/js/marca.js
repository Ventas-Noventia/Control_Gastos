import {
  initPage,
  $,
  clearFormError,
  submitForm,
  pageError,
  assertAdmin,
} from "./ui.js?v=20261002-control-v7";
import {
  adminAction,
  validateImage,
} from "./admin-api.js?v=20261002-control-v7";
import {
  loadBrand,
  DEFAULT_LOGO,
  renderLogo,
} from "./branding.js?v=20261002-control-v7";

const form = $("#brand-form");
let ctx,
  brand,
  previewUrl = null;
function preview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  const file = form.elements.image.files[0];
  if (file) {
    try {
      validateImage(file);
      previewUrl = URL.createObjectURL(file);
    } catch (error) {
      form.elements.image.value = "";
      form.querySelector(".form-error").textContent = error.message;
      form.querySelector(".form-error").hidden = false;
    }
  }
  const url =
    previewUrl ||
    (form.elements.removeImage.checked ? DEFAULT_LOGO : brand.logoUrl);
  const image = $("#brand-preview-image");
  renderLogo(
    image,
    url,
    "Vista previa del logo",
    !previewUrl && (form.elements.removeImage.checked || brand.bundledLogo),
  );
  $("#brand-preview-name").textContent =
    form.elements.name.value.trim() || "Noventia";
}
function fill() {
  form.reset();
  form.elements.name.value = brand.name;
  $("#brand-remove-row").hidden = !brand.logo_path;
  clearFormError(form);
  preview();
}
try {
  ctx = await initPage("marca", "Marca", true);
  brand = await loadBrand();
  fill();
  form.elements.name.addEventListener("input", preview);
  form.elements.image.addEventListener("change", () => {
    form.elements.removeImage.checked = false;
    clearFormError(form);
    preview();
  });
  form.elements.removeImage.addEventListener("change", () => {
    if (form.elements.removeImage.checked) form.elements.image.value = "";
    preview();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitForm(form, async () => {
      assertAdmin(ctx);
      const image = form.elements.image.files[0];
      validateImage(image);
      await adminAction(
        {
          action: "branding",
          name: form.elements.name.value.trim(),
          removeImage: form.elements.removeImage.checked,
        },
        image,
      );
      brand = await loadBrand();
      fill();
    });
  });
  window.addEventListener("pagehide", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
} catch (error) {
  pageError(error);
}
