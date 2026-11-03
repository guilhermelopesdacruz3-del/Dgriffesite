import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { getPage } from "@/lib/content";
import { ContentBlocks } from "@/components/ui/content-blocks";
import { storeConfig } from "@/lib/config";

// No build estático (ZIP de demo), scripts/build-demo-zip.mjs troca esta
// linha para "force-static"; páginas CMS exigem servidor no deploy normal.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

// Export estático: nenhuma página CMS é gerada (exigem banco/servidor).
export async function generateStaticParams() {
  return [];
}

// Página institucional genérica editável pelo admin (tabela Page, markdown).
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Página não encontrada" };
  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
  };
}

export default async function InstitutionalPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: page.title }]} />

      <article className="mt-6 max-w-3xl">
        <h1 className="font-serif text-4xl leading-tight md:text-5xl">{page.title}</h1>

        {/* Páginas especiais ganham blocos extras dinâmicos */}
        {slug === "politica-de-privacidade" && (
          <section className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <h2 className="font-serif text-lg">Cookies e consentimento</h2>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              <li>
                <strong className="text-ink">Essenciais (sempre ativos):</strong>{" "}
                sessão de login (NextAuth), carrinho e favoritos — necessários para
                a loja funcionar e não seguem você pela internet.
              </li>
              <li>
                <strong className="text-ink">Análise (opcional):</strong> métricas
                anônimas de uso para melhorar o catálogo. Só liga com o seu
                consentimento.
              </li>
              <li>
                <strong className="text-ink">Marketing (opcional):</strong>{" "}
                remarketing e mídia paga. Só liga com o seu consentimento.
              </li>
            </ul>
            <p className="mt-3 text-sm text-stone-600">
              A escolha fica salva no seu navegador e você pode revogar quando
              quiser no rodapé (<em>Preferências de cookies</em>) — sem afetar a
              sua conta nem os pedidos. Aprovamos o banner <em>antes</em> de
              qualquer script opcional carregar.
            </p>
          </section>
        )}
        {slug === "contato" && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Central de atendimento
              </h2>
              <p className="mt-2 text-sm">{storeConfig.contact.phone}</p>
              <p className="text-sm">{storeConfig.contact.email}</p>
              <p className="mt-1 text-sm text-stone-500">{storeConfig.contact.hours}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                WhatsApp
              </h2>
              <p className="mt-2 text-sm">
                <a
                  href={`https://wa.me/${storeConfig.contact.whatsapp}`}
                  className="text-accent-700 underline-offset-4 hover:underline"
                >
                  {storeConfig.contact.whatsappDisplay}
                </a>
              </p>
            </div>
          </section>
        )}

        {slug === "lojas" && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            {storeConfig.stores.map((st) => (
              <div key={st.name} className="rounded-2xl border border-stone-200 p-5">
                <h2 className="font-serif text-lg">{st.name}</h2>
                <p className="mt-1 text-sm text-stone-600">{st.address}</p>
                <p className="text-sm text-stone-600">{st.city}</p>
                <p className="mt-2 text-sm">{st.phone}</p>
                <p className="text-sm text-stone-500">{st.hours}</p>
              </div>
            ))}
          </section>
        )}

        <div className="mt-10">
          <ContentBlocks markdown={page.content} />
        </div>
      </article>
    </Container>
  );
}
