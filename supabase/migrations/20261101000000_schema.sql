-- =====================================================================
-- Tana Studio · Esquema principal
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
create type public.content_status as enum (
  'idea', 'en_redaccion', 'para_revisar', 'cambios_solicitados', 'aprobado',
  'en_produccion', 'material_recibido', 'en_edicion', 'listo', 'publicado',
  'cancelado', 'reemplazado'
);
create type public.production_owner as enum ('tana', 'cliente', 'mixto');
create type public.month_status as enum ('borrador', 'enviado', 'aprobado');
create type public.member_role as enum ('client_editor', 'client_viewer');
create type public.service_status as enum ('activo', 'pausado', 'inactivo', 'propuesto');
create type public.billing_type as enum ('mensual', 'unico', 'por_pieza');
create type public.recurrence as enum ('weekly', 'biweekly', 'monthly_first', 'monthly_last');

-- ---------- Clientes (workspaces) ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  industry text,
  city text,
  contact_name text,
  whatsapp text,
  email text,
  socials jsonb not null default '{}'::jsonb,
  website text,
  logo_url text,
  brand jsonb not null default '{"primary":"#1f2937","secondary":"#6b7280","background":"#ffffff","surface":"#f8fafc","text":"#111827","font":"Inter","headingFont":"Inter","theme":"light"}'::jsonb,
  production_mode public.production_owner not null default 'tana',
  approval_lead_days int not null default 3 check (approval_lead_days between 0 and 30),
  revision_rounds int not null default 2 check (revision_rounds between 0 and 10),
  material_deadline_day int check (material_deadline_day between 1 and 28),
  how_to_read_md text,
  calendar_note text,
  brand_book jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- ---------- Personas ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_tana_admin boolean not null default false,
  notify_email boolean not null default true,
  weekly_digest boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role public.member_role not null default 'client_editor',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

-- ---------- Catálogos por cliente ----------
create table public.content_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#64748b',
  text_color text not null default '#ffffff',
  description text,
  sort int not null default 0,
  unique (workspace_id, key)
);

create table public.pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#94a3b8'
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text
);

create table public.template_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_type_id uuid not null references public.content_types (id) on delete cascade,
  weekday int not null check (weekday between 1 and 7), -- 1 = lunes ... 7 = domingo (ISO)
  time time not null default '19:00',
  recurrence public.recurrence not null default 'weekly',
  anchor_date date, -- para 'cada 15 días': una fecha de referencia en la que toca
  title_default text,
  story_template jsonb not null default '{}'::jsonb, -- {format, example, objective}
  series_id uuid references public.series (id) on delete set null,
  active boolean not null default true,
  sort int not null default 0
);

-- ---------- Calendario ----------
create table public.months (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  status public.month_status not null default 'borrador',
  intro text,
  share_token text unique,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  unique (workspace_id, year, month)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  month_id uuid references public.months (id) on delete set null,
  content_type_id uuid not null references public.content_types (id) on delete restrict,
  publish_at timestamptz not null,
  networks text[] not null default array['instagram'],
  status public.content_status not null default 'idea',
  pillar_id uuid references public.pillars (id) on delete set null,
  series_id uuid references public.series (id) on delete set null,
  template_slot_id uuid references public.template_slots (id) on delete set null,
  production_owner public.production_owner not null default 'tana',
  production_person text,
  title text not null default '',
  objective text,
  audience text,
  format jsonb not null default '{}'::jsonb,            -- {ratio, duration, slides, audio, on_screen_text}
  recording_instructions text,
  shot_list jsonb not null default '[]'::jsonb,         -- [{text, done}]
  script jsonb not null default '[]'::jsonb,            -- [{section, time, voice, on_screen}]
  slides jsonb not null default '[]'::jsonb,            -- [{text}]
  caption text,
  cta text,
  hashtags text,
  mentions text,
  location text,
  client_material_request text,
  client_material_due date,
  client_material_sent_at timestamptz,
  client_material_note text,
  "references" jsonb not null default '[]'::jsonb,      -- [{label, url}]
  final_asset_url text,
  published_url text,
  clarifications text,
  metrics jsonb not null default '{}'::jsonb,           -- manual: {reach, saves, comments}
  revision_count int not null default 0,
  replaced_by_id uuid references public.content_items (id) on delete set null,
  is_visible_to_client boolean not null default false,
  client_changed_at timestamptz,
  updated_flag_until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_ws_publish on public.content_items (workspace_id, publish_at);
create index content_items_month on public.content_items (month_id);

-- Notas internas: tabla aparte, solo Tana (RLS) → imposible que lleguen al cliente.
create table public.content_internal (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  internal_notes text,
  updated_at timestamptz not null default now()
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  diff jsonb not null -- {campo: {before, after}}
);
create index content_versions_item on public.content_versions (content_item_id, changed_at desc);

create table public.item_views (
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, content_item_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  attachments jsonb not null default '[]'::jsonb,
  is_internal boolean not null default false,
  kind text not null default 'comment', -- comment | change_request | approval | material
  created_at timestamptz not null default now()
);
create index comments_item on public.comments (content_item_id, created_at);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete cascade,
  month_id uuid references public.months (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('aprobado', 'cambios')),
  note text,
  created_at timestamptz not null default now(),
  check (content_item_id is not null or month_id is not null)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  storage_path text,
  external_url text,
  file_name text,
  kind text not null default 'material', -- material | reference | final
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table public.idea_bank (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  notes text,
  pillar_id uuid references public.pillars (id) on delete set null,
  content_type_id uuid references public.content_types (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.piece_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade, -- null = global de Tana
  name text not null,
  content_type_key text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Presupuesto ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  default_price numeric(14, 2) not null default 0,
  billing public.billing_type not null default 'mensual',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workspace_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  custom_name text,
  description text,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  price numeric(14, 2) not null default 0,
  currency text not null default 'ARS',
  billing public.billing_type not null default 'mensual',
  status public.service_status not null default 'activo',
  start_date date,
  end_date date,
  due_day int check (due_day between 1 and 28),
  conditions text,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period date not null, -- primer día del mes
  items jsonb not null default '[]'::jsonb, -- [{workspace_service_id, name, amount}]
  amount numeric(14, 2) not null,
  currency text not null default 'ARS',
  due_date date not null,
  paid_at timestamptz,
  method text,
  receipt_path text,
  reported_at timestamptz,
  reported_note text,
  payment_link text,
  status_override text check (status_override in ('anulada')),
  notes text,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now()
);
create index invoices_ws_due on public.invoices (workspace_id, due_date);
create unique index invoices_auto_unique on public.invoices (workspace_id, period) where auto_generated;

-- ---------- Notificaciones y actividad ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe on public.notifications (user_id, dedupe_key);

create table public.activity_log (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  summary text,
  data jsonb not null default '{}'::jsonb,
  client_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index activity_ws on public.activity_log (workspace_id, created_at desc);
