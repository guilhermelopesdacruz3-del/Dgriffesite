/**
 * Filtros do catálogo — lógica PURA (sem acesso ao banco/thread do servidor).
 * Usada tanto por componentes client (montagem de URL) quanto por consultas
 * no banco (catálogo). Fonte única de verdade dos parâmetros da URL.
 */
import { slugify } from "@/lib/utils";

// ---------------------------------------------------------------- Constantes

export const PAGE_SIZE = 12;

export type SortKey = "relevancia" | "novidades" | "menor-preco" | "maior-preco";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevancia", label: "Relevância" },
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

/** Faixas de preço pré-definidas (evita digitar valores; UX premium simples). */
export const PRICE_BUCKETS = [
  { key: "ate-300", label: "Até R$ 300", min: 0, max: 300 },
  { key: "300-500", label: "R$ 300 – R$ 500", min: 300, max: 500 },
  { key: "500-800", label: "R$ 500 – R$ 800", min: 500, max: 800 },
  { key: "acima-800", label: "Acima de R$ 800", min: 800, max: Infinity },
] as const;

export const SHAPE_INFO: Record<string, string> = {
  ROUND: "Redonda",
  SQUARE: "Quadrada",
  AVIATOR: "Aviador",
  CAT_EYE: "Gatinho",
  RECTANGULAR: "Retangular",
  OVAL: "Oval",
  BUTTERFLY: "Borboleta",
  WRAP: "Wrap",
};

export const GENDER_INFO: Record<string, string> = {
  FEMININE: "Feminino",
  MASCULINE: "Masculino",
  UNISEX: "Unissex",
  KIDS: "Infantil",
};

/** slug de URL -> enum FrameShape, ex.: "cat-eye" -> "CAT_EYE" */
export const SHAPE_SLUG_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.keys(SHAPE_INFO).map((k) => [slugify(k), k]),
);

/** slug de URL -> enum Gender, ex.: "kids" -> "KIDS" (derivado do enum) */
export const GENDER_SLUG_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.keys(GENDER_INFO).map((k) => [slugify(k), k]),
);

/** Normaliza um nome de cor para chave de URL ("Preto fosco" -> "preto-fosco"). */
export function normalizeColor(name: string): string {
  return slugify(name);
}

// ---------------------------------------------------------------- Tipos

export interface CatalogFilters {
  q: string;
  categoria: string[];
  marca: string[];
  formato: string[];
  genero: string[];
  cor: string[];
  preco: string | null; // chave de PRICE_BUCKETS
  provador: boolean; // só modelos com provador 3D
  ordem: SortKey;
  pagina: number;
}

export interface ActiveChip {
  key: keyof Pick<
    CatalogFilters,
    "q" | "categoria" | "marca" | "formato" | "genero" | "cor" | "preco" | "provador"
  >;
  value: string; // valor original
  label: string; // rótulo humano chapado
}

// ---------------------------------------------------------------- Parse da URL

function collect(raw: Record<string, string | string[] | undefined>, key: string): string[] {
  const v = raw[key];
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

/**
 * Converte os query params da requisição em filtros tipados. Aceita valores
 * repetidos (ex.: ?marca=lumen&marca=verano). Mantém compatibilidade com os
 * links legados da home (?tipo=grau / ?publico=infantil).
 */
export function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const filters: CatalogFilters = {
    q: (typeof raw.q === "string" ? raw.q : "").trim().slice(0, 80),
    categoria: collect(raw, "categoria"),
    marca: collect(raw, "marca"),
    formato: collect(raw, "formato"),
    genero: collect(raw, "genero"),
    cor: collect(raw, "cor"),
    preco: typeof raw.preco === "string" && raw.preco ? raw.preco : null,
    provador: raw.provador === "1",
    ordem: (SORT_OPTIONS.find((o) => o.value === raw.ordem)?.value ??
      "relevancia") as SortKey,
    pagina: Math.max(1, Math.floor(Number(raw.pagina)) || 1),
  };

  // Links legados usados na home/menu antes dos filtros completos existirem:
  // ?tipo=grau  |  ?tipo=sol  |  ?tipo=lentes-de-contato  |  ?tipo=esportivo
  // ?publico=infantil
  const tipo = collect(raw, "tipo");
  const legacyMap: Record<string, string> = {
    grau: "oculos-de-grau",
    sol: "oculos-de-sol",
    "lentes-de-contato": "lentes-de-contato",
    esportivo: "oculos-esportivos",
  };
  filters.categoria.push(...tipo.map((t) => legacyMap[t]).filter(Boolean));

  const publico = collect(raw, "publico");
  if (publico.includes("infantil")) {
    filters.genero.push("kids"); // slug do enum KIDS
  }

  return filters;
}

