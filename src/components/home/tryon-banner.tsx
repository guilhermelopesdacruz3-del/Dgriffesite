import { ScanFace, MonitorSmartphone, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

// Banner do provador virtual: explica os 3 passos + privacidade em 1 linha.
const steps = [
  {
    icon: ScanFace,
    title: "1. Ative a câmera",
    desc: "Permita o acesso — todo o processamento de vídeo acontece no seu aparelho.",
  },
  {
    icon: MonitorSmartphone,
    title: "2. Vista os óculos",
    desc: "O modelo acompanha seu rosto em tempo real. Troque de cor sem sair.",
  },
  {
    icon: ShoppingBag,
    title: "3. Compre com um toque",
    desc: "Tirou foto, escolheu? Adicione ao carrinho direto do provador.",
  },
];

export function TryOnBanner() {
  return (
    <section className="py-16 md:py-20">
      <Container>
        <div className="rounded-3xl bg-accent-50 px-6 py-12 md:px-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
                Provador virtual • 3D
              </p>
              <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                Experimente sem sair de casa
              </h2>
              <p className="mt-3 text-stone-600">
                Detecção de rosto com IA rodando 100% no seu navegador — nenhum vídeo
                sai do seu dispositivo. Fotografe, compare e compre com segurança.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/provador" variant="accent">Como funciona</Button>
              <Button href="/produtos" variant="outline">Ver produtos com provador</Button>
            </div>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.title} className="rounded-2xl bg-white p-6 shadow-card">
                <s.icon className="text-accent-600" size={28} strokeWidth={1.6} aria-hidden />
                <h3 className="mt-4 font-serif text-lg">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
