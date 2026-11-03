import { Construction } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

/** Placeholder amigável para rotas entregues em fases seguintes. */
export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <Container className="py-24 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
        <Construction size={24} strokeWidth={1.6} aria-hidden />
      </div>
      <h1 className="mt-6 font-serif text-3xl md:text-4xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-stone-500">{description}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-stone-400">
        Disponível na {phase}
      </p>
      <div className="mt-8 flex justify-center">
        <Button href="/">Voltar para a loja</Button>
      </div>
    </Container>
  );
}
