import { getClient } from "./supabase-client.js?v=20261002-control-v7";

export async function adminAction(payload, image = null) {
  const client = getClient();
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError || !session)
    throw new Error("Inicia sesión nuevamente para administrar cuentas.");
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  if (image) body.append("image", image);
  const { data, error } = await client.functions.invoke("control-admin", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let message;
    if (error.context?.json) {
      try {
        message = (await error.context.json()).error;
      } catch {
        /* respuesta de red */
      }
    }
    throw new Error(
      message ||
        "No se pudo conectar con la gestión de usuarios. Activa la función control-admin según ACTUALIZACION_USUARIOS_Y_MARCA.md.",
    );
  }
  if (!data?.ok)
    throw new Error(data?.error || "No se pudo completar la operación.");
  return data;
}
export function validateImage(file) {
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Usa una imagen PNG, JPG o WEBP.");
  if (file.size > 2097152)
    throw new Error("La imagen debe pesar como máximo 2 MB.");
}
