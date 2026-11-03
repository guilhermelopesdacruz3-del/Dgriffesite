import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";

// Categorias em destaque (cards grandes com imagem務)
const categories = [
  { title: "Óculos de grau", desc: "Armações para o dia a dia", href: "/produtos?tipo=grau", img: "https://picsum.photos/seed/otica-cat-grau/900/1100" },
  { title: "Óculos de sol", desc: "Proteção UV com estilo", href: "/produtos?tipo=sol", img: "https://picsum.photos/seed/otica-cat-sol/900/1100" },
  { title: "Infantil", desc: "Leves, resistentes e coloridos", href: "/produtos?publico=infantil", img: "https://picsum.photos/seed/otica-cat-kids/900/1100" },
  { title: "Esportivo", desc: "Desempenho na medida", href: "/produtos?tipo=esportivo", img: "https://picsum.photos/seed/otica-cat-sport/900/1100" },
];

export function CategoryCards() {
  return (
    <section className="py-16 md:py-20">
      <Container>
        <SectionHeader
          title="Escolha por categoria"
          subtitle="Cada rosto e cada rotina pede um modelo. Comece por onde você mais usa."
        />
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              href={cat.href}
              className="group relative block overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <div className="relative aspect-[4/5]">
                <Image
                  src={cat.img}
                  alt={cat.title}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
              </div>
              <div className="absolute bottom-0 left-0 p-5 text-white">
                <h3 className="font-serif text-xl md:text-2xl">{cat.title}</h3>
                <p className="text-sm text-white/80">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
