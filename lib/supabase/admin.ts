import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role: SALTEA RLS. Solo en el servidor, solo para tareas de sistema
 * (cron, invitaciones, envío de emails). Nunca importarlo desde componentes de cliente.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
