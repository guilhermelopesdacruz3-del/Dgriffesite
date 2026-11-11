"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { ProductDetailData } from "@/lib/types";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { VariantPicker } from "@/components/catalog/variant-picker";
import { storeConfig } from "@/lib/config";

/**
 * BLOCO SUPERIOR da PDP: galeria (esquerda) + compra (direita).
 * A variação selecionada é coordenada aqui para que a galeria troque
 * de fotos quando a cor tem fotos próprias.
 */
export function ProductTop({ product }: { product: ProductDetailData }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const variant = product.variants.find((v) => v.id === variantId);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <ProductGallery product={product} variantImages={variant?.images ?? []} />

      <div>
        {/* Cabeçalho */}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          <Link
            href={`/produtos?marca=${product.brand.slug}`}
            className="transition-colors hover:text-ink"
          >
            {product.brand.name}
          </Link>
        </p>
        <h1 className="mt-1 font-serif text-3xl md:text-4xl">{product.name}</h1>
        {product.shortDescription && (
          <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
            {product.shortDescription}
          </p>
        )}

        {/* Compra */}
        <div className="mt-6">
          <VariantPicker
            product={product}
            selectedVariantId={variantId || product.variants[0]?.id || ""}
            onSelectVariant={setVariantId}
          />
        </div>

        {/* Confiança: frete/troca/garantia da config da loja */}
        <ul className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-stone-200 p-4 text-sm text-stone-600 sm:grid-cols-3">
          <li className="flex items-center gap-2">
            <Truck size={18} className="shrink-0 text-accent-600" aria-hidden="true" />
            Envio para todo o Brasil com rastreio
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw size={18} className="shrink-0 text-accent-600" aria-hidden="true" />
            Troca em {storeConfig.commerce.exchangeDays} dias
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={18} className="shrink-0 text-accent-600" aria-hidden="true" />
            Garantia de {storeConfig.commerce.warranty} meses
          </li>
        </ul>
      </div>
    </div>
  );
}
