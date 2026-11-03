"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Search as SearchIcon, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { FilterPanel } from "@/components/catalog/filter-panel";
import {
  SORT_OPTIONS,
  catalogHref,
  withScalar,
  withToggle,
  resolveChips,
  type CatalogFilters,
} from "@/lib/filters";
import type { FacetsData } from "@/lib/facets";

/**
 * Barra de controle do catálogo: busca (preserva filtros), ordenação,
 * contagem de resultados, chips dos filtros ativos e o botão "Filtros"
 * que abre o Drawer com o mesmo painel do desktop.
 */

interface CatalogToolbarProps {
  filters: CatalogFilters;
  facets: FacetsData;
  total: number;
}

export function CatalogToolbar({ filters, facets, total }: CatalogToolbarProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const labels = {
    categorias: Object.fromEntries(facets.categorias.map((c) => [c.slug, c.name])),
    marcas: Object.fromEntries(facets.marcas.map((c) => [c.slug, c.name])),
    cores: Object.fromEntries(facets.cores.map((c) => [c.key, c.name])),
  };
  const chips = resolveChips(filters, labels);

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "");
    router.push(catalogHref(withScalar(filters, { q })));
    setDrawerOpen(false);
  }

  const sortValue = filters.ordem;

  return (
    <>
      {/* Busca (desktop) / também dentro do drawer (mobile) */}
      <form
        onSubmit={submitSearch}
        role="search"
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon
            size={18}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <input
            key={filters.q}
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar por modelo ou marca…"
            aria-label="Buscar produtos"
            className="h-11 w-full rounded-full border border-stone-300 bg-white pl-11 pr-4 text-[15px] outline-none transition-colors focus:border-accent-600"
          />
        </div>
        <button
          type="submit"
          className="hidden h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink/90 sm:block"
        >
          Buscar
        </button>
      </form>

      {/* Linha: contagem + ordenação + botão de filtros (mobile) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-stone-500" aria-live="polite">
          <strong className="font-semibold text-ink">{total}</strong>{" "}
          {total === 1 ? "produto" : "produtos"}
        </p>

        {/* chips dos filtros ativos */}
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const href = catalogHref(
              chip.key === "preco"
                ? withScalar(filters, { preco: chip.value })
                : chip.key === "provador"
                  ? withScalar(filters, { provador: false })
                  : withToggle(filters, chip.key as "categoria" | "marca" | "formato" | "genero" | "cor", chip.value),
            );
            return (
              <Link
                key={chip.key + chip.value}
                href={href}
                scroll={false}
                className="flex h-7 items-center gap-1 rounded-full bg-stone-100 pl-3 pr-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
              >
                {chip.label}
                <X size={13} aria-hidden="true" />
                <span className="sr-only"> (remover filtro)</span>
              </Link>
            );
          })}
          {chips.length > 1 && (
            <Link
              href="/produtos"
              scroll={false}
              className="h-7 rounded-full px-2 text-xs font-medium text-accent-700 underline-offset-2 hover:underline"
            >
              Limpar tudo
            </Link>
          )}
        </div>

        {/* Botão filtros (mobile) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full border border-stone-300 px-4 text-sm font-medium transition-colors hover:border-ink lg:hidden"
          aria-label="Abrir filtros"
        >
          <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
          Filtros
          {chips.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white">
              {chips.length}
            </span>
          )}
        </button>

        {/* Ordenação */}
        <label className="ml-auto flex items-center gap-2 text-sm text-stone-500">
          <span className="hidden sm:inline">Ordenar por</span>
          <select
            value={sortValue}
            onChange={(e) =>
              router.push(catalogHref(withScalar(filters, { ordem: e.target.value as "relevancia" | "novidades" | "menor-preco" | "maior-preco" })))
            }
            className="h-9 cursor-pointer rounded-full border border-stone-300 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-accent-600"
            aria-label="Ordenação dos produtos"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Drawer de filtros (mobile) */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        title="Filtros"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-200 p-5">
            <form onSubmit={submitSearch} role="search" className="flex gap-2">
              <input
                key={filters.q}
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="Buscar…"
                aria-label="Buscar produtos"
                className="h-11 w-full rounded-full border border-stone-300 px-4 text-[15px] outline-none focus:border-accent-600"
              />
              <button
                type="submit"
                className="h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-white"
              >
                Ok
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <FilterPanel filters={filters} facets={facets} />
          </div>

          <div className="border-t border-stone-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Ver {total} {total === 1 ? "produto" : "produtos"}
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
