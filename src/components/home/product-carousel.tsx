"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ProductCard } from "@/components/catalog/product-card";
import type { ProductCardData } from "@/lib/types";

/** Carrossel horizontal (Embla) usado em "Mais vendidos". */
export function ProductCarousel({
  products,
  favoriteSlugs,
}: {
  products: ProductCardData[];
  /** Slugs favoritados na conta (Fase 5) — pré-acende o coração. */
  favoriteSlugs?: string[];
}) {
  const [viewportRef, embla] = useEmblaCarousel({
    align: "start",
    loop: false,
    containScroll: "trimSnaps",
  });
  const [prevEnabled, setPrevEnabled] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(true);

  const onSelect = useCallback(() => {
    if (!embla) return;
    setPrevEnabled(embla.canScrollPrev());
    setNextEnabled(embla.canScrollNext());
  }, [embla]);

  // Arrows refletem o estado do carrossel; atualizam ao rolar e redimensionar.
  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla, onSelect]);

  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={viewportRef}>
        <div className="-ml-5 flex">
          {products.map((p, i) => (
            <div
              key={p.slug + i}
              className="min-w-0 shrink-0 basis-[68%] pl-5 sm:basis-[45%] lg:basis-[24%]"
            >
              <ProductCard product={p} favorite={!!favoriteSlugs?.includes(p.slug)} priority={i < 4} />
            </div>
          ))}
        </div>
      </div>

      {/* Setas (desktop) */}
      <div className="absolute -left-5 top-[38%] hidden sm:block">
        <button
          onClick={scrollPrev}
          disabled={!prevEnabled}
          aria-label="Produtos anteriores"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white shadow-card transition hover:bg-stone-50 disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="absolute -right-5 top-[38%] hidden sm:block">
        <button
          onClick={scrollNext}
          disabled={!nextEnabled}
          aria-label="Próximos produtos"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white shadow-card transition hover:bg-stone-50 disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
