import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
let instance;
export function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Falta configurar Supabase. Abre assets/js/config.js y agrega la URL y la clave pública de tu proyecto. Sigue el archivo LEEME.md.",
    );
  }
  const parsed = new URL(SUPABASE_URL);
  if (
    parsed.protocol !== "https:" ||
    /service_role|sb_secret_/.test(SUPABASE_ANON_KEY)
  ) {
    throw new Error(
      "Usa la URL HTTPS y la clave pública publishable o anon de Supabase.",
    );
  }
  if (!globalThis.supabase?.createClient)
    throw new Error(
      "No se pudo cargar Supabase. Comprueba tu conexión a internet y recarga la página.",
    );
  if (!instance)
    instance = globalThis.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  return instance;
}
