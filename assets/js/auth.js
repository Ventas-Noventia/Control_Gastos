import { getClient } from "./supabase-client.js?v=20261002-noventia-v6";
const safePages = [
  "pendientes.html",
  "gastos-fijos.html",
  "ingresos.html",
  "cuadre.html",
  "usuarios.html",
  "marca.html",
];
export function nextPage() {
  const value = new URLSearchParams(location.search).get("next");
  return safePages.includes(value) ? value : "pendientes.html";
}
export async function currentProfile() {
  const db = getClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const result = await db
    .from("control_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (result.error)
    throw new Error(
      "No se pudo cargar tu perfil. Comprueba que ejecutaste el SQL de configuración.",
    );
  if (!result.data.active)
    throw new Error(
      "Tu cuenta está desactivada o pendiente de autorización. Contacta al administrador.",
    );
  if (!["admin", "consulta"].includes(result.data.role))
    throw new Error("Esta cuenta no tiene un rol válido.");
  return result.data;
}
export async function requireProfile(adminOnly = false) {
  const profile = await currentProfile();
  if (!profile) {
    const filename = location.pathname.split("/").pop();
    location.replace(
      `login.html?next=${encodeURIComponent(safePages.includes(filename) ? filename : "pendientes.html")}`,
    );
    throw new Error("Inicia sesión para continuar.");
  }
  if (adminOnly && profile.role !== "admin")
    throw new Error("Esta página requiere permisos de administrador.");
  getClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.replace("login.html");
  });
  return profile;
}
export async function signIn(email, password) {
  const db = getClient();
  const { error } = await db.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error)
    throw new Error(
      error.code === "email_not_confirmed"
        ? "Confirma tu correo antes de iniciar sesión."
        : "No se pudo ingresar. Revisa el correo, la contraseña y la conexión.",
    );
  try {
    return await currentProfile();
  } catch (error) {
    await db.auth.signOut();
    throw error;
  }
}
export async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw new Error("No se pudo cerrar la sesión. Intenta de nuevo.");
  location.replace("login.html");
}
