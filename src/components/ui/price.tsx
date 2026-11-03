import { formatBRL, maxInstallments } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceProps {
  price: number | string;
  comparePrice?: number | string | null;
  /** Exibe a linha "até 6x de R$ X sem juros" */
  installments?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Preço promocional/preço + parcelamento, padronizado em todo o site. */
export function Price({
  price,
  comparePrice,
  installments = true,
  size = "md",
  className,
}: PriceProps) {
  const current = Number(price);
  const compare =
    comparePrice != null && Number(comparePrice) > current ? Number(comparePrice) : null;
  const inst = maxInstallments(current);
  const sizes = {
    sm: { price: "text-base", inst: "text-[11px]" },
    md: { price: "text-lg", inst: "text-xs" },
    lg: { price: "text-3xl", inst: "text-sm" },
  }[size];

  return (
    <div className={cn("leading-tight", className)}>
      {compare && (
        <span className={cn("mr-2 text-stone-400 line-through", sizes.inst)}>
          {formatBRL(compare)}
        </span>
      )}
      <span className={cn("font-semibold text-ink", sizes.price)}>
        {formatBRL(current)}
      </span>
      {installments && inst.count > 1 && (
        <p className={cn("mt-0.5 text-stone-500", sizes.inst)}>
          ou {inst.count}x de {formatBRL(inst.value)} sem juros
        </p>
      )}
    </div>
  );
}
