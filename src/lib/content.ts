import { db } from "@/lib/db";
import { storeConfig } from "@/lib/config";
import type { ProductCardData } from "@/lib/types";
import { mapProducts, fallbackProducts } from "@/lib/catalog";

/**
 * Camada de conteúdo da loja: lê dados do banco (editáveis no admin) e,
 * caso o banco ainda não esteja disponível/seedado, usa fallbacks da
 * configuração para que o site nunca "quebre" durante o desenvolvimento.
 */

// Executa uma consulta com fallback silencioso se o banco estiver ausente.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(
      "[content] Banco indisponível — usando fallback:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

// ---------------- Anúncio do topo ----------------
export async function getAnnouncement(): Promise<string> {
  return safe(async () => {
    const row = await db.setting.findUnique({ where: { key: "announcement" } });
    return row?.value ?? storeAnnouncement;
  }, storeAnnouncement);
}

const storeAnnouncement =
  `Frete grátis acima de R$ ${storeConfig.commerce.freeShippingAbove} • Até ${storeConfig.commerce.maxInstallments}x sem juros • Provador virtual 3D`;

// ---------------- Banners da home ----------------
export interface BannerData {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaLabel2: string | null;
  ctaHref2: string | null;
}

const heroFallback: BannerData = {
  title: "Enxergue melhor, vista melhor.",
  subtitle:
    "Armações selecionadas com atendimento óptico de verdade — agora com provador virtual 3D.",
  imageUrl: "https://picsum.photos/seed/otica-hero/2000/1200",
  ctaLabel: "Ver coleção",
  ctaHref: "/produtos",
  ctaLabel2: "Experimentar no provador",
  ctaHref2: "/provador",
};

export async function getHeroBanner(): Promise<BannerData> {
  return safe(async () => {
    const row = await db.banner.findFirst({
      where: { slot: "home_hero", active: true },
      orderBy: { sortOrder: "asc" },
    });
    return row
      ? {
          title: row.title,
          subtitle: row.subtitle,
          imageUrl: row.imageUrl,
          ctaLabel: row.ctaLabel,
          ctaHref: row.ctaHref,
          ctaLabel2: row.ctaLabel2,
          ctaHref2: row.ctaHref2,
        }
      : heroFallback;
  }, heroFallback);
}

// ---------------- Marcas do rodapé/faixa ----------------
export async function getBrands(): Promise<string[]> {
  return safe(async () => {
    const rows = await db.brand.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      take: 12,
    });
    return rows.length ? rows.map((b) => b.name) : brandFallback;
  }, brandFallback);
}

const brandFallback = [
  "Atelier Óptico",
  "Verano",
  "Lumen",
  "Órbita",
  "Nordica",
  "Cristalina",
  "Maré",
  "Andino",
];

// ---------------- Mais vendidos (fallbacks demonstrativos) ----------------

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  const fallback = fallbackProducts.slice(0, limit);
  return safe(async () => {
    const rows = await db.product.findMany({
      where: { active: true, deletedAt: null, isFeatured: true },
      include: {
        brand: true,
        category: { select: { slug: true } },
        images: true,
        variants: true,
        model3d: { where: { active: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    const mapped = mapProducts(rows);
    return mapped.length ? mapped : fallback;
  }, fallback);
}

// Catálogo completo (Fase 1: listagem simples; Fase 3: filtros completos)
export async function getFeaturedProducts(limit = 12): Promise<ProductCardData[]> {
  const fallback = fallbackProducts.slice(0, limit);
  return safe(async () => {
    const rows = await db.product.findMany({
      where: { active: true, deletedAt: null },
      include: {
        brand: true,
        category: { select: { slug: true } },
        images: true,
        variants: true,
        model3d: { where: { active: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    const mapped = mapProducts(rows);
    return mapped.length ? mapped : fallback;
  }, fallback);
}

export async function countProducts(): Promise<number | null> {
  return safe(async () => {
    const n = await db.product.count({ where: { active: true, deletedAt: null } });
    return n > 0 ? n : null;
  }, null);
}

// ---------------- Página institucional genérica ----------------
export async function getPage(slug: string) {
  return safe(async () => {
    return await db.page.findFirst({
      where: { slug, active: true },
    });
  }, null);
}

// Produtos demonstrativos: movidos para src/lib/catalog.ts (compartilhado).
