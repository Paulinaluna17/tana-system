/**
 * Puesta en marcha en producción (correr UNA vez, desde tu computadora):
 *   npm run setup:prod                → crea las cuentas de Tana (TANA_ADMIN_EMAILS)
 *   npm run setup:prod -- --borrar-demo → además borra los 4 usuarios de prueba del seed
 *   npm run setup:prod -- --cliente roma roman@gmail.com "Román"  → da acceso a un cliente
 * Lee las variables de .env.local (o del entorno).
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const DEMO = ["socia1@tana.studio", "socia2@tana.studio", "roma@ejemplo.com", "laspopas@ejemplo.com"];

async function ensureUser(email: string, name: string) {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const args = process.argv.slice(2);
  const ci = args.indexOf("--cliente");
  if (ci >= 0) {
    const [slug, email, name = ""] = args.slice(ci + 1);
    const { data: ws } = await admin.from("workspaces").select("id, name").eq("slug", slug).single();
    if (!ws) throw new Error(`No existe el cliente "${slug}"`);
    const id = await ensureUser(email.toLowerCase(), name || email.split("@")[0]);
    await admin.from("memberships").upsert({ user_id: id, workspace_id: ws.id, role: "client_editor" });
    console.log(`✔ ${email} ya tiene acceso a ${ws.name}. Entra en /login con su email.`);
    return;
  }

  const emails = (process.env.TANA_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) {
    const id = await ensureUser(email, email.split("@")[0]);
    await admin.from("profiles").update({ is_tana_admin: true }).eq("id", id);
    console.log(`✔ Admin de Tana: ${email}`);
  }

  if (args.includes("--borrar-demo")) {
    for (const email of DEMO.filter((e) => !emails.includes(e))) {
      const { data: p } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (p) {
        await admin.auth.admin.deleteUser(p.id);
        console.log(`✔ Usuario de prueba borrado: ${email}`);
      }
    }
  } else {
    console.log("\nOjo: los usuarios de prueba del seed (contraseña tana1234) siguen activos. Borralos con: npm run setup:prod -- --borrar-demo");
  }
}

main().catch((e) => {
  console.error("✖", e.message ?? e);
  process.exit(1);
});
