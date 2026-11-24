import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { promoteIfTanaAdmin } from "@/lib/admin-emails";

/**
 * Link de email con token_hash (funciona aunque el cliente abra el mail en otro dispositivo).
 * Plantilla sugerida en Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (token_hash) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error && data.user) {
      await promoteIfTanaAdmin(data.user.id, data.user.email);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
