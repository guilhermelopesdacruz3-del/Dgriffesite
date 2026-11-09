/**
 * Camada de dados do catálogo (servidor): busca com filtros/ordenação/
 * paginação, facetas para os componentes de filtro e detalhe do produto.
 * Se o banco estiver indisponível, cai nos fallbacks demonstrativos para
 * o site nunca quebrar durante o desenvolvimento (mesmo padrão do content.ts).
 */
import { db } from "@/lib/db";
import { storeConfig } from "@/lib/config";
import type { ProductCardData, ProductDetailData } from "@/lib/types";
import type { FacetsData } from "@/lib/facets";
import {
  PRICE_BUCKETS,
  SHAPE_SLUG_TO_ENUM,
  GENDER_SLUG_TO_ENUM,
  normalizeColor,
  PAGE_SIZE,
  type CatalogFilters,
} from "@/lib/filters";
import { slugify } from "@/lib/utils";
import type { Prisma, FrameShape, Gender } from "@prisma/client";

// -------------------------------------------------------------
// Fallbacks demonstrativos (espelham o seed) — usados quando o
// banco ainda não está rodando/seedado.
// -------------------------------------------------------------

export const fallbackProducts: ProductCardData[] = [
  { slug: "aura-redonda", name: "Aura Redonda", brand: "Lumen", price: 449.9, comparePrice: 649.9, images: ["/produtos/aura-redonda-1.jpg", "/produtos/aura-redonda-2.jpg"], colors: [{ name: "Preto", hex: "#17171a" }, { name: "Havana", hex: "#5d3a20" }], has3d: true, categorySlug: "oculos-de-grau", gender: "UNISEX", shape: "ROUND", type: "FRAMES" },
  { slug: "caraiva-aviador", name: "Caraíva Aviador", brand: "Verano", price: 459.9, images: ["/produtos/caraiva-aviador-1.jpg", "/produtos/caraiva-aviador-2.jpg"], colors: [{ name: "Dourado", hex: "#b98d4f" }], has3d: true, categorySlug: "oculos-de-sol", gender: "UNISEX", shape: "AVIATOR", type: "SUNGLASSES" },
  { slug: "milano-quadrado", name: "Milano Quadrado", brand: "Atelier Óptico", price: 589.9, images: ["/produtos/milano-quadrado-1.jpg", "/produtos/milano-quadrado-2.jpg"], colors: [{ name: "Havana", hex: "#5d3a20" }], has3d: false, categorySlug: "oculos-de-grau", gender: "MASCULINE", shape: "SQUARE", type: "FRAMES" },
  { slug: "iris-gatinho", name: "Íris Gatinho", brand: "Órbita", price: 389.9, comparePrice: 449.9, images: ["/produtos/iris-gatinho-1.jpg", "/produtos/iris-gatinho-2.jpg"], colors: [{ name: "Vinho", hex: "#5c2e35" }], has3d: true, categorySlug: "oculos-de-grau", gender: "FEMININE", shape: "CAT_EYE", type: "FRAMES" },
  { slug: "fjord-esportivo", name: "Fjord Esportivo", brand: "Nordica", price: 599.9, images: ["/produtos/peak-polarizado-1.jpg", "/produtos/peak-polarizado-2.jpg"], colors: [], has3d: false, categorySlug: "oculos-esportivos", gender: "UNISEX", shape: "WRAP", type: "SUNGLASSES" },
  { slug: "duna-oval", name: "Duna Oval", brand: "Lumen", price: 329.9, images: ["/produtos/duna-oval-1.jpg", "/produtos/duna-oval-2.jpg"], colors: [{ name: "Cristal", hex: "#e8e2d9" }], has3d: true, categorySlug: "oculos-de-grau", gender: "FEMININE", shape: "OVAL", type: "FRAMES" },
  { slug: "buzios-quadrado", name: "Búzios Quadrado", brand: "Verano", price: 429.9, images: ["/produtos/buzios-quadrado-1.jpg", "/produtos/buzios-quadrado-2.jpg"], colors: [{ name: "Preto", hex: "#17171a" }], has3d: false, categorySlug: "oculos-de-sol", gender: "UNISEX", shape: "SQUARE", type: "SUNGLASSES" },
  { slug: "vento-redonda", name: "Vento Redonda", brand: "Lumen", price: 479.9, images: ["/produtos/vento-redonda-1.jpg", "/produtos/vento-redonda-2.jpg"], colors: [{ name: "Grafite", hex: "#4a4a52" }], has3d: true, categorySlug: "oculos-de-grau", gender: "UNISEX", shape: "ROUND", type: "FRAMES" },
];

