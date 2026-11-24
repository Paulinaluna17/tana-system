"use server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { promoteIfTanaAdmin } from "@/lib/admin-emails";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/** Recién acá se usa el link (al tocar "Entrar"), así las vistas previas de WhatsApp/mail no lo gastan. */
export async function confirmLogin(formData: FormData) {
  const token_hash = String(formData.get("token_hash") ?? "");
  const rawType = String(formData.get("type") ?? "email") as EmailOtpType;
  const type = TYPES.includes(rawType) ? rawType : "email";
  const nextParam = String(formData.get("next") ?? "/");
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (!token_hash) redirect("/login?error=link");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error || !data.user) redirect("/login?error=link");
  await promoteIfTanaAdmin(data.user.id, data.user.email);
  redirect(next);
}
