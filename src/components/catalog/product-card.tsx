import Image from "next/image";
import Link from "next/link";
import { ScanFace } from "lucide-react";
import { Price } from "@/components/ui/price";
import { Badge } from "@/components/ui/badge";
import { FavoriteHeart } from "@/components/catalog/favorite-heart";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductCardData;
  priority?: boolean;
  /** Pré-acende o coração quando o produto já está nos favoritos da conta. */
  favorite?: boolean;
  className?: string;
}

/**
 * Card de produto da grade de catálogo/carrossel.
 * Hover troca para a 2ª imagem (padrão premium de óticas).
 */
export function ProductCard({ product, priority, favorite, className }: ProductCardProps) {
  const [main, secondary] = product.images;
  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : null;

  return (
    <Link
      href={`/produtos/${product.slug}`}
      aria-label={`${product.brand} ${product.name}`}
      className={cn(
        "group relative block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
        className,
      )}
    >
      {/* Imagens com troca no hover */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100">
        {main ? (
          <Image
            src={main}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 24vw"
            className="object-contain transition-opacity duration-300 group-hover:opacity-0"
          />
        ) : null}
        {secondary ? (
          <Image
            src={secondary}
            alt={`${product.name} — vista alternativa`}
            fill
            sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 24vw"
            className="object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        ) : null}

        {/* Selos */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
          {product.has3d && (
            <Badge variant="ink" className="shadow-card">
              <ScanFace size={12} aria-hidden /> Provador 3D
            </Badge>
          )}
          {discount && (
            <Badge variant="accent">-{discount}%</Badge>
          )}
          {product.isNew && !discount && <Badge variant="sale">Novo</Badge>}
        </div>

        {/* Favoritar */}
        <div className="absolute right-3 top-3">
          <FavoriteHeart slug={product.slug} favorite={favorite} />
        </div>
      </div>

      {/* Informações */}
      <div className="mt-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            {product.brand}
          </p>
          <h3 className="truncate text-[15px] font-medium">{product.name}</h3>
          <div className="mt-1">
            <Price price={product.price} comparePrice={product.comparePrice} size="sm" />
          </div>
        </div>
        {/* Bolinhas de variação de cor */}
        {product.colors.length > 0 && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-1">
            {product.colors.slice(0, 4).map((c) => (
              <span
                key={c.name + c.hex}
                title={c.name}
                className="block h-3.5 w-3.5 rounded-full border border-stone-300"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[10px] leading-tight text-stone-500">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
