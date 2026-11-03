import { StarRating } from "@/components/ui/star-rating";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";

// Depoimentos (Fase 9: powered by Reviews reais aprovadas no admin)
const testimonials = [
  {
    name: "Marina G.",
    city: "São Paulo, SP",
    rating: 5,
    text: "Comprei a armação pelo provador virtual e a surpresa foi que ficou exatamente como na foto. Chegou em 4 dias, pronta com as minhas lentes.",
  },
  {
    name: "Rafael T.",
    city: "Belo Horizonte, MG",
    rating: 5,
    text: "O atendimento na loja foi impecável. O exame de vista foi rápido e a equipe explicou direitinho cada opção de lente.",
  },
  {
    name: "Camila R.",
    city: "Curitiba, PR",
    rating: 4,
    text: "Precisei trocar o tamanho de uma haste e foi resolvido no mesmo dia. Troca fácil e sem custo.",
  },
];

export function Testimonials() {
  return (
    <section className="bg-stone-50 py-16 md:py-20">
      <Container>
        <SectionHeader
          center
          title="Quem já comprou, aprova" />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl bg-white p-7 shadow-card">
              <StarRating value={t.rating} />
              <blockquote className="mt-4 text-[15px] leading-relaxed text-stone-700">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="text-stone-500"> — {t.city}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