// ---------------------------------------------------------------- Serialização

/** Serializa os filtros em query string (omite valores padrão). */
export function filtersToParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  const put = (key: string, values: string[]) => {
    values.forEach((v) => p.append(key, v));
  };

  if (f.q) p.set("q", f.q);
  put("categoria", f.categoria);
  put("marca", f.marca);
  put("formato", f.formato);
  put("genero", f.genero);
  put("cor", f.cor);
  if (f.preco) p.set("preco", f.preco);
  if (f.provador) p.set("provador", "1");
  if (f.ordem !== "relevancia") p.set("ordem", f.ordem);
  if (f.pagina > 1) p.set("pagina", String(f.pagina));

  return p;
}

/** URL completa do catálogo a partir de filtros (+ caminho base futuro). */
export function catalogHref(f: CatalogFilters, path = "/produtos"): string {
  const qs = filtersToParams(f).toString();
  return qs ? `${path}?${qs}` : path;
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ------------------------------------------------------------- Patch de filtros

/** Chaves com valores múltiplos (checkbox-like). */
export type ListFilterKey = "categoria" | "marca" | "formato" | "genero" | "cor";

function withPagina(f: CatalogFilters, pagina = 1): CatalogFilters {
  return { ...f, pagina };
}

/** Liga/desliga um valor de um filtro múltiplo, voltando à página 1. */
export function withToggle(
  f: CatalogFilters,
  key: ListFilterKey,
  value: string,
): CatalogFilters {
  return withPagina({ ...f, [key]: toggleValue(f[key], value) });
}

interface ScalarPatch {
  preco?: string | null; // null/igual = remove (radio)
  provador?: boolean;
  ordem?: SortKey;
  q?: string;
}

/** Ajusta campos de valor único (busca/ordenação/faixa/provador). */
export function withScalar(
  f: CatalogFilters,
  patch: ScalarPatch,
): CatalogFilters {
  const preco =
    patch.preco === undefined
      ? f.preco
      : // radio-like: clicar na mesma faixa limpa
        patch.preco === f.preco
        ? null
        : patch.preco;

  return {
    ...f,
    ...(patch.q !== undefined ? { q: patch.q.trim().slice(0, 80) } : null),
    ...(patch.ordem ? { ordem: patch.ordem } : null),
    ...(patch.provador !== undefined ? { provador: patch.provador } : null),
    preco,
    pagina: 1,
  };
}

/** Tem algum filtro (além de ordenação/página) ativo? */
export function hasActiveFilters(f: CatalogFilters): boolean {
  return Boolean(
    f.q ||
      f.categoria.length ||
      f.marca.length ||
      f.formato.length ||
      f.genero.length ||
      f.cor.length ||
      f.preco ||
      f.provador,
  );
}

// ---------------------------------------------------------------- Chips ativos

const SHAPE_BY_SLUG = Object.fromEntries(
  Object.entries(SHAPE_INFO).map(([k, v]) => [slugify(k), v]),
);

/** slug de enum -> rótulo ("feminine" -> "Feminino") */
const LABEL_BY_SLUG = {
  ...Object.fromEntries(Object.entries(SHAPE_INFO).map(([k, v]) => [slugify(k), v])),
  ...Object.fromEntries(Object.entries(GENDER_INFO).map(([k, v]) => [slugify(k), v])),
} as Record<string, string>;

/**
 * Resolve chips de filtros ativos. `labels` traz os nomes humanos das
 * entidades vindas do banco (marcas/categorias); formatos e públicos são
 * estáticos. É chamado no servidor e hidratado na barra do catálogo.
 */
export function resolveChips(
  f: CatalogFilters,
  labels: {
    marcas: Record<string, string>;
    categorias: Record<string, string>;
    cores: Record<string, string>;
  },
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const v of f.categoria)
    chips.push({ key: "categoria", value: v, label: labels.categorias[v] ?? v });
  for (const v of f.marca)
    chips.push({ key: "marca", value: v, label: labels.marcas[v] ?? v });
  for (const v of f.formato)
    chips.push({ key: "formato", value: v, label: SHAPE_BY_SLUG[v] ?? LABEL_BY_SLUG[v] ?? v });
  for (const v of f.genero)
    chips.push({ key: "genero", value: v, label: LABEL_BY_SLUG[v] ?? v });
  for (const v of f.cor)
    chips.push({ key: "cor", value: v, label: labels.cores[v] ?? v });
  if (f.preco) {
    const bucket = PRICE_BUCKETS.find((b) => b.key === f.preco);
    chips.push({ key: "preco", value: f.preco, label: bucket?.label ?? f.preco });
  }
  if (f.provador)
    chips.push({ key: "provador", value: "1", label: "Com provador 3D" });

  return chips;
}
