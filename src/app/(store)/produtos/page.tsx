import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCard } from "@/components/catalog/product-card";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { Pagination } from "@/components/catalog/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE, parseFilters, hasActiveFilters } from "@/lib/filters";
import { getCatalog, getFacets, getFavoriteSlugs } from "@/lib/catalog";
import type { ProductCardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Produtos",
  description:
    "Armações de grau, óculos de sol, lentes de contato e modelos esportivos — filtre por marca, cor, formato e preço.",
};

interface PageProps {
  // Next 15: searchParams chega como Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
      <p className="font-serif text-xl">Catálogo em preparação</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
        Banco de dados ainda sem produtos. Execute a migração e o seed:
      </p>
      <code className="mt-3 block font-mono text-xs text-stone-600">
        npm run db:migrate && npm run db:seed
      </code>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-16 text-center">
      <p className="font-serif text-xl">Nenhum produto encontrado</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
        Tente ajustar ou remover alguns filtros — amplie a faixa de preço ou
        escolha mais de uma cor.
      </p>
      <Link
        href="/produtos"
        className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-ink/90"
      >
        Limpar filtros
      </Link>
    </div>
  );
}

/** Conteúdo: consulta dados e monta sidebar + barra + grade + paginação. */
async function Catalog({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const [first, facets] = await Promise.all([getCatalog(filters), getFacets()]);

  // Favoritos da conta (Fase 5): pré-acende o coração nos cards
  const session = await auth();
  const favoriteSlugs = session?.user?.id
    ? await getFavoriteSlugs(session.user.id)
    : new Set<string>();

  // clamp de segurança quando ?pagina= estoura o número real de páginas
  const pages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  const page = Math.min(filters.pagina, pages);
  let items: ProductCardData[] = first.items;
  if (page !== filters.pagina) {
    items = (await getCatalog({ ...filters, pagina: page })).items;
  }

  if (items.length === 0 && !hasActiveFilters(filters)) return <EmptyCatalog />;
  if (items.length === 0) return <EmptyResult />;

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
      {/* Sidebar de filtros — desktop */}
      <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filtros do catálogo">
        <div className="sticky top-28">
          <p className="mb-4 font-serif text-lg">Filtrar</p>
          <FilterPanel filters={filters} facets={facets} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <CatalogToolbar filters={filters} facets={facets} total={first.total} />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {items.map((p, i) => (
            <ProductCard key={p.slug} product={p} favorite={favoriteSlugs.has(p.slug)} priority={i < 4} />
          ))}
        </div>
        <Pagination filters={filters} pages={pages} current={page} />
      </div>
    </div>
  );
}

export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Produtos" }]} />
      <div className="mt-4 mb-8">
        <SectionHeader
          title="Todos os produtos"
          subtitle="Escolha por categoria, formato e cor — e experimente pelo provador virtual."
        />
      </div>
      <Suspense fallback={<GridSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
