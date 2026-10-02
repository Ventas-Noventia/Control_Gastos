import { getClient } from "./supabase-client.js?v=20261002-noventia-v6";

export const DEFAULT_LOGO = new URL("../img/noventia-logo.png", import.meta.url)
  .href;

// The original PNG stays intact; its transparent margins are handled by CSS.
export function renderLogo(image, url, name, bundled = false) {
  const window = image.closest(".logo-window");
  const brand = image.closest(".brand");
  image.hidden = !url;
  if (window) {
    window.hidden = !url;
    window.classList.toggle("uses-original", bundled);
  }
  brand?.classList.toggle("has-logo", !!url);
  image.alt = name;
  image.onerror = () => {
    if (!bundled) renderLogo(image, DEFAULT_LOGO, name, true);
    else {
      image.hidden = true;
      if (window) window.hidden = true;
      brand?.classList.remove("has-logo");
    }
  };
  if (url) image.src = url;
  else image.removeAttribute("src");
}
export async function loadBrand() {
  let brand = {
    name: "Noventia",
    logo_path: null,
    logoUrl: DEFAULT_LOGO,
    bundledLogo: true,
  };
  try {
    const { data, error } = await getClient()
      .from("control_branding")
      .select("name,logo_path")
      .eq("id", true)
      .single();
    if (!error && data) brand = { ...brand, ...data };
    if (brand.logo_path) {
      brand.logoUrl = getClient()
        .storage.from("control-branding")
        .getPublicUrl(brand.logo_path).data.publicUrl;
      brand.bundledLogo = false;
    }
  } catch {
    /* el logo incluido también funciona sin la configuración de marca */
  }
  document.querySelectorAll("[data-brand-name]").forEach((node) => {
    node.textContent = brand.name;
  });
  document
    .querySelectorAll("[data-brand-logo]")
    .forEach((image) =>
      renderLogo(image, brand.logoUrl, brand.name, brand.bundledLogo),
    );
  return brand;
}
