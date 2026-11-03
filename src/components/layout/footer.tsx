import Link from "next/link";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ReabrirConsentimento } from "@/components/lgpd/cookie-consent";
import { storeConfig } from "@/lib/config";

// Rodapé completo: institucional, atendimento, redes, pagamentos e legal.
const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Institucional",
    links: [
      { label: "Sobre nós", href: "/paginas/sobre" },
      { label: "Lojas físicas", href: "/paginas/lojas" },
      { label: "Como funciona o provador", href: "/paginas/provador" },
      { label: "Trabalhe com a gente", href: "/paginas/contato" },
    ],
  },
  {
    title: "Atendimento",
    links: [
      { label: "Central de ajuda (FAQ)", href: "/paginas/faq" },
      { label: "Envio e prazos", href: "/paginas/faq" },
      { label: "Política de trocas", href: "/paginas/politica-de-trocas" },
      { label: "Agendar exame de vista", href: "/paginas/contato" },
    ],
  },
];

const socialIcons = [Instagram, Facebook, Youtube];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-stone-50">
      <Container className="grid grid-cols-1 gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        {/* Marca + redes */}
        <div className="lg:col-span-2">
          <p className="font-serif text-2xl tracking-tight">
            {storeConfig.shortName}
            <span className="text-accent-600">.</span>
          </p>
          <p className="mt-3 max-w-sm text-sm text-stone-500">{storeConfig.tagline}</p>

          <ul className="mt-5 space-y-2 text-sm text-stone-600">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="shrink-0 text-stone-400" aria-hidden />
              {storeConfig.legalAddress}
            </li>
            <li className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-stone-400" aria-hidden />
              {storeConfig.contact.phone}
            </li>
            <li className="flex items-center gap-2">
              <Mail size={16} className="shrink-0 text-stone-400" aria-hidden />
              {storeConfig.contact.email}
            </li>
          </ul>

          <div className="mt-5 flex gap-3">
            {storeConfig.social.map((s, i) => {
              const Icon = socialIcons[i] ?? Instagram;
              return (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.name}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-ink hover:text-ink"
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>

        {/* Colunas de links */}
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
              {col.title}
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-500">
              {col.links.map((l) => (
                <li key={l.label + l.href}>
                  <Link href={l.href} className="transition-colors hover:text-accent-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Legal / LGPD (fase 9): links + revogação de cookies no próprio rodapé */}
        <nav aria-label="Legal e LGPD">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
            Legal / LGPD
          </h3>
          <ul className="space-y-2.5 text-sm text-stone-500">
            <li>
              <Link href="/paginas/politica-de-privacidade" className="transition-colors hover:text-accent-600">
                Política de privacidade
              </Link>
            </li>
            <li>
              <Link href="/paginas/termos" className="transition-colors hover:text-accent-600">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link href="/minha-conta/dados" className="transition-colors hover:text-accent-600">
                Meus dados (LGPD)
              </Link>
            </li>
            <li>
              <ReabrirConsentimento />
              <p className="mt-1 text-[11px] text-stone-400">revogue ou atualize quando quiser</p>
            </li>
          </ul>
        </nav>
      </Container>

      {/* Faixa de pagamentos */}
      <Container>
        <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 py-5 text-xs text-stone-500">
          <span className="font-semibold uppercase tracking-wide text-stone-600">Pagamento</span>
          {["Pix", "Cartão em até 6x", "Boleto"].map((m) => (
            <span key={m} className="rounded-full border border-stone-300 bg-white px-3 py-1">
              {m}
            </span>
          ))}
        </div>
      </Container>

      {/* Legal */}
      <div className="border-t border-stone-200">
        <Container className="py-6 text-center text-xs text-stone-400 md:text-left">
          © {new Date().getFullYear()} {storeConfig.legalName} — CNPJ {storeConfig.cnpj}. Todos os direitos reservados.
          • Dados protegidos pela LGPD (Lei 13.709/2018).
        </Container>
      </div>
    </footer>
  );
}
