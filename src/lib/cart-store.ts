"use client";

/**
 * Mini carrinho no localStorage — usado pela página do produto (Fase 3).
 * O carrinho completo (merge com banco para logados, pacotes de lente,
 * cupons, frete e checkout) chega na Fase 4 e vai ler este mesmo formato.
 */
import { useEffect, useState } from "react";

const CART_KEY = "pierre.cart.v1";
export const CART_EVENT = "pierre:cart";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  variantId: string | null;
  colorName: string | null;
  /** Primeira foto do produto/variação — preenchida na PDP ao adicionar. */
  image?: string | null;
  /** Pacote de lentes (Fase 7b): campos opcionais — carrinhos antigos seguem lendo. */
  lensPackageId?: string | null;
  lensPackageName?: string | null;
  /** Preço do pacote de lente por unidade (soma no subtotal do checkout). */
  lensPackagePrice?: number | null;
}

/** Preço total da linha (produto + lente quando houver). */
export function linePrice(l: CartLine): number {
  return (l.price + (l.lensPackagePrice ?? 0)) * l.quantity;
}

/** Lê o carrinho salvo (client-side). */
export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Sobrescreve o carrinho e avisa os componentes ouvintes. */
function writeCart(lines: CartLine[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CART_EVENT));
}

/** Grava/entra um exemplar no carrinho (agrupa por produto+variação+lente). */
export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  const lines = readCart();
  const existing = lines.find(
    (l) =>
      l.productId === line.productId &&
      l.variantId === line.variantId &&
      (l.lensPackageId ?? null) === (line.lensPackageId ?? null),
  );
  if (existing) {
    existing.quantity += quantity;
    writeCart(lines);
  } else {
    writeCart([...lines, { ...line, quantity } as CartLine]);
  }
}

/** Contador reativo para o badge do header. */
export function useCartCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () =>
      setCount(readCart().reduce((sum, l) => sum + l.quantity, 0));
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return count;
}

/** Altera a quantidade de uma linha (mínimo 1; excluir use removeLine). */
export function setQuantity(
  productId: string,
  variantId: string | null,
  quantity: number,
  lensPackageId: string | null = null,
) {
  writeCart(
    readCart().map((l) =>
      l.productId === productId &&
      l.variantId === variantId &&
      (l.lensPackageId ?? null) === lensPackageId
        ? { ...l, quantity: Math.max(1, Math.min(99, quantity)) }
        : l,
    ),
  );
}

/** Remove uma linha do carrinho. */
export function removeLine(
  productId: string,
  variantId: string | null,
  lensPackageId: string | null = null,
) {
  writeCart(
    readCart().filter(
      (l) =>
        !(
          l.productId === productId &&
          l.variantId === variantId &&
          (l.lensPackageId ?? null) === lensPackageId
        ),
    ),
  );
}

/** Esvazia o carrinho (chamado quando o pedido é criado com sucesso). */
export function clearCart() {
  writeCart([]);
}

/** Subtotal atual (quantidade × preço unitário, incluindo as lentes). */
export function cartSubtotal(lines: CartLine[] = readCart()) {
  return lines.reduce((sum, l) => sum + linePrice(l), 0);
}
