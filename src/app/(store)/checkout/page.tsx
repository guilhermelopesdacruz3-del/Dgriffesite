import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Container } from "@/components/ui/container";
import { auth } from "@/auth";
import { storeConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Identificação, entrega e pagamento seguro do seu pedido.",
};

export default async function CheckoutPage() {
  // Pré-preenchimento para quem já tem conta (guests preenchem tudo)
  const session = await auth().catch(() => null);

  return (
    <Container className="py-10 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl">Finalizar pedido</h1>
      <p className="mt-2 text-stone-500">
        {storeConfig.legalName} — CNPJ {storeConfig.cnpj} · Ambiente de pagamento seguro via Mercado Pago.
      </p>

      <CheckoutForm
        prefill={{
          nome: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
          loggedIn: Boolean(session?.user?.id),
        }}
      />
    </Container>
  );
}
