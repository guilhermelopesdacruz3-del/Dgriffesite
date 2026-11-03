"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import type { ProductDetailData } from "@/lib/types";
import { addToCart } from "@/lib/cart-store";
import { Price } from "@/components/ui/price";
import { storeConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Bloco de compra da PDP: seleção de cor (variações), tamanho (quando o
 * produto tem grade de tamanho, ex. lentes de contato), preço e o CTA
 * "Adicionar ao carrinho" — grava no localStorage (Fase 4 fará o carrinho
 * completo lendo este mesmo formato). Está oculto quando o estoque somado
 * é zero ("Avise-me" leva ao WhatsApp).
 */

interface VariantPickerProps {
  product: ProductDetailData;
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
}

export function VariantPicker({
  product,
  selectedVariantId,
  onSelectVariant,
}: VariantPickerProps) {
  const [added, setAdded] = useState(false);
  /** Fase 7b — a armação de grau pode sair com lentes sob receita. */
  const [comLentes, setComLentes] = useState(false);
  const [lensPackageId, setLensPackageId] = useState<string | null>(null);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0],
    [product, selectedVariantId],
  );

  // Grupos distintos: cores (quando > 1) e tamanhos (quando > 1)
  const cores = useMemo(() => {
    const byColor = new Map<string, { id: string; name: string; hex: string | null }>();
    for (const v of product.variants) {
      if (v.colorName && !byColor.has(v.colorName)) {
        byColor.set(v.colorName, {
          id: v.id,
          name: v.colorName,
          hex: v.colorHex,
        });
      }
    }
    return byColor.size > 1 ? [...byColor.values()] : null;
  }, [product]);

  const tamanhos = useMemo(() => {
    const bySize = new Map<string, { id: string; size: string }>();
    for (const v of product.variants) {
      if (v.size && !bySize.has(v.size)) bySize.set(v.size, { id: v.id, size: v.size });
    }
    return bySize.size > 1 ? [...bySize.values()] : null;
  }, [product]);

  const price = variant?.priceOverride ?? product.price;
  const pacoteLente = product.lensPackages?.find((p) => p.id === lensPackageId) ?? null;
  const total = price + (comLentes ? (pacoteLente?.price ?? 0) : 0);
  const estoque = variant?.stock ?? product.variants.reduce((s, v) => s + v.stock, 0);

  function handleAdd() {
    if (!variant) return;
    // Foto da linha: imagem da variação → neutra do produto → primeira disponível
    const image =
      product.images.find((i) => i.variantId === variant.id)?.url ??
      product.images.find((i) => !i.variantId)?.url ??
      product.images[0]?.url ??
      null;
    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand.name,
      price,
      variantId: product.variants.length > 1 ? variant.id : null,
      colorName: variant.colorName,
      image,
      // Lentes (Fase 7b): só entra se o cliente escolheu um pacote
      lensPackageId: comLentes && pacoteLente ? pacoteLente.id : null,
      lensPackageName: comLentes && pacoteLente ? pacoteLente.name : null,
      lensPackagePrice: comLentes && pacoteLente ? pacoteLente.price : null,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div>
      {/* Preço (com lentes somando, quando escolhidas) */}
      <Price price={total} comparePrice={product.comparePrice} size="lg" />

      {/* Cor */}
      {cores && (
        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Cor: <span className="font-medium normal-case text-ink">{variant?.colorName}</span>
          </legend>
          <div className="mt-2 flex gap-2">
            {cores.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectVariant(c.id)}
                title={c.name}
                aria-label={`Cor ${c.name}`}
                aria-pressed={variant?.colorName === c.name}
                className={cn(
                  "h-9 w-9 rounded-full border transition-colors",
                  variant?.colorName === c.name
                    ? "border-accent-600"
                    : "border-stone-300 hover:border-stone-500",
                )}
              >
                <span
                  className="mx-auto block h-6 w-6 rounded-full border border-stone-200"
                  style={{ backgroundColor: c.hex ?? "#000" }}
                />
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Tamanho */}
      {tamanhos && (
        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Grau / tamanho
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {tamanhos.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectVariant(t.id)}
                aria-pressed={variant?.size === t.size}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm transition-colors",
                  variant?.size === t.size
                    ? "border-accent-600 bg-accent-50 font-medium text-accent-700"
                    : "border-stone-300 text-stone-700 hover:border-stone-500",
                )}
              >
                {t.size}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Lentes (Fase 7b): só para armação de grau, com pacotes do banco */}
      {product.type === "FRAMES" && product.lensPackages && product.lensPackages.length > 0 && (
        <fieldset className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Lentes de grau
          </legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={comLentes}
              onChange={(e) => setComLentes(e.target.checked)}
              className="h-4 w-4 accent-accent-600"
            />
            <span>
              Quero esta armação <strong>com lentes de grau</strong>
              <span className="block text-xs text-stone-500">
                Montagem inclusa — a receita é anexada no checkout e validada pela ótica.
              </span>
            </span>
          </label>
          {comLentes && (
            <div className="mt-3 space-y-2">
              {product.lensPackages.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm transition-colors has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
                >
                  <input
                    type="radio"
                    name="lensPackage"
                    checked={lensPackageId === p.id}
                    onChange={() => setLensPackageId(p.id)}
                    className="mt-1 accent-accent-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 font-medium">
                      {p.name}
                      <span className="whitespace-nowrap font-semibold text-ink">
                        + {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">{p.description}</span>
                  </span>
                </label>
              ))}
              <p className="text-[11px] text-stone-400">
                Sua receita tem adição (perto)? Anexe a foto/PDF no checkout — o
                óptico confere os graus antes de montar.
              </p>
            </div>
          )}
        </fieldset>
      )}

      {/* CTA + estoque */}
      <div className="mt-7">
        {estoque > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleAdd}
              disabled={comLentes && !pacoteLente}
              className={cn(
                "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white transition-colors",
                added ? "bg-emerald-700" : "bg-ink hover:bg-ink/90",
                comLentes && !pacoteLente && "cursor-not-allowed opacity-60",
              )}
            >
              {added ? (
                <>
                  <Check size={18} aria-hidden="true" /> Adicionado
                </>
              ) : (
                <>
                  <ShoppingBag size={18} aria-hidden="true" />{" "}
                  {comLentes && !pacoteLente ? "Escolha o pacote de lentes" : "Adicionar ao carrinho"}
                </>
              )}
            </button>
            {added && (
              <Link
                href="/carrinho"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-ink px-7 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
              >
                Ver carrinho
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled
              className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-full bg-stone-200 px-7 text-sm font-semibold text-stone-500"
            >
              Sem estoque
            </button>
            <a
              href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(
                `Olá! Tenho interesse no ${product.brand.name} ${product.name}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-ink px-7 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              Avise-me quando chegar
            </a>
          </div>
        )}
        <p className="mt-3 text-xs text-stone-400">
          {estoque > 0
            ? estoque <= 5
              ? `Últimas ${estoque} peças em estoque`
              : "Em estoque"
            : "Cadastre-se para saber quando este modelo voltar."}
        </p>
      </div>
    </div>
  );
}
