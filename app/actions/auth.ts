"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { promoteIfTanaAdmin } from "@/lib/admin-emails";

const emailSchema = z.string().trim().toLowerCase().email("Revisá el email");

function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export type AuthState = { ok?: boolean; error?: string; message?: string };

export async function sendMagicLink(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Revisá el email" };
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    // No revelamos si el email existe o no.
    console.error("magic link", error.message);
  }
  return {
    ok: true,
    message: "Si tu email tiene acceso, te llegó un link para entrar. Revisá tu bandeja (y spam).",
  };
}

export async function signInWithPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!parsed.success || password.length < 6) return { error: "Email o contraseña incorrectos" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
  if (error || !data.user) return { error: "Email o contraseña incorrectos" };
  await promoteIfTanaAdmin(data.user.id, data.user.email);
  const next = safeNext(formData.get("next"));
  if (next !== "/") redirect(next);
  const [{ data: profile }, { data: ms }] = await Promise.all([
    supabase.from("profiles").select("is_tana_admin").eq("id", data.user.id).single(),
    supabase.from("memberships").select("workspaces(slug)").eq("user_id", data.user.id).limit(1),
  ]);
  const slug = (ms?.[0] as unknown as { workspaces: { slug: string } | null } | undefined)?.workspaces?.slug;
  redirect(profile?.is_tana_admin ? "/inicio" : slug ? `/portal/${slug}` : "/sin-acceso");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
