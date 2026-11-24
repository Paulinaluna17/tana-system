export type ContentStatus =
  | "idea"
  | "en_redaccion"
  | "para_revisar"
  | "cambios_solicitados"
  | "aprobado"
  | "en_produccion"
  | "material_recibido"
  | "en_edicion"
  | "listo"
  | "publicado"
  | "cancelado"
  | "reemplazado";

export type ProductionOwner = "tana" | "cliente" | "mixto";
export type MonthStatus = "borrador" | "enviado" | "aprobado";
export type MemberRole = "client_editor" | "client_viewer";
export type ServiceStatus = "activo" | "pausado" | "inactivo" | "propuesto";
export type BillingType = "mensual" | "unico" | "por_pieza";
export type Recurrence = "weekly" | "biweekly" | "monthly_first" | "monthly_last";

export interface Brand {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted?: string;
  font: string;
  headingFont: string;
  theme: "light" | "dark";
}

export interface BrandBook {
  tone?: string;
  audience?: string;
  pillars?: string[];
  use_words?: string[];
  avoid_words?: string[];
  hashtags?: string;
  links?: string[];
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  city: string | null;
  contact_name: string | null;
  whatsapp: string | null;
  email: string | null;
  socials: Record<string, string>;
  website: string | null;
  logo_url: string | null;
  brand: Brand;
  production_mode: ProductionOwner;
  approval_lead_days: number;
  revision_rounds: number;
  material_deadline_day: number | null;
  how_to_read_md: string | null;
  calendar_note: string | null;
  brand_book: BrandBook;
  created_at: string;
  archived_at: string | null;
}

export interface ContentType {
  id: string;
  workspace_id: string;
  key: string;
  label: string;
  color: string;
  text_color: string;
  description: string | null;
  sort: number;
}

export interface Pillar {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface Series {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
}

export interface TemplateSlot {
  id: string;
  workspace_id: string;
  content_type_id: string;
  weekday: number;
  time: string;
  recurrence: Recurrence;
  anchor_date: string | null;
  title_default: string | null;
  story_template: { example?: string; objective?: string; format?: string };
  series_id: string | null;
  active: boolean;
  sort: number;
}

export interface Month {
  id: string;
  workspace_id: string;
  year: number;
  month: number;
  status: MonthStatus;
  intro: string | null;
  share_token: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface ScriptBlock {
  section: string;
  time?: string;
  voice?: string;
  on_screen?: string;
}

export interface ShotItem {
  text: string;
  done?: boolean;
}

export interface ContentFormat {
  ratio?: string;
  duration?: string;
  slides?: number | string;
  audio?: string;
  on_screen_text?: string;
}

export interface ContentItem {
  id: string;
  workspace_id: string;
  month_id: string | null;
  content_type_id: string;
  publish_at: string;
  networks: string[];
  status: ContentStatus;
  pillar_id: string | null;
  series_id: string | null;
  template_slot_id: string | null;
  production_owner: ProductionOwner;
  production_person: string | null;
  title: string;
  objective: string | null;
  audience: string | null;
  format: ContentFormat;
  recording_instructions: string | null;
  shot_list: ShotItem[];
  script: ScriptBlock[];
  slides: { text: string }[];
  caption: string | null;
  cta: string | null;
  hashtags: string | null;
  mentions: string | null;
  location: string | null;
  client_material_request: string | null;
  client_material_due: string | null;
  client_material_sent_at: string | null;
  client_material_note: string | null;
  references: { label?: string; url: string }[];
  final_asset_url: string | null;
  published_url: string | null;
  clarifications: string | null;
  metrics: { reach?: number; saves?: number; comments?: number };
  revision_count: number;
  replaced_by_id: string | null;
  is_visible_to_client: boolean;
  client_changed_at: string | null;
  updated_flag_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  content_item_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  attachments: { name: string; path?: string; url?: string }[];
  is_internal: boolean;
  kind: "comment" | "change_request" | "approval" | "material";
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_tana_admin: boolean;
  notify_email: boolean;
  weekly_digest: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  includes: string[];
  excludes: string[];
  default_price: number;
  billing: BillingType;
  active: boolean;
}

export interface WorkspaceService {
  id: string;
  workspace_id: string;
  service_id: string | null;
  custom_name: string | null;
  description: string | null;
  includes: string[];
  excludes: string[];
  price: number;
  currency: string;
  billing: BillingType;
  status: ServiceStatus;
  start_date: string | null;
  end_date: string | null;
  due_day: number | null;
  conditions: string | null;
  services?: { name: string } | null;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  period: string;
  items: { name: string; amount: number; workspace_service_id?: string }[];
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  method: string | null;
  receipt_path: string | null;
  reported_at: string | null;
  reported_note: string | null;
  payment_link: string | null;
  status_override: "anulada" | null;
  notes: string | null;
  auto_generated: boolean;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  workspace_id: string | null;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  data: Record<string, unknown>;
  client_visible: boolean;
  created_at: string;
}
