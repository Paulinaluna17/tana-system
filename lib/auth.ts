import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { MemberRole, Profile, Workspace } from "./types";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  isAdmin: boolean;
  memberships: { workspace_id: string; role: MemberRole; slug: string; name: string }[];
}

/** Datos de la sesión actual (cacheado por request). */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: ms }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("memberships").select("workspace_id, role, workspaces(slug, name)").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  type MRow = { workspace_id: string; role: MemberRole; workspaces: { slug: string; name: string } | null };
  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile as Profile,
    isAdmin: !!profile.is_tana_admin,
    memberships: ((ms ?? []) as unknown as MRow[])
      .filter((m) => m.workspaces)
      .map((m) => ({ workspace_id: m.workspace_id, role: m.role, slug: m.workspaces!.slug, name: m.workspaces!.name })),
  };
});

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin(): Promise<SessionContext> {
  const s = await requireSession();
  if (!s.isAdmin) redirect(homeFor(s));
  return s;
}

export function homeFor(s: SessionContext): string {
  if (s.isAdmin) return "/inicio";
  if (s.memberships.length > 0) return `/portal/${s.memberships[0].slug}`;
  return "/sin-acceso";
}

/** Acceso a un cliente por slug: Tana o miembros del cliente. */
export async function requireWorkspace(slug: string) {
  const s = await requireSession();
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!ws) notFound();
  const membership = s.memberships.find((m) => m.workspace_id === ws.id);
  if (!s.isAdmin && !membership) notFound();
  return {
    session: s,
    workspace: ws as Workspace,
    role: (s.isAdmin ? "admin" : membership!.role) as "admin" | MemberRole,
    supabase,
  };
}

/** Para Server Actions: lanza error (no redirige) si no es admin. */
export async function assertAdmin() {
  const s = await getSession();
  if (!s?.isAdmin) throw new Error("Solo el equipo de Tana puede hacer esto.");
  return s;
}
