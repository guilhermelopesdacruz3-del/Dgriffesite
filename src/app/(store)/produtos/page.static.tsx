import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCard } from "@/components/catalog/product-card";
import { fallbackProducts } from "@/lib/catalog";

/**
 * Variante ESTÁTICA de /produtos — usada apenas no build do ZIP de demo
 * (STATIC_EXPORT=1; o `scripts/build-demo-zip.mjs` troca o conteúdo de
 * `page.tsx` durante o build e restaura o original no fim). Grade simples do
 * catálogo de exemplo, sem filtros/paginação (que dependem de servidor) e sem
 * `searchParams`/flags dinâmicas (que o export estático não permite).
 */

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Armações de grau, óculos de sol, lentes de contato e modelos esportivos — experimente no provador virtual 3D.",
};

export default function StaticProductsPage() {
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Produtos" }]} />

      <div className="mt-4 mb-6">
        <SectionHeader
          title="Todos os produtos"
          subtitle="Escolha por categoria, formato e cor — e experimente pelo provador virtual."
        />
      </div>

      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <strong className="font-semibold">Modo demonstração:</strong> catálogo de
        exemplo com 8 modelos. Filtros, busca, páginas e pedidos ficam ativos no
        deploy completo, com banco de dados.
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {fallbackProducts.map((p, i) => (
          <ProductCard key={p.slug} product={p} priority={i < 4} />
        ))}
      </div>

      <div className="mt-12 rounded-3xl border border-stone-200 bg-stone-50 p-10 text-center">
        <p className="font-serif text-2xl text-stone-800">Experimente antes de escolher</p>
        <p className="mx-auto mt-2 max-w-md text-stone-600">
          Palco 3D com rastreio facial da sua câmera — como uma ótica faria na
          bancada.
        </p>
        <Link
          href="/provador/estudio"
          className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-ink/90"
        >
          Abrir o estúdio 3D
        </Link>
      </div>
    </Container>
  );
}
