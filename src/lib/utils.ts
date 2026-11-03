import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes condicionais resolvendo conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor em Real (BRL): 1234.5 -> "R$ 1.234,50". */
export function formatBRL(value: number | string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

/** Máximo de parcelas sem juros: respeita 6x e parcela mínima de R$ 40. */
export function maxInstallments(
  price: number,
  max = 6,
  minParcel = 40,
): { count: number; value: number } {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return { count: 1, value: p };
  const count = Math.max(1, Math.min(max, Math.floor(p / minParcel)));
  return { count, value: p / count };
}

/** Slug simples para nomes/tags (usado no admin e seed). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Serializa JSON-LD para <script type="application/ld+json"> (auditoria A8).
 * `</script>` no meio do texto fecharia a tag antecipadamente e permitiria
 * XSS via campos vindos do banco (nome de produto etc.) — escapamos todo `<`.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Data curta pt-BR: 26/10/2026 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}
