import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import { ProductForm, DeleteProductButton } from "@/components/admin/product-form";
import { Model3dManager, Model3dHint } from "@/components/admin/model-3d-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar produto — Painel admin", robots: { index: false } };

/** Fase 6/7 — edição completa do produto (variações, imagens, estoque e 3D). */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  const [product, brands, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { position: "asc" } },
        model3d: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!product || product.deletedAt) notFound();

  const activeModel = product.model3d[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/produtos" className="text-sm text-stone-500 hover:text-ink hover:underline">
            ← Produtos
          </Link>
          <h1 className="mt-1 font-serif text-2xl leading-tight lg:text-3xl">{product.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            SKU {product.sku} · <Link href={`/produtos/${product.slug}`} className="underline-offset-2 hover:underline">ver na loja</Link>
            {" · "}
            <Link href={`/provador/estudio?produto=${product.slug}`} className="underline-offset-2 hover:underline">
              experimentar
            </Link>
          </p>
        </div>
        <DeleteProductButton id={product.id} name={product.name} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <ProductForm
            product={{
              ...product,
              price: String(product.price),
              comparePrice: product.comparePrice ? String(product.comparePrice) : null,
              cost: product.cost ? String(product.cost) : null,
              variants: product.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                colorName: v.colorName,
                colorHex: v.colorHex,
                size: v.size,
                stock: v.stock,
                priceOverride: v.priceOverride ? String(v.priceOverride) : null,
              })),
              images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, isMain: i.isMain })),
            }}
            brands={brands}
            categories={categories}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
          <Model3dManager
            productId={product.id}
            slug={product.slug}
            initial={
              activeModel
                ? {
                    id: activeModel.id,
                    glbUrl: activeModel.glbUrl,
                    sizeBytes: activeModel.sizeBytes,
                    active: activeModel.active,
                    scale: activeModel.scale,
                    rotX: activeModel.rotX,
                    rotY: activeModel.rotY,
                    rotZ: activeModel.rotZ,
                    tilt: activeModel.tilt,
                    turn: activeModel.turn,
                  }
                : null
            }
          />
          <Model3dHint />
        </aside>
      </div>
    </div>
  );
}
