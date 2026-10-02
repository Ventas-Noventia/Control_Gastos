import { getClient } from "./supabase-client.js?v=20261002-noventia-v6";

export async function loadAvatars(actor, users) {
  const profiles = [actor, ...users];
  const paths = [
    ...new Set(profiles.map((p) => p.avatar_path).filter(Boolean)),
  ];
  if (!paths.length) return;
  try {
    const { data, error } = await getClient()
      .storage.from("control-avatars")
      .createSignedUrls(paths, 3600);
    if (error) return;
    const urls = new Map(
      (data ?? []).filter((p) => !p.error).map((p) => [p.path, p.signedUrl]),
    );
    for (const p of profiles) p.avatarUrl = urls.get(p.avatar_path) ?? null;
  } catch {
    /* las iniciales mantienen visible la identidad si falla Storage */
  }
}
