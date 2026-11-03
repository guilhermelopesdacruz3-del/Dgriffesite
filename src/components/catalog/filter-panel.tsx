"use client";

import Link from "next/link";
import { ScanFace } from "lucide-react";
import {
  PRICE_BUCKETS,
  SHAPE_INFO,
  GENDER_INFO,
  catalogHref,
  withToggle,
  withScalar,
  type CatalogFilters,
} from "@/lib/filters";
import { slugify } from "@/lib/utils";
import type { FacetsData } from "@/lib/facets";
import { cn } from "@/lib/utils";

/** slug de enum -> rótulo ("cat-eye" -> "Gatinho", "kids" -> "Infantil") */
const LABEL_BY_SLUG: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SHAPE_INFO).map(([k, v]) => [slugify(k), v])),
  ...Object.fromEntries(Object.entries(GENDER_INFO).map(([k, v]) => [slugify(k), v])),
};

/**
 * Painel de filtros compartilhado: sidebar no desktop e conteúdo do Drawer
 * no mobile. Cada opção é um <Link> — a URL é o estado (sem JS de sincronía,
 * ao voltar/avançar tudo continua correto).
 */

interface FilterPanelProps {
  filters: CatalogFilters;
  facets: FacetsData;
}

/** Linha de opção, destacada quando ativa. */
function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-2 text-sm transition-colors",
        active
          ? "bg-accent-50 font-medium text-accent-700"
          : "text-stone-700 hover:bg-stone-100",
      )}
    >
      {children}
    </Link>
  );
}

/** Bolinha de cor (checkbox visual). */
function ColorLink({
  href,
  active,
  hex,
  label,
}: {
  href: string;
  active: boolean;
  hex: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={label}
      aria-label={`Cor ${label}`}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
        active
          ? "border-accent-600"
          : "border-stone-300 hover:border-stone-500",
      )}
    >
      {/* anel de seleção quando ativa */}
      <span
        aria-hidden="true"
        className={cn(
          "block h-5 w-5 rounded-full border border-stone-200",
          active && "ring-1 ring-accent-600",
        )}
        style={{ backgroundColor: hex }}
      />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export function FilterPanel({ filters, facets }: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Categoria */}
      {facets.categorias.length > 1 && (
        <Group title="Categoria">
          <ul className="flex flex-col gap-1">
            {facets.categorias.map((c) => (
              <FilterLink
                key={c.slug}
                href={catalogHref(withToggle(filters, "categoria", c.slug))}
                active={filters.categoria.includes(c.slug)}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="ml-auto shrink-0 text-xs text-stone-400">{c.count}</span>
              </FilterLink>
            ))}
          </ul>
        </Group>
      )}

      {/* Formato */}
      {facets.formatos.length > 0 && (
        <Group title="Formato">
          <ul className="flex flex-col gap-1">
            {facets.formatos.map((s) => (
              <FilterLink
                key={s.slug}
                href={catalogHref(withToggle(filters, "formato", s.slug))}
                active={filters.formato.includes(s.slug)}
              >
                <span className="min-w-0 truncate">{LABEL_BY_SLUG[s.slug] ?? s.slug}</span>
                <span className="ml-auto shrink-0 text-xs text-stone-400">{s.count}</span>
              </FilterLink>
            ))}
          </ul>
        </Group>
      )}

      {/* público (masculino/feminino/unissex/infantil) */}
      {facets.generos.length > 1 && (
        <Group title="Público">
          <ul className="flex flex-col gap-1">
            {facets.generos.map((g) => (
              <FilterLink
                key={g.slug}
                href={catalogHref(withToggle(filters, "genero", g.slug))}
                active={filters.genero.includes(g.slug)}
              >
                <span className="min-w-0 truncate">{LABEL_BY_SLUG[g.slug] ?? g.slug}</span>
                <span className="ml-auto shrink-0 text-xs text-stone-400">{g.count}</span>
              </FilterLink>
            ))}
          </ul>
        </Group>
      )}

      {/* Cor */}
      {facets.cores.length > 0 && (
        <Group title="Cor">
          <div className="flex flex-wrap gap-2">
            {facets.cores.map((c) => (
              <ColorLink
                key={c.key}
                href={catalogHref(withToggle(filters, "cor", c.key))}
                active={filters.cor.includes(c.key)}
                hex={c.hex}
                label={`${c.name} (${c.count})`}
              />
            ))}
          </div>
        </Group>
      )}

      {/* Preço (faixas rápidas) */}
      <Group title="Preço">
        <ul className="flex flex-col gap-1">
          {PRICE_BUCKETS.map((b) => (
            <FilterLink
              key={b.key}
              href={catalogHref(withScalar(filters, { preco: b.key }))}
              active={filters.preco === b.key}
            >
              <span className="min-w-0 truncate">{b.label}</span>
              <span className="ml-auto shrink-0 text-xs text-stone-400">
                {facets.precos.find((p) => p.key === b.key)?.count ?? 0}
              </span>
            </FilterLink>
          ))}
        </ul>
      </Group>

      {/* Provador 3D */}
      {facets.provador > 0 && (
        <Group title="Provador">
          <FilterLink
            href={catalogHref(withScalar(filters, { provador: !filters.provador }))}
            active={filters.provador}
          >
            <ScanFace size={16} className="shrink-0" aria-hidden />
            <span className="min-w-0 truncate">Experimentável em 3D</span>
            <span className="ml-auto shrink-0 text-xs text-stone-400">{facets.provador}</span>
          </FilterLink>
        </Group>
      )}
    </div>
  );
}
