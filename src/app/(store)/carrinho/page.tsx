import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { Container } from "@/components/ui/container";
import { storeConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Carrinho de compras",
  description: "Revise os produtos escolhidos, aplique um cupom e calcule o frete até o seu CEP.",
};

export default function CartPage() {
  return (
    <Container className="py-10 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl">Carrinho</h1>
      <p className="mt-2 text-stone-500">
        Frete grátis em compras acima de {storeConfig.commerce.freeShippingAbove.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.
      </p>

      <CartView />
    </Container>
  );
}
