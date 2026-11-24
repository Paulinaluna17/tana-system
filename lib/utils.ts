import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** $ 150.000 */
export function formatMoney(value: number | string, currency = "ARS"): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (currency === "ARS") return ars.format(n).replace(/\s/g, " ");
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(n);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** wa.me con mensaje prearmado. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const p = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

/** Convierte un hex (#RRGGBB) en "R G B" para variables CSS. */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "0 0 0";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Luminancia relativa (WCAG) para elegir texto claro u oscuro sobre un color. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgbTriplet(hex)
    .split(" ")
    .map((x) => {
      const c = Number(x) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function readableTextOn(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#111111") ? "#ffffff" : "#111111";
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Mezcla dos colores hex (t = 0 → a, t = 1 → b) y devuelve hex. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgbTriplet(a).split(" ").map(Number);
  const pb = hexToRgbTriplet(b).split(" ").map(Number);
  return (
    "#" +
    pa
      .map((x, i) => Math.round(x + (pb[i] - x) * t))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}
