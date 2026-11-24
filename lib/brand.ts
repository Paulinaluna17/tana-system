import type { Brand } from "./types";
import { contrastRatio, hexToRgbTriplet, mixHex, readableTextOn } from "./utils";

/** Variables CSS para pintar el portal con la identidad del cliente. */
export function brandCssVars(b: Brand): React.CSSProperties {
  const bg = b.background || "#ffffff";
  const text = b.text || "#111111";
  const surface = b.surface || bg;
  const muted = b.muted || mixHex(text, bg, 0.4);
  // El acento tiene que contrastar con el fondo; si no, usamos el secundario o el texto.
  let accent = b.primary;
  if (contrastRatio(accent, bg) < 2.2) accent = contrastRatio(b.secondary, bg) >= 2.2 ? b.secondary : text;
  return {
    ["--bg" as string]: hexToRgbTriplet(bg),
    ["--surface" as string]: hexToRgbTriplet(surface),
    ["--ink" as string]: hexToRgbTriplet(text),
    ["--muted" as string]: hexToRgbTriplet(muted),
    ["--line" as string]: hexToRgbTriplet(mixHex(bg, text, b.theme === "dark" ? 0.18 : 0.13)),
    ["--accent" as string]: hexToRgbTriplet(accent),
    ["--accent-ink" as string]: hexToRgbTriplet(readableTextOn(accent)),
    ["--font-body" as string]: `"${b.font || "Inter"}"`,
    ["--font-heading" as string]: `"${b.headingFont || b.font || "Inter"}"`,
    background: bg,
    color: text,
  };
}

export function googleFontsHref(b: Brand): string {
  const fams = Array.from(new Set([b.font, b.headingFont].filter(Boolean)));
  const q = fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export const FONT_OPTIONS = [
  "Inter",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "DM Sans",
  "Work Sans",
  "Lato",
  "Raleway",
  "Nunito",
  "Playfair Display",
  "Cormorant Garamond",
  "Fraunces",
  "Jost",
  "Libre Baskerville",
  "Bebas Neue",
  "Oswald",
];