/** Categorias canônicas (nomes/slugs do seed). */
export const categoryFallback: { slug: string; name: string }[] = [
  { slug: "oculos-de-grau", name: "Óculos de grau" },
  { slug: "oculos-de-sol", name: "Óculos de sol" },
  { slug: "lentes-de-contato", name: "Lentes de contato" },
  { slug: "oculos-infantis", name: "Óculos infantis" },
  { slug: "oculos-esportivos", name: "Óculos esportivos" },
];

/**
 * Descrições/especificações demonstrativas da PDP (dados correspondentes do
 * seed quando disponíveis; aqui só para o modo sem banco).
 */
const FALLBACK_SPECS: Record<
  string,
  { description: string; material: string; lensWidth: number; bridge: number; temple: number; weight: number }
> = {
  "aura-redonda":    { description: "Redonda clássica em acetato polido, leve e confortável para o dia inteiro.", material: "Acetato italiano", lensWidth: 48, bridge: 22, temple: 145, weight: 24 },
  "caraiva-aviador": { description: "Aviador clássico com lente polarizada UV400 e serigrafia discreta nas hastes.", material: "Metal", lensWidth: 58, bridge: 14, temple: 140, weight: 27 },
  "milano-quadrado": { description: "Armação de acetato italiano com charneira reforçada; cai bem em rostos largos.", material: "Acetato italiano", lensWidth: 52, bridge: 18, temple: 150, weight: 28 },
  "iris-gatinho":    { description: "Gatinho acetinado com detalhe metálico frontal; realça o olhar.", material: "Acetato", lensWidth: 51, bridge: 16, temple: 140, weight: 25 },
  "fjord-esportivo": { description: "Envelopado para treino com lente antirrisco; leve e ventilado.", material: "TR90", lensWidth: 62, bridge: 15, temple: 135, weight: 21 },
  "duna-oval":       { description: "Leve e resistente: TR90 superflexível com plaquetas ajustáveis e toque macio.", material: "TR90", lensWidth: 50, bridge: 19, temple: 140, weight: 16 },
  "buzios-quadrado": { description: "Quadrado bold com lente G15 verde — visão natural e contraste equilibrado.", material: "Acetato", lensWidth: 55, bridge: 18, temple: 145, weight: 26 },
  "vento-redonda":   { description: "Redonda minimalista em aço leve; ponte dupla fina para efeito vintage.", material: "Metal", lensWidth: 46, bridge: 21, temple: 145, weight: 19 },
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(
      "[catalog] Banco indisponível — usando fallback:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

// ------------------------------------------------------------- Mapeamento

// Tipo do produto com as relações usadas no card.
export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: { select: { slug: true } };
    images: true;
    variants: true;
    model3d: true;
  };
}>;

/** Converte linhas do Prisma para o formato enxuto usado pelos cards. */
export function mapProducts(rows: ProductWithRelations[]): ProductCardData[] {
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand?.name ?? storeConfig.name,
    price: Number(p.price),
    comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
    images: p.images
      .filter((i) => !i.variantId)
      .sort((a, b) => a.position - b.position)
      .map((i) => i.url),
    colors: p.variants
      .filter((v) => v.colorHex && !/^Grau -/.test(v.colorName ?? ""))
      .map((v) => ({ name: v.colorName ?? "", hex: v.colorHex ?? "" })),
    has3d: p.model3d.some((m) => m.active),
    isNew: p.isNew,
    categorySlug: p.category?.slug,
    gender: p.gender,
    shape: p.frameShape ?? undefined,
    type: p.type,
  }));
}

// ------------------------------------------------------------- Ordenação

function orderByFor(
  ordem: CatalogFilters["ordem"],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (ordem) {
    case "novidades":
      return [{ isNew: "desc" }, { createdAt: "desc" }];
    case "menor-preco":
      return [{ price: "asc" }];
    case "maior-preco":
      return [{ price: "desc" }];
    default:
      // relevância: destaques primeiro, depois ordem de inserção (seed)
      return [{ isFeatured: "desc" }, { createdAt: "asc" }];
  }
}

// ------------------------------------------------------------- Filtro (fallback em memória)

