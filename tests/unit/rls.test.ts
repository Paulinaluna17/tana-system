/**
 * Tests de seguridad (RLS) contra la base local de Supabase con el seed cargado.
 * Correr con `npx supabase start && npx supabase db reset` antes. Se saltean si no hay base local.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const ROMA = "c0000000-0000-4000-8000-000000000001";
const POPAS = "c0000000-0000-4000-8000-000000000002";

let available = false;
async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "tana1234" });
  if (error) throw error;
  return c;
}

let roma: SupabaseClient;
let admin: SupabaseClient;
let anon: SupabaseClient;

beforeAll(async () => {
  try {
    const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
    available = r.ok;
  } catch {
    available = false;
  }
  if (!available) return;
  roma = await login("roma@ejemplo.com");
  admin = await login("socia1@tana.studio");
  anon = createClient(URL, ANON, { auth: { persistSession: false } });
});

describe("RLS: aislamiento entre clientes", () => {
  it("el cliente de Roma solo ve su workspace", async (ctx) => {
    if (!available) return ctx.skip();
    const { data } = await roma.from("workspaces").select("id");
    expect(data?.map((w) => w.id)).toEqual([ROMA]);
  });

  it("no ve piezas, cuotas ni servicios de Las Popas", async (ctx) => {
    if (!available) return ctx.skip();
    for (const table of ["content_items", "invoices", "workspace_services", "comments", "months"]) {
      const { data } = await roma.from(table).select("id").eq("workspace_id", POPAS);
      expect(data, table).toEqual([]);
    }
  });

  it("nunca ve notas internas ni comentarios internos", async (ctx) => {
    if (!available) return ctx.skip();
    const { data: notes } = await roma.from("content_internal").select("*");
    expect(notes).toEqual([]);
    const { data: adminNotes } = await admin.from("content_internal").select("*").eq("workspace_id", ROMA);
    expect(adminNotes?.length).toBeGreaterThan(0);
    const { data: c } = await roma.from("comments").select("is_internal");
    expect(c?.every((x) => !x.is_internal)).toBe(true);
  });

  it("no ve borradores (idea / en redacción)", async (ctx) => {
    if (!available) return ctx.skip();
    const { data } = await roma.from("content_items").select("status").in("status", ["idea", "en_redaccion"]);
    expect(data).toEqual([]);
  });

  it("no puede editar piezas directamente (solo vía acciones permitidas)", async (ctx) => {
    if (!available) return ctx.skip();
    const { data: it } = await roma.from("content_items").select("id, title").eq("workspace_id", ROMA).limit(1).single();
    await roma.from("content_items").update({ title: "HACKEADO" }).eq("id", it!.id);
    const { data: after } = await admin.from("content_items").select("title").eq("id", it!.id).single();
    expect(after?.title).toBe(it!.title);
  });

  it("no puede marcar una cuota como pagada", async (ctx) => {
    if (!available) return ctx.skip();
    const { data: inv } = await roma.from("invoices").select("id, paid_at").is("paid_at", null).limit(1).single();
    await roma.from("invoices").update({ paid_at: new Date().toISOString() }).eq("id", inv!.id);
    const { data: after } = await admin.from("invoices").select("paid_at").eq("id", inv!.id).single();
    expect(after?.paid_at).toBeNull();
  });

  it("no puede darse permisos de admin", async (ctx) => {
    if (!available) return ctx.skip();
    const { data: me } = await roma.auth.getUser();
    await roma.from("profiles").update({ is_tana_admin: true }).eq("id", me.user!.id);
    const { data } = await admin.from("profiles").select("is_tana_admin").eq("id", me.user!.id).single();
    expect(data?.is_tana_admin).toBe(false);
  });

  it("no puede aprobar piezas de otro cliente vía RPC", async (ctx) => {
    if (!available) return ctx.skip();
    const { data: popasItem } = await admin.from("content_items").select("id").eq("workspace_id", POPAS).eq("status", "para_revisar").limit(1).single();
    const { error } = await roma.rpc("client_approve_item", { p_item: popasItem!.id });
    expect(error).not.toBeNull();
  });

  it("anónimo no ve nada, salvo el link compartido válido", async (ctx) => {
    if (!available) return ctx.skip();
    const { data } = await anon.from("content_items").select("id");
    expect(data ?? []).toEqual([]);
    const { data: shared } = await anon.rpc("get_shared_month", { p_token: "laspopas-nov-2026-demo-share-token-xyz789" });
    expect(shared?.items?.length).toBeGreaterThan(0);
    expect(JSON.stringify(shared)).not.toContain("internal_notes");
    const { data: bad } = await anon.rpc("get_shared_month", { p_token: "token-invalido-token-invalido" });
    expect(bad).toBeNull();
  });

  it("el semáforo de la base coincide con el de la app", async (ctx) => {
    if (!available) return ctx.skip();
    const { data } = await admin.from("invoices_view").select("period, computed_status").eq("workspace_id", POPAS).order("period");
    expect(data?.map((d) => d.computed_status)).toEqual(["pagado", "vencido", "pendiente"]);
  });
});
