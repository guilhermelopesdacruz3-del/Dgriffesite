import Link from "next/link";
import { auth } from "@/auth";
import { Hero } from "@/components/home/hero";
import { storeConfig } from "@/lib/config";
import { serializeJsonLd } from "@/lib/utils";
import { CategoryCards } from "@/components/home/category-cards";
import { ProductCarousel } from "@/components/home/product-carousel";
import { TryOnBanner } from "@/components/home/tryon-banner";
import { ShapePicks } from "@/components/home/shape-picks";
import { BrandStrip } from "@/components/home/brand-strip";
import { TrustSection } from "@/components/home/trust-section";
import { ScheduleSection } from "@/components/home/schedule-section";
import { Testimonials } from "@/components/home/testimonials";
import { Newsletter } from "@/components/home/newsletter";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { getBestSellers } from "@/lib/content";
import { getFavoriteSlugs } from "@/lib/catalog";

// Página inicial (Fase 1: seções com conteúdo do banco + fallbacks).
// Fase 9: revisão final de SEO (JSON-LD) e LGPD.
export default async function HomePage() {
  // Favoritos da conta (Fase 5): pré-acende o coração no carrossel
  const session = await auth();
  const bestSellers = await getBestSellers();
  const favoriteSlugs = session?.user?.id
    ? Array.from(await getFavoriteSlugs(session.user.id))
    : [];

  // Dados estruturados: identidade da loja para o Google understands
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${storeConfig.siteUrl}/#org`,
        name: storeConfig.legalName,
        alternateName: storeConfig.name,
        url: storeConfig.siteUrl,
        email: storeConfig.contact.email,
        telephone: storeConfig.contact.phone,
        logo: `${storeConfig.siteUrl}/icon.svg`,
        sameAs: storeConfig.social.map((s) => s.href),
      },
      {
        "@type": "WebSite",
        "@id": `${storeConfig.siteUrl}/#site`,
        url: storeConfig.siteUrl,
        name: storeConfig.name,
        inLanguage: "pt-BR",
        publisher: { "@id": `${storeConfig.siteUrl}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${storeConfig.siteUrl}/produtos?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      ...storeConfig.stores.map((st) => ({
        "@type": "LocalBusiness",
        name: st.name,
        image: `${storeConfig.siteUrl}/icon.svg`,
        telephone: st.phone,
        address: {
          "@type": "PostalAddress",
          streetAddress: st.address,
          addressLocality: st.city,
          addressCountry: "BR",
        },
        openingHours: st.hours,
        parentOrganization: { "@id": `${storeConfig.siteUrl}/#org` },
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {/* 1-3. Anúncio + header ficam no layout; aqui começa o hero */}
      <Hero />

      {/* 4. Categorias em destaque */}
      <CategoryCards />

      {/* 5. Carrossel "Mais vendidos" */}
      <section className="py-16 md:py-20">
        <Container>
          <SectionHeader
            title="Mais vendidos"
            subtitle="Os favoritos dos nossos clientes — com provador virtual nos modelos 3D."
            action={
              <Button href="/produtos" variant="outline">
                Ver tudo
              </Button>
            }
          />
          <ProductCarousel products={bestSellers} favoriteSlugs={favoriteSlugs} />
        </Container>
      </section>

      {/* 6. Banner do provador virtual em 3 passos */}
      <TryOnBanner />

      {/* 7. Seleção por formato/estilo */}
      <ShapePicks />

      {/* 8. Marcas parceiras */}
      <BrandStrip />

      {/* 9. Selos de confiança */}
      <TrustSection />

      {/* 10. Agendamento de exame / contato com a loja */}
      <ScheduleSection />

      {/* 11. Depoimentos */}
      <Testimonials />

      {/* 12. Newsletter + cupom de primeira compra */}
      <Newsletter />

      {/* 13. Footer fica no layout */}
      <div className="pb-10 text-center text-sm text-stone-400">
        <Link href="/paginas/sobre" className="underline-offset-4 hover:underline">
          Conheça a nossa história →
        </Link>
      </div>
    </>
  );
}