/** Aplica os mesmos filtros sobre os produtos demonstrativos. */
function filterFallback(f: CatalogFilters): ProductCardData[] {
  let items = fallbackProducts.filter((p) => {
    if (
      f.q &&
      !`${p.name} ${p.brand}`.toLowerCase().includes(f.q.toLowerCase())
    )
      return false;
    if (f.categoria.length && (!p.categorySlug || !f.categoria.includes(p.categorySlug)))
      return false;
    if (f.marca.length && !f.marca.includes(slugify(p.brand))) return false;
    if (f.formato.length && (!p.shape || !f.formato.includes(slugify(p.shape)))) return false;
    if (f.genero.length && (!p.gender || !f.genero.includes(slugify(p.gender)))) return false;
    if (f.cor.length && !p.colors.some((c) => f.cor.includes(normalizeColor(c.name))))
      return false;
    if (f.preco) {
      const bucket = PRICE_BUCKETS.find((b) => b.key === f.preco);
      if (bucket && !(p.price >= bucket.min && p.price < bucket.max)) return false;
    }
    if (f.provador && !p.has3d) return false;
    return true;
  });

  switch (f.ordem) {
    case "novidades":
      items = [...items].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
      break;
    case "menor-preco":
      items = [...items].sort((a, b) => a.price - b.price);
      break;
    case "maior-preco":
      items = [...items].sort((a, b) => b.price - a.price);
      break;
    default:
      break; // relevância = ordem natural do array
  }
  return items;
}

// ------------------------------------------------------------- Consulta do catálogo

/**
 * Resolve as chaves de cor da URL ("preto-fosco") para os nomes originais
 * gravados nas variações. Retorna [] quando nenhuma batida existir (vazio).
 */
async function resolveColorNames(keys: string[]): Promise<string[]> {
  const variants = await db.productVariant.findMany({
    where: {
      colorName: { not: null },
      product: { active: true, deletedAt: null },
    },
    select: { colorName: true },
    distinct: ["colorName"],
  });
  const names = variants
    .map((v) => v.colorName!)
    .filter((n) => !/^Grau -/.test(n)); // graus de lente de contato não são "cor"
  return names.filter((n) => keys.includes(normalizeColor(n)));
}

function buildWhere(f: CatalogFilters, colorNames: string[]): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { active: true, deletedAt: null };

  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { shortDescription: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
      { brand: { name: { contains: f.q, mode: "insensitive" } } },
    ];
  }
  if (f.categoria.length) where.category = { slug: { in: f.categoria } };
  if (f.marca.length) where.brand = { slug: { in: f.marca } };

  const shapes = f.formato.map((s) => SHAPE_SLUG_TO_ENUM[s]).filter(Boolean);
  if (shapes.length) where.frameShape = { in: shapes as FrameShape[] };

  const genders = f.genero.map((g) => GENDER_SLUG_TO_ENUM[g]).filter(Boolean);
  if (genders.length) where.gender = { in: genders as Gender[] };

  if (f.cor.length) {
    where.variants = { some: { colorName: { in: colorNames } } };
  }

  if (f.preco) {
    const bucket = PRICE_BUCKETS.find((b) => b.key === f.preco);
    if (bucket) {
      where.price = {
        gte: bucket.min,
        ...(bucket.max !== Infinity ? { lt: bucket.max } : null),
      };
    }
  }

  if (f.provador) where.model3d = { some: { active: true } };

  return where;
}

/** Catálogo completo: filtros + ordenação + paginação (com fallback demo). */
export async function getCatalog(
  f: CatalogFilters,
): Promise<{ items: ProductCardData[]; total: number; demo: boolean }> {
  try {
    const colorNames = f.cor.length ? await resolveColorNames(f.cor) : [];
    const where = buildWhere(f, colorNames);
    const [total, rows] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        include: {
          brand: true,
          category: { select: { slug: true } },
          images: true,
          variants: true,
          model3d: true,
        },
        orderBy: orderByFor(f.ordem),
        skip: (f.pagina - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return { items: mapProducts(rows), total, demo: total === 0 };
  } catch {
    const items = filterFallback(f);
    return {
      items: items.slice((f.pagina - 1) * PAGE_SIZE, f.pagina * PAGE_SIZE),
      total: items.length,
      demo: true,
    };
  }
}

// ---------------- Favoritos (Fase 5) ----------------

/** Slugs favoritados por um usuário (para pré-acender o coração do card). */
export async function getFavoriteSlugs(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  return safe(async () => {
    const favs = await db.favorite.findMany({
      where: { userId },
      select: { product: { select: { slug: true } } },
    });
    return new Set(favs.map((f) => f.product.slug));
  }, new Set<string>());
}

/** Produtos favoritados de um usuário, na ordem em que foram salvos. */
export async function getFavoriteProducts(userId: string): Promise<ProductCardData[]> {
  if (!userId) return [];
  return safe(async () => {
    const favs = await db.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        product: {
          include: {
            brand: true,
            category: { select: { slug: true } },
            images: true,
            variants: true,
            model3d: true,
          },
        },
      },
    });
    return favs
      .filter((f) => f.product && f.product.active && !f.product.deletedAt)
      .map((f) => mapProducts([f.product])[0]);
  }, []);
}

