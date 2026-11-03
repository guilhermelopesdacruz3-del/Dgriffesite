import Link from "next/link";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-svh flex-col items-center justify-center py-20 text-center">
      <Compass className="text-accent-600" size={40} strokeWidth={1.4} aria-hidden />
      <h1 className="mt-6 font-serif text-4xl md:text-5xl">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-stone-500">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-ink/90"
        >
          Voltar à loja
        </Link>
        <Link
          href="/produtos"
          className="inline-flex h-11 items-center rounded-full border border-ink px-6 text-[15px] font-medium transition-colors hover:bg-stone-100"
        >
          Ver produtos
        </Link>
      </div>
    </Container>
  );
}
