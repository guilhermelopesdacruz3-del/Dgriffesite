import type { MetadataRoute } from "next";
import { storeConfig } from "@/lib/config";

/**
 * Fase 9 — manifest PWA lite: dá nome/ícone/cor para atalhos instalados no
 * celular ("Adicionar à tela inicial") sem precisar de service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${storeConfig.name} — Ótica`,
    short_name: storeConfig.shortName,
    description: storeConfig.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e6b5f",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
