import "server-only";
import { createAdminClient } from "./supabase/admin";

/** Si el email está en TANA_ADMIN_EMAILS, se asegura de que el perfil sea admin de Tana. */
export async function promoteIfTanaAdmin(userId: string, email: string | undefined | null) {
  const list = (process.env.TANA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !list.includes(email.toLowerCase())) return;
  const admin = createAdminClient();
  await admin.from("profiles").upsert({ id: userId, email, is_tana_admin: true }, { onConflict: "id" });
}
