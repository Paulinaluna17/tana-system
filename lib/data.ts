import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRangeUtc } from "./dates";
import { showUpdatedBadge } from "./status";
import type { ContentItem, ContentType, Month, Pillar, Series } from "./types";
import type { CalItem } from "@/components/calendar/calendar-view";

export async function loadCalendar(
  supabase: SupabaseClient,
  workspaceId: string,
  year: number,
  month: number,
  userId?: string,
) {
  const range = monthRangeUtc(year, month);
  const [{ data: items }, { data: types }, { data: pillars }, { data: series }, { data: monthRow }, { data: views }] =
    await Promise.all([
      supabase
        .from("content_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("publish_at", range.from)
        .lt("publish_at", range.to)
        .order("publish_at"),
      supabase.from("content_types").select("*").eq("workspace_id", workspaceId).order("sort"),
      supabase.from("pillars").select("*").eq("workspace_id", workspaceId).order("name"),
      supabase.from("series").select("*").eq("workspace_id", workspaceId),
      supabase.from("months").select("*").eq("workspace_id", workspaceId).eq("year", year).eq("month", month).maybeSingle(),
      userId
        ? supabase.from("item_views").select("content_item_id, seen_at").eq("user_id", userId)
        : Promise.resolve({ data: [] as { content_item_id: string; seen_at: string }[] }),
    ]);
  const seen = Object.fromEntries((views ?? []).map((v) => [v.content_item_id, v.seen_at]));
  const seriesById = Object.fromEntries(((series ?? []) as Series[]).map((s) => [s.id, s.name]));
  const full = (items ?? []) as ContentItem[];
  const calItems: CalItem[] = full.map((i) => ({
    id: i.id,
    publish_at: i.publish_at,
    status: i.status,
    title: i.title,
    content_type_id: i.content_type_id,
    pillar_id: i.pillar_id,
    production_owner: i.production_owner,
    series_name: i.series_id ? seriesById[i.series_id] : null,
    updated: showUpdatedBadge(i, seen[i.id]),
  }));
  return {
    items: full,
    calItems,
    types: (types ?? []) as ContentType[],
    pillars: (pillars ?? []) as Pillar[],
    series: (series ?? []) as Series[],
    month: (monthRow ?? null) as Month | null,
  };
}

export function parseYearMonth(sp: { y?: string; m?: string }, fallback: { year: number; month: number }) {
  const y = Number(sp.y);
  const m = Number(sp.m);
  if (Number.isInteger(y) && y >= 2020 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12) return { year: y, month: m };
  return fallback;
}