// ------------------------------------------------------------- Facetas

type FacetRow = {
  price: Prisma.Decimal | number;
  gender: string;
  frameShape: string | null;
  brand: { slug: string; name: string };
  category: { slug: string; name: string };
  model3d: { active: boolean }[];
  variants: { colorName: string | null; colorHex: string | null }[];
};

function buildFacets(rows: FacetRow[]): FacetsData {
  const categorias = new Map<string, { name: string; count: number }>();
  const marcas = new Map<string, { name: string; count: number }>();
  const formatos = new Map<string, number>();
  const generos = new Map<string, number>();
  const cores = new Map<string, { name: string; hex: string; count: number }>();
  const precos = new Map<string, number>();
  let provador = 0;

  for (const row of rows) {
    categorias.set(row.category.slug, {
      name: row.category.name,
      count: (categorias.get(row.category.slug)?.count ?? 0) + 1,
    });
    marcas.set(row.brand.slug, {
      name: row.brand.name,
      count: (marcas.get(row.brand.slug)?.count ?? 0) + 1,
    });
    if (row.frameShape) {
      const key = slugify(row.frameShape); // "CAT_EYE" -> "cat-eye"
      formatos.set(key, (formatos.get(key) ?? 0) + 1);
    }
    const generoKey = slugify(row.gender); // "KIDS" -> "kids"
    generos.set(generoKey, (generos.get(generoKey) ?? 0) + 1);

    const bucket = PRICE_BUCKETS.find(
      (b) => Number(row.price) >= b.min && Number(row.price) < b.max,
    );
    if (bucket) precos.set(bucket.key, (precos.get(bucket.key) ?? 0) + 1);

    if (row.model3d.some((m) => m.active)) provador++;

    // cores distintas por produto (evita contar a mesma peça 2x)
    const seen = new Set<string>();
    for (const v of row.variants) {
      if (!v.colorName || !v.colorHex || /^Grau -/.test(v.colorName)) continue;
      const key = normalizeColor(v.colorName);
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = cores.get(key) ?? { name: v.colorName, hex: v.colorHex, count: 0 };
      cur.count++;
      cores.set(key, cur);
    }
  }

  const sortName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "pt-BR");

  return {
    categorias: [...categorias].map(([slug, v]) => ({ slug, ...v })).sort(sortName),
    marcas: [...marcas].map(([slug, v]) => ({ slug, ...v })).sort(sortName),
    formatos: [...formatos].map(([slug, count]) => ({ slug, count })),
    generos: [...generos].map(([slug, count]) => ({ slug, count })),
    cores: [...cores].map(([key, v]) => ({ key, ...v })),
    precos: [...precos].map(([key, count]) => ({ key, count })),
    provador,
  };
}

/** Facetas demonstrativas quando o banco está ausente. */
function facetsFromFallback(): FacetsData {
  return buildFacets(
    fallbackProducts.map((p) => ({
      price: p.price,
      gender: p.gender ?? "UNISEX",
      frameShape: p.shape ?? null,
      brand: { slug: slugify(p.brand), name: p.brand },
      category: {
        slug: p.categorySlug ?? "oculos-de-grau",
        name:
          categoryFallback.find((c) => c.slug === p.categorySlug)?.name ??
          "Óculos de grau",
      },
      model3d: p.has3d ? [{ active: true }] : [],
      variants: p.colors.map((c) => ({ colorName: c.name, colorHex: c.hex })),
    })),
  );
}

/** Facetas para o painel de filtros (banco real ou demonstrativo). */
export async function getFacets(): Promise<FacetsData> {
  return safe(async () => {
    const rows = await db.product.findMany({
      where: { active: true, deletedAt: null },
      select: {
        price: true,
        gender: true,
        frameShape: true,
        brand: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
        model3d: { select: { active: true } },
        variants: {
          where: { active: true },
          select: { colorName: true, colorHex: true },
        },
      },
    });
    return buildFacets(rows);
  }, facetsFromFallback());
}

// ------------------------------------------------------------- Página do produto

type ProductFullRow = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: true;
    images: true;
    variants: { where: { active: true }; include: { images: true } };
    model3d: { where: { active: true } };
  };
}>;

