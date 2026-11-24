/**
 * Punto de extensión (fuera de alcance de esta versión): asistente con IA para generar ideas y copies.
 *
 * Idea de implementación futura:
 * - Una Server Action `suggestCopy(itemId)` que lea la pieza + el brand book del cliente
 *   (tono, palabras a usar/evitar, público) y llame a la API de Claude (Anthropic) con esos datos.
 * - Devolver 2–3 opciones de copy/gancho para que Tana elija; nunca guardar sin revisión humana.
 * - La API key iría en una variable de entorno del servidor (ANTHROPIC_API_KEY), nunca en el navegador.
 */
export interface CopySuggestionRequest {
  title: string;
  objective: string | null;
  brandTone?: string;
  audience?: string;
  avoidWords?: string[];
}

export async function suggestCopy(_req: CopySuggestionRequest): Promise<string[]> {
  void _req;
  throw new Error("El asistente con IA todavía no está activado (ver lib/ai/index.ts).");
}
