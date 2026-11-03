import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";

// Formas de armação → link direto para a busca filtrada da Fase 3 (?formato=)
const shapes = [
  {
    title: "Redondo",
    code: "round",
    desc: "Curvas suaves para rostos angulosos.",
    art: (
      <>
        <circle cx="32" cy="26" r="15" />
        <circle cx="88" cy="26" r="15" />
        <path d="M47 20 Q60 14 73 20" />
        <path d="M17 20 L5 13" />
        <path d="M103 20 L115 13" />
      </>
    ),
  },
  {
    title: "Quadrado",
    code: "square",
    desc: "Linhas retas alongam o rosto redondo.",
    art: (
      <>
        <rect x="14" y="13" width="32" height="25" rx="8" />
        <rect x="74" y="13" width="32" height="25" rx="8" />
        <path d="M46 18 Q60 12 74 18" />
        <path d="M14 18 L3 13" />
        <path d="M106 18 L117 13" />
      </>
    ),
  },
  {
    title: "Aviador",
    code: "aviator",
    desc: "O clássico que cai bem em quase todos.",
    art: (
      <>
        <path d="M15 18 C22 9 42 9 48 18 C49 28 42 38 31 38 C21 38 14 29 15 18 Z" />
        <path d="M105 18 C98 9 78 9 72 18 C71 28 78 38 89 38 C99 38 106 29 105 18 Z" />
        <path d="M48 15 Q60 11 72 15" />
        <path d="M15 16 L3 11" />
        <path d="M105 16 L117 11" />
      </>
    ),
  },
  {
    title: "Gatinho",
    code: "cat_eye",
    desc: "Cantos elevados alongam o olhar.",
    art: (
      <>
        <path d="M14 21 C17 11 44 11 46 21 C47 31 39 39 29 38 C19 37 12 30 14 21 Z" />
        <path d="M106 21 C103 11 76 11 74 21 C73 31 81 39 91 38 C101 37 108 30 106 21 Z" />
        <path d="M46 17 Q60 13 74 17" />
        <path d="M12 15 L2 9" />
        <path d="M108 15 L118 9" />
      </>
    ),
  },
];

export function ShapePicks() {
  return (
    <section className="border-t border-stone-100 bg-stone-50 py-16 md:py-20">
      <Container>
        <SectionHeader
          title="Ache pelo formato do rosto"
          subtitle="Qual armação fica melhor no seu formato de rosto? Comece por aqui — e refine depois por cor, material e preço."
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {shapes.map((s) => (
            <Link
              key={s.code}
              href={`/produtos?formato=${s.code}`}
              className="group rounded-2xl bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              {/* Desenho vetorial da armação (ícones próprios, sem copiar marcas) */}
              <svg
                viewBox="0 0 120 48"
                className="h-12 w-32 text-stone-700 transition-colors group-hover:text-accent-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label={`Modelo ${s.title.toLowerCase()}`}
              >
                {s.art}
              </svg>
              <h3 className="mt-4 font-serif text-lg xl:text-xl">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{s.desc}</p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
