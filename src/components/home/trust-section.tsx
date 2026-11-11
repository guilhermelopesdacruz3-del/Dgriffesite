import { Truck, RotateCcw, ShieldCheck, Lock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { storeConfig } from "@/lib/config";

const items = [
  {
    icon: Truck,
    title: "Envio nacional",
    desc: "Postagem com código de rastreio para todo o Brasil.",
  },
  {
    icon: RotateCcw,
    title: `Troca em ${storeConfig.commerce.exchangeDays} dias`,
    desc: "Não gostou da armação? Troque sem burocracia.",
  },
  {
    icon: ShieldCheck,
    title: "Garantia de 12 meses",
    desc: "Cobertura contra defeitos de fabricação.",
  },
  {
    icon: Lock,
    title: "Pagamento seguro",
    desc: "Pix, boleto e cartão com criptografia ponta a ponta.",
  },
];

export function TrustSection() {
  return (
    <section className="py-14 md:py-16">
      <Container>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {items.map((i) => (
            <li key={i.title} className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                <i.icon size={22} strokeWidth={1.7} aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{i.title}</h3>
              <p className="mt-1 max-w-56 text-xs leading-relaxed text-stone-500">{i.desc}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
