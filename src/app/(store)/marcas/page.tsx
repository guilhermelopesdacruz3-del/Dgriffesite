import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

// No build estático (ZIP de demo), scripts/build-demo-zip.mjs troca esta
// linha para "force-static" (fallbacks embutidos).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marcas",
  description: "Marcas de armações e óculos de sol parceiras.",
};

async function Brands() {
  // Fallback: mesmo que o seed não tenha rodado, exibe as marcas cadastradas
  // no código (a versão do banco trará contagem real de produtos).
  const fallback = ["Atelier Óptico", "Verano", "Lumen", "Órbita", "Nordica", "Cristalina", "Maré", "Andino"];

  let brands: { name: string; slug: string; count: number | null }[] = fallback.map((n) => ({
    name: n,
    slug: slugify(n),
    count: null,
  }));

  try {
    const rows = await db.brand.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { active: true, deletedAt: null } } } } },
    });
    if (rows.length) {
      brands = rows.map((b) => ({
        name: b.name,
        slug: b.slug,
        count: b._count.products,
      }));
    }
  } catch {
    // banco indisponível — usa o fallback acima
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {brands.length === 0 && (
        <p className="text-sm text-stone-500">
          Marcas serão exibidas após rodar o seed do banco.
        </p>
      )}
      {brands.map((b) => (
        <Link
          key={b.slug}
          href={`/produtos?marca=${b.slug}`}
          className="group flex items-center justify-between rounded-2xl border border-stone-200 px-6 py-5 transition-colors hover:border-accent-600"
        >
          <span className="font-serif text-xl group-hover:text-accent-700">{b.name}</span>
          <span className="text-sm text-stone-500">
            {b.count === null ? "ver modelos" : `${b.count} modelos`}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function BrandsPage() {
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Marcas" }]} />
      <div className="mt-4 mb-8">
        <SectionHeader
          title="Marcas parceiras"
          subtitle="Trabalhamos com fabricantes independentes e marcas de confiança para diferentes estilos e bolsos."
        />
      </div>
      <Brands />
    </Container>
  );
}
