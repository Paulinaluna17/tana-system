import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentItem, ContentType, Pillar, Series } from "./types";
import type { CommentView } from "@/components/piece/conversation";
import type { ApprovalView, VersionView } from "@/components/piece/history";

type ProfileJoin = { full_name: string | null; email: string | null; is_tana_admin: boolean } | null;
const nameOf = (p: ProfileJoin) => p?.full_name || p?.email || "Alguien";

export interface AssetView {
  id: string;
  name: string;
  url: string | null;
  kind: string;
  created_at: string;
  author_name: string;
}

export async function loadPiece(supabase: SupabaseClient, id: string, workspaceId: string, isAdmin: boolean) {
  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!item) return null;
  const [types, pillars, series, comments, versions, approvals, internal, assets, templates] = await Promise.all([
    supabase.from("content_types").select("*").eq("workspace_id", workspaceId).order("sort"),
    supabase.from("pillars").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("series").select("*").eq("workspace_id", workspaceId),
    supabase
      .from("comments")
      .select("*, profiles(full_name, email, is_tana_admin)")
      .eq("content_item_id", id)
      .order("created_at"),
    supabase
      .from("content_versions")
      .select("*, profiles(full_name, email, is_tana_admin)")
      .eq("content_item_id", id)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase
      .from("approvals")
      .select("*, profiles(full_name, email, is_tana_admin)")
      .eq("content_item_id", id)
      .order("created_at", { ascending: false }),
    isAdmin
      ? supabase.from("content_internal").select("internal_notes").eq("content_item_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("assets")
      .select("*, profiles(full_name, email, is_tana_admin)")
      .eq("content_item_id", id)
      .order("created_at", { ascending: false }),
    isAdmin
      ? supabase.from("piece_templates").select("id, name").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const assetRows = (assets.data ?? []) as {
    id: string;
    storage_path: string | null;
    external_url: string | null;
    file_name: string | null;
    kind: string;
    created_at: string;
    profiles: ProfileJoin;
  }[];
  const signed = await Promise.all(
    assetRows.map(async (a) => {
      if (a.external_url) return a.external_url;
      if (!a.storage_path) return null;
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return data?.signedUrl ?? null;
    }),
  );

  return {
    item: item as ContentItem,
    types: (types.data ?? []) as ContentType[],
    pillars: (pillars.data ?? []) as Pillar[],
    series: (series.data ?? []) as Series[],
    internalNotes: (internal.data as { internal_notes: string | null } | null)?.internal_notes ?? null,
    templates: (templates.data ?? []) as { id: string; name: string }[],
    comments: ((comments.data ?? []) as (Record<string, unknown> & { profiles: ProfileJoin })[]).map(
      (c): CommentView => ({
        id: c.id as string,
        body: c.body as string,
        is_internal: c.is_internal as boolean,
        kind: c.kind as string,
        created_at: c.created_at as string,
        author_name: nameOf(c.profiles),
        author_is_tana: !!c.profiles?.is_tana_admin,
      }),
    ),
    versions: ((versions.data ?? []) as (Record<string, unknown> & { profiles: ProfileJoin })[]).map(
      (v): VersionView => ({
        id: v.id as string,
        changed_at: v.changed_at as string,
        author_name: v.profiles ? nameOf(v.profiles) : "Sistema",
        diff: v.diff as VersionView["diff"],
      }),
    ),
    approvals: ((approvals.data ?? []) as (Record<string, unknown> & { profiles: ProfileJoin })[]).map(
      (a): ApprovalView => ({
        id: a.id as string,
        action: a.action as ApprovalView["action"],
        note: a.note as string | null,
        created_at: a.created_at as string,
        author_name: nameOf(a.profiles),
      }),
    ),
    assets: assetRows.map(
      (a, i): AssetView => ({
        id: a.id,
        name: a.file_name ?? a.external_url ?? "Archivo",
        url: signed[i],
        kind: a.kind,
        created_at: a.created_at,
        author_name: nameOf(a.profiles),
      }),
    ),
  };
}
