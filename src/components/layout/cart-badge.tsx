"use client";

import { useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

/**
 * Badge com a quantidade de itens do mini carrinho (localStorage).
 * Renderiza nada no servidor/hidratação inicial — aparece após montar,
 * evitando mismatch de hidratação.
 */
export function CartBadge() {
  const count = useCartCount();

  if (count === 0) return null;

  return (
    <span
      className={cn(
        "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white",
        count > 9 && "px-1.5",
      )}
      aria-label={`${count} ${count === 1 ? "item" : "itens"} no carrinho`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
