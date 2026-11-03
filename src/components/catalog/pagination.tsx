import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { catalogHref, type CatalogFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

/**
 * Paginação do catálogo: números em <Link> (crawleável, sem JS) preservando
 * todos os filtros. Janela central de páginas com primeira/última fixas.
 */

interface PaginationProps {
  filters: CatalogFilters;
  pages: number;
  current: number;
}

function pageHref(filters: CatalogFilters, page: number): string {
  return catalogHref({ ...filters, pagina: page });
}

/** Janela de páginas visíveis (até 5 no meio, extremos sempre presentes). */
function pageList(current: number, pages: number): number[] {
  const span = 2;
  const set = new Set<number>([1, pages]);
  for (let p = Math.max(1, current - span); p <= Math.min(pages, current + span); p++) {
    set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

export function Pagination({ filters, pages, current }: PaginationProps) {
  if (pages <= 1) return null;

  const list = pageList(current, pages);

  return (
    <nav aria-label="Paginação de produtos" className="mt-10 flex items-center justify-center gap-1">
      {/* Anterior */}
      {current > 1 ? (
        <Link
          href={pageHref(filters, current - 1)}
          scroll={false}
          aria-label="Página anterior"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 transition-colors hover:border-ink"
        >
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-300"
        >
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}

      {/* Números */}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - list[i - 1] > 1 && (
            <span aria-hidden="true" className="px-1 text-stone-400">
              …
            </span>
          )}
          <Link
            href={pageHref(filters, p)}
            scroll={false}
            aria-current={p === current ? "page" : undefined}
            aria-label={`Ir para a página ${p}`}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors",
              p === current
                ? "bg-ink font-semibold text-white"
                : "text-stone-700 hover:bg-stone-100",
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      {/* Próxima */}
      {current < pages ? (
        <Link
          href={pageHref(filters, current + 1)}
          scroll={false}
          aria-label="Próxima página"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 transition-colors hover:border-ink"
        >
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-300"
        >
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
