import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductTop } from "@/components/catalog/product-top";
import { GENDER_INFO } from "@/lib/filters";
import { fallbackProducts, getProductBySlug, getFavoriteSlugs, getRelatedProducts } from "@/lib/catalog";
import { storeConfig } from "@/lib/config";
import { serializeJsonLd } from "@/lib/utils";

/**
 * Página do produto (PDP): galeria, variação de cor/tamanho, descrição,
 * especificações (medidas reais de armação), frete/garantia, produtos
 * relacionados e dados estruturados schema.org/Product.
 */

interface PageProps {
  // Next 15: params chega como Promise
  params: Promise<{ slug: string }>;
}

// Build estático (ZIP de demo): pré-renderiza os 8 produtos demonstrativos.
// Com servidor, a lista vazia mantém a PDP dinâmica como hoje.
export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT === "1") {
    return fallbackProducts.map((p) => ({ slug: p.slug }));
  }
  return [];
}

const TYPE_LABELS: Record<string, string> = {
  FRAMES: "Armação de grau",
  SUNGLASSES: "Óculos de sol",
  CONTACT_LENSES: "Lentes de contato",
  ACCESSORIES: "Acessório",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  const title = product.seoTitle ?? `${product.brand.name} ${product.name}`;
  const description =
    product.seoDescription ??
    product.shortDescription ??
    product.description.slice(0, 150);

  return {
    title,
    description,
    openGraph: {
      title: `${title} | ${storeConfig.name}`,
      description,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Favoritos da conta (Fase 5): pré-acende o coração nos "Combina com"
  const session = await auth();
  const favoriteSlugs = session?.user?.id
    ? await getFavoriteSlugs(session.user.id)
    : new Set<string>();

  const related = await getRelatedProducts(
    product.slug,
    product.category.slug,
    product.brand.slug,
    4,
  );

  const specs = [
    { label: "Material", value: product.material },
    {
      label: "Medidas",
      // formato óptico padrão: largura da lente, ponte e haste em mm
      value:
        product.lensWidth && product.bridge && product.temple
          ? `${product.lensWidth}-${product.bridge}-${product.temple} mm`
          : null,
    },
    { label: "Peso", value: product.weight ? `${product.weight} g` : null },
    { label: "Público", value: GENDER_INFO[product.gender] },
    { label: "Tipo", value: TYPE_LABELS[product.type] },
    { label: "Referência", value: product.sku },
  ].filter((s) => s.value);

  // schema.org/Product para Google Shopping / resultados enriquecidos
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.brand.name} ${product.name}`,
    description: product.shortDescription ?? product.description,
    sku: product.sku,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: product.brand.name },
    offers: {
      "@type": "Offer",
      url: `${storeConfig.siteUrl}/produtos/${product.slug}`,
      priceCurrency: "BRL",
      price: product.price.toFixed(2),
      availability:
        product.variants.some((v) => v.stock > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <Container className="py-8 md:py-12">
      {/* Dados estruturados */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Produtos", href: "/produtos" },
          {
            label: product.category.name,
            href: `/produtos?categoria=${product.category.slug}`,
          },
          { label: product.name },
        ]}
      />

      <div className="mt-6">
        <ProductTop product={product} />
      </div>

      {/* Descrição + especificações */}
      <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="desc-titulo">
          <h2 id="desc-titulo" className="font-serif text-2xl">
            Descrição
          </h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-stone-600">
            {product.description}
          </p>
        </section>

        <section aria-labelledby="spec-titulo">
          <h2 id="spec-titulo" className="font-serif text-2xl">
            Especificações
          </h2>
          <dl className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {specs.map((s) => (
              <div
                key={s.label}
                className="flex items-baseline justify-between gap-4 px-5 py-3.5 text-sm"
              >
                <dt className="text-stone-500">{s.label}</dt>
                <dd className="text-right font-medium text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="rel-titulo">
          <SectionHeader
            title="Combina com"
            subtitle="Modelos do mesmo estilo que também valem o teste no provador virtual."
          />
          <div className="mt-2 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} favorite={favoriteSlugs.has(p.slug)} priority={i < 1} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