function mapProductDetail(p: ProductFullRow): ProductDetailData {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: { name: p.brand.name, slug: p.brand.slug },
    category: { name: p.category.name, slug: p.category.slug },
    type: p.type,
    gender: p.gender,
    description: p.description,
    shortDescription: p.shortDescription,
    price: Number(p.price),
    comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
    sku: p.sku,
    isNew: p.isNew,
    has3d: p.model3d.some((m) => m.active),
    material: p.material,
    lensWidth: p.lensWidth,
    bridge: p.bridge,
    temple: p.temple,
    weight: p.weight,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    images: p.images
      .filter((i) => !i.variantId)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ url: i.url, alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v.id,
      colorName: v.colorName,
      colorHex: v.colorHex,
      size: v.size,
      stock: v.stock,
      priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
      images: v.images
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ url: i.url, alt: i.alt })),
    })),
  };
}

/** PDP demonstrativa quando o banco está ausente. */
function fallbackDetail(slug: string): ProductDetailData | null {
  const card = fallbackProducts.find((p) => p.slug === slug);
  if (!card) return null;
  const specs = FALLBACK_SPECS[slug];
  return {
    id: `demo-${slug}`,
    slug: card.slug,
    name: card.name,
    brand: { name: card.brand, slug: slugify(card.brand) },
    category: {
      name: categoryFallback.find((c) => c.slug === card.categorySlug)?.name ?? "Óculos de grau",
      slug: card.categorySlug ?? "oculos-de-grau",
    },
    type: card.type ?? "FRAMES",
    gender: card.gender ?? "UNISEX",
    description:
      specs?.description ??
      `${card.name} — modelo demonstrativo da vitrine. Rodando sem banco de dados.`,
    shortDescription: specs ? `${specs.description.slice(0, 60)}…` : null,
    price: card.price,
    comparePrice: card.comparePrice ?? null,
    sku: `DEMO-${slug.toUpperCase()}`,
    isNew: card.isNew ?? false,
    has3d: card.has3d,
    material: specs?.material ?? null,
    lensWidth: specs?.lensWidth ?? null,
    bridge: specs?.bridge ?? null,
    temple: specs?.temple ?? null,
    weight: specs?.weight ?? null,
    seoTitle: null,
    seoDescription: null,
    images: card.images.map((url) => ({ url, alt: card.name })),
    variants: (card.colors.length
      ? card.colors
      : [{ name: "Preto", hex: "#17171a" }]
    ).map((c) => ({
      id: `demo-${slug}-${normalizeColor(c.name)}`,
      colorName: c.name,
      colorHex: c.hex,
      size: null,
      stock: 10,
      priceOverride: null,
      images: [],
    })),
  };
}

/** Detalhe do produto por slug (banco real ou demonstrativo). */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailData | null> {
  return safe(async () => {
    const row = await db.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        images: true,
        variants: { where: { active: true }, include: { images: true } },
        model3d: { where: { active: true } },
      },
    });
    if (!row) return fallbackDetailFromNames(slug);
    const detail = mapProductDetail(row);

    // Fase 7b — armação de GRAU pode ser vendida "com lentes": carrega os
    // pacotes ativos do banco (preço entra no checkout, receita é exigida lá).
    if (detail.type === "FRAMES") {
      const packages = await db.lensPackage.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, price: true },
      });
      if (packages.length > 0) {
        detail.lensPackages = packages.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
        }));
      }
    }
    return detail;
  }, fallbackDetail(slug));
}

/** Fallback extra: batida por slug do NOME do produto em modo demo. */
function fallbackDetailFromNames(slug: string): ProductDetailData | null {
  const byName = fallbackProducts.find((p) => slugify(p.name) === slug);
  return byName ? fallbackDetail(byName.slug) : null;
}

/** Produtos relacionados (mesma categoria, depois mesma marca). */
export async function getRelatedProducts(
  slug: string,
  categorySlug: string,
  brandSlug: string,
  limit = 8,
): Promise<ProductCardData[]> {
  const fallback = fallbackProducts.filter((p) => p.slug !== slug).slice(0, limit);

  return safe(async () => {
    const rows = await db.product.findMany({
      where: {
        active: true,
        deletedAt: null,
        slug: { not: slug },
        OR: [{ category: { slug: categorySlug } }, { brand: { slug: brandSlug } }],
      },
      include: {
        brand: true,
        category: { select: { slug: true } },
        images: true,
        variants: true,
        model3d: true,
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "asc" }],
      take: limit,
    });
    const mapped = mapProducts(rows);
    return mapped.length ? mapped : fallback;
  }, fallback);
}
