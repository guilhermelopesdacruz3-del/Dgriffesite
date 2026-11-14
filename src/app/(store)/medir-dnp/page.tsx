import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { DnpMeter } from "@/components/provador/dnp-meter";

export const metadata: Metadata = {
  title: "Medir minha DP (distância pupilar)",
  description:
    "Meça sua distância pupilar pela câmera em segundos — sem sair de casa. A medida acompanha a receita para montar suas lentes de grau.",
};

export default function MedirDnpPage() {
  return (
    <Container className="py-10 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-serif text-3xl sm:text-4xl">Medir minha DP</h1>
        <p className="mt-3 text-stone-500">
          A <strong>DP</strong> (distância pupilar) é a medida entre suas pupilas —
          ela garante que as lentes sejam montadas no ponto certo da armação.
          Meça agora pela câmera e use na hora de comprar uma armação{" "}
          <strong>com lentes de grau</strong>.
        </p>
      </div>

      <DnpMeter />
    </Container>
  );
}
