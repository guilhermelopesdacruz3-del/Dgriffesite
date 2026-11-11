"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { ScanFace } from "lucide-react";
import type { ProductDetailData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Galeria da PDP: imagem principal com zoom no hover + miniaturas
 * clicáveis. Acessível via teclado (thumbs são botões reais).
 */

interface GalleryProps {
  product: ProductDetailData;
  variantImages: { url: string; alt?: string | null }[];
}

export function ProductGallery({ product, variantImages }: GalleryProps) {
  // Quando a variação selecionada tem fotos próprias, elas substituem a base.
  const list =
    variantImages.length > 0
      ? variantImages
      : product.images.map((i) => ({ url: i.url, alt: i.alt }));

  const [active, setActive] = useState(0);
  const current = list[Math.min(active, list.length - 1)] ?? list[0];

  if (!current) return null;

  return (
    <div>
      {/* Quadro quadrado: fotos reais (CDN) são ~quadradas/panorâmicas; contain evita corte */}
      <div className="group relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
        <Image
          src={current.url}
          alt={current.alt ?? product.name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 46vw"
          className="object-contain transition-transform duration-500 group-hover:scale-105"
        />
        {product.has3d && (
          <Link
            href={`/provador/estudio?produto=${product.slug}`}
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-ink/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-ink"
          >
            <ScanFace size={14} aria-hidden="true" /> Experimentar em 3D
          </Link>
        )}
        {product.isNew && (
          <span className="absolute right-4 top-4 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-600/30">
            Lançamento
          </span>
        )}
      </div>

      {/* Miniaturas */}
      {list.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {list.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1} de ${product.name}`}
              aria-pressed={active === i}
              className={cn(
                "relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-stone-100 transition-colors",
                active === i ? "border-accent-600" : "border-transparent hover:border-stone-300",
              )}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
