const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function text(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Problem(400, `Revisa ${label}.`);
  return value.trim();
}
function profileInput(p, creating) {
  const name = text(p.name, "el nombre", 120);
  const email = text(p.email, "el correo", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Problem(400, "El correo no es válido.");
  if (!["admin", "consulta"].includes(p.role) || typeof p.active !== "boolean")
    throw new Problem(400, "Revisa el rol y el estado del usuario.");
  const password = p.password ?? "";
  if (
    typeof password !== "string" ||
    ((creating || password !== "") &&
      (password.length < 8 ||
        new TextEncoder().encode(password).length > 72 ||
        !password.trim()))
  )
    throw new Problem(
      400,
      "La contraseña necesita al menos 8 caracteres y un máximo de 72 bytes.",
    );
  if (p.removeImage !== undefined && typeof p.removeImage !== "boolean")
    throw new Problem(400, "Revisa la foto.");
  return { name, email, role: p.role, active: p.active, password };
}
async function multipart(request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new Problem(400, "La solicitud no tiene el formato esperado.");
  const chunks = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (!reader) throw new Problem(400, "La solicitud está vacía.");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 3 * 1024 * 1024) {
      await reader.cancel();
      throw new Problem(413, "La imagen es demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let form;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: bytes,
    }).formData();
  } catch {
    throw new Problem(400, "No se pudo leer el formulario.");
  }
  let payload;
  try {
    const raw = form.get("payload");
    if (typeof raw !== "string" || raw.length > 8192) throw new Error();
    payload = JSON.parse(raw);
  } catch {
    throw new Problem(400, "Revisa los datos del formulario.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Problem(400, "Revisa los datos.");
  const file = form.get("image");
  return {
    payload,
    file: file && typeof file !== "string" && file.size ? file : null,
  };
}
async function imageBytes(file) {
  if (!file) return null;
  if (file.size > 2097152)
    throw new Problem(413, "La imagen debe pesar como máximo 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const mime = png
    ? "image/png"
    : jpg
      ? "image/jpeg"
      : webp
        ? "image/webp"
        : null;
  if (!mime || mime !== file.type)
    throw new Problem(400, "Usa una imagen PNG, JPG o WEBP válida.");
  return { bytes, mime, ext: png ? "png" : jpg ? "jpg" : "webp" };
}
function apiProblem(error, fallback) {
  if (["email_exists", "user_already_exists"].includes(error?.code))
    return new Problem(409, "Ese correo ya está registrado.");
  if (error?.code === "weak_password")
    return new Problem(
      400,
      "La contraseña no cumple las reglas de Supabase Auth.",
    );
  if (error?.code === "42501")
    return new Problem(
      403,
      "Tu cuenta ya no tiene permisos para administrar usuarios.",
    );
  if (error?.code === "23505")
    return new Problem(409, "Ese correo ya está registrado.");
  return new Problem(502, fallback);
}
export function createAdminHandler(db, sdkCors = {}) {
  const headers = {
    ...cors,
    ...sdkCors,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (status, body) =>
    new Response(JSON.stringify(body), { status, headers });
  const removeFile = async (bucket, path) => {
    if (path)
      try {
        await db.storage.from(bucket).remove([path]);
      } catch {
        /* archivo sin uso; nunca afecta los registros */
      }
  };
  const apply = async (actor, id, p, path) => {
    const { error } = await db.rpc("control_admin_apply_profile", {
      p_actor: actor,
      p_id: id,
      p_email: p.email,
      p_name: p.name,
      p_role: p.role,
      p_active: p.active,
      p_avatar_path: path ?? null,
    });
    if (error)
      throw apiProblem(
        error,
        "No se pudo guardar el perfil. Revisa la migración 03 en Supabase.",
      );
  };
  const upload = async (bucket, folder, image) => {
    if (!image) return null;
    const path = `${folder}/${crypto.randomUUID()}.${image.ext}`;
    const { error } = await db.storage
      .from(bucket)
      .upload(path, image.bytes, { contentType: image.mime, upsert: false });
    if (error)
      throw new Problem(
        502,
        "No se pudo subir la imagen. Revisa los depósitos de Storage del SQL 03.",
      );
    return path;
  };
  return async (request) => {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { error: "Usa el formulario del sistema." });
    try {
      const bearer = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!bearer) throw new Problem(401, "Inicia sesión para continuar.");
      const { data: verified, error: tokenError } =
        await db.auth.getUser(bearer);
      if (tokenError || !verified?.user)
        throw new Problem(
          401,
          "La sesión no es válida. Inicia sesión nuevamente.",
        );
      const { data: actor, error: actorError } = await db
        .from("control_profiles")
        .select("*")
        .eq("id", verified.user.id)
        .single();
      if (actorError)
        throw new Problem(503, "No se pudo comprobar el perfil administrador.");
      if (!actor?.active || actor.role !== "admin")
        throw new Problem(
          403,
          "Solo un administrador activo puede administrar cuentas.",
        );
      if (!("avatar_path" in actor))
        throw new Problem(
          503,
          "Ejecuta database/03_usuarios_fotos_y_marca.sql para activar esta función.",
        );
      const { payload: p, file } = await multipart(request);
      if (!["create", "update", "delete", "branding"].includes(p.action))
        throw new Problem(400, "La acción no es válida.");
      const image = await imageBytes(file);
      if (p.action === "branding") {
        const name = text(p.name, "el nombre de la empresa", 60);
        if (p.removeImage !== undefined && typeof p.removeImage !== "boolean")
          throw new Problem(400, "Revisa el logo.");
        const { data: previous, error } = await db
          .from("control_branding")
          .select("name,logo_path")
          .eq("id", true)
          .single();
        if (error)
          throw new Problem(503, "Ejecuta el SQL 03 para activar la marca.");
        const fresh = await upload("control-branding", "brand", image);
        const path = fresh ?? (p.removeImage ? null : previous.logo_path);
        const saved = await db.rpc("control_admin_apply_brand", {
          p_actor: actor.id,
          p_name: name,
          p_logo_path: path,
        });
        if (saved.error) {
          await removeFile("control-branding", fresh);
          throw apiProblem(saved.error, "No se pudo guardar la marca.");
        }
        if (previous.logo_path !== path)
          await removeFile("control-branding", previous.logo_path);
        return reply(200, { ok: true });
      }
      if (p.action === "create") {
        const input = profileInput(p, true);
        const result = await db.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: { name: input.name },
        });
        if (result.error || !result.data?.user)
          throw apiProblem(
            result.error,
            "No se pudo crear la cuenta en Supabase Auth.",
          );
        const id = result.data.user.id;
        let fresh = null;
        try {
          fresh = await upload("control-avatars", id, image);
          await apply(actor.id, id, input, fresh);
        } catch (error) {
          const undone = await db.auth.admin.deleteUser(id);
          if (undone.error)
            throw new Problem(
              502,
              "La cuenta se creó, pero no se pudo completar la operación. Actualiza la lista antes de reintentar.",
            );
          await removeFile("control-avatars", fresh);
          throw error;
        }
        return reply(201, { ok: true, id });
      }
      if (!uuid.test(p.id ?? ""))
        throw new Problem(400, "El usuario no es válido.");
      const { data: target, error: targetError } = await db
        .from("control_profiles")
        .select("*")
        .eq("id", p.id)
        .single();
      if (targetError || !target)
        throw new Problem(404, "El usuario ya no existe.");
      if (p.action === "delete") {
        if (file) throw new Problem(400, "Revisa la solicitud de eliminación.");
        if (target.id === actor.id)
          throw new Problem(
            403,
            "No puedes eliminar la cuenta con la que estás trabajando.",
          );
        await apply(
          actor.id,
          target.id,
          { ...target, active: false },
          target.avatar_path,
        );
        const deleted = await db.auth.admin.deleteUser(target.id);
        if (deleted.error) {
          try {
            await apply(actor.id, target.id, target, target.avatar_path);
          } catch {
            throw new Problem(
              502,
              "No se pudo confirmar la eliminación ni restaurar el perfil. Actualiza la lista para revisar su estado.",
            );
          }
          throw apiProblem(
            deleted.error,
            "No se pudo eliminar la cuenta. Sus datos se conservan.",
          );
        }
        await removeFile("control-avatars", target.avatar_path);
        return reply(200, { ok: true });
      }
      const input = profileInput(p, false);
      if (target.id === actor.id && (!input.active || input.role !== "admin"))
        throw new Problem(
          403,
          "Tu propia cuenta conserva acceso de administrador.",
        );
      const fresh = await upload("control-avatars", target.id, image);
      const path = fresh ?? (p.removeImage ? null : target.avatar_path);
      try {
        await apply(actor.id, target.id, input, path);
      } catch (error) {
        await removeFile("control-avatars", fresh);
        throw error;
      }
      const attributes = {
        email: input.email,
        email_confirm: true,
        user_metadata: { name: input.name },
      };
      if (input.password) attributes.password = input.password;
      const updated = await db.auth.admin.updateUserById(target.id, attributes);
      if (updated.error) {
        try {
          await apply(actor.id, target.id, target, target.avatar_path);
        } catch {
          throw new Problem(
            502,
            "No se pudo actualizar Auth; el perfil tuvo cambios. Actualiza la lista para revisarlo.",
          );
        }
        await removeFile("control-avatars", fresh);
        throw apiProblem(
          updated.error,
          "No se pudo confirmar el cambio de correo o contraseña. Actualiza la lista antes de reintentar.",
        );
      }
      if (target.avatar_path !== path)
        await removeFile("control-avatars", target.avatar_path);
      return reply(200, { ok: true, id: target.id });
    } catch (error) {
      return reply(error instanceof Problem ? error.status : 500, {
        error:
          error instanceof Problem
            ? error.message
            : "No se pudo completar la operación. Actualiza la lista antes de reintentar.",
      });
    }
  };
}
