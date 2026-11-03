import { Container } from "@/components/ui/container";
import { getBrands } from "@/lib/content";

/** Faixa de marcas parceiras (loop infinito, pausa para quem prefere menos movimento). */
export async function BrandStrip() {
  const brands = await getBrands();
  const list = [...brands, ...brands]; // duplicado para o loop do marquee

  return (
    <section className="border-y border-stone-200 py-10">
      <Container>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
          Marcas parceiras
        </p>
      </Container>
      <div className="overflow-hidden" aria-hidden>
        <div className="flex w-max items-center gap-14 motion-safe:animate-marquee">
          {list.map((name, i) => (
            <span
              key={name + i}
              className="whitespace-nowrap font-serif text-2xl text-stone-400 grayscale"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
