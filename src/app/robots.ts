import type { MetadataRoute } from "next";
import { storeConfig } from "@/lib/config";

/**
 * Fase 9 — robots.txt: liberamos o que é catálogo/conteúdo e bloqueamos
 * áreas privadas (conta, checkout, pedidos, admin e APIs). O sitemap é
 * gerado dinamicamente em /sitemap.xml (src/app/sitemap.ts).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/minha-conta",
          "/entrar",
          "/criar-conta",
          "/recuperar-senha",
          "/checkout",
          "/carrinho",
          "/pedido",
          "/provador/estudio",
          "/api/",
        ],
      },
    ],
    sitemap: `${storeConfig.siteUrl}/sitemap.xml`,
    host: storeConfig.siteUrl,
  };
}
