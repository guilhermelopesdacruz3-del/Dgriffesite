import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { storeConfig } from "@/lib/config";

/**
 * Fase 9 — sitemap.xml dinâmico: catálogo vivo (produtos, categorias) +
 * páginas institucionais do CMS, com lastmod real. Se o banco estiver fora
 * (ex.: build num ambiente sem banco), devolve as rotas estáticas — a loja
 * nunca quebra por causa do SEO.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = storeConfig.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/marcas`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/paginas/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/paginas/contato`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/paginas/lojas`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/paginas/politica-de-trocas`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/paginas/politica-de-privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/paginas/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const [products, categories, pages] = await Promise.all([
      db.product.findMany({
        where: { active: true, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      db.category.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
      db.page.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...statics,
      ...categories.map((c) => ({
        url: `${base}/produtos?categoria=${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...products.map((p) => ({
        url: `${base}/produtos/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      // páginas CMS têm prioridade menor quando já estão nas estáticas acima
      ...pages
        .filter((p) => !/\b(faq|contato|lojas|politica-de-trocas|politica-de-privacidade|termos)\b/.test(p.slug))
        .map((p) => ({
          url: `${base}/paginas/${p.slug}`,
          lastModified: p.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.3,
        })),
    ];
  } catch (error) {
    console.error("[sitemap] banco indisponível — sitemap só com rotas estáticas:", error);
    return statics;
  }
}
