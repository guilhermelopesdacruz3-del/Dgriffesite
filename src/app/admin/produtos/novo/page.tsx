import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Novo produto — Painel admin", robots: { index: false } };

/** Fase 6 — cadastro de produto (formulário completo). */
export default async function NewProductPage() {
  await requireAdminPage();

  const [brands, categories] = await Promise.all([
    db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Novo produto</h1>
        <p className="mt-1 text-sm text-stone-500">
          Cadastre a armação, as cores e o estoque. “Principal” define a foto do card.
        </p>
      </header>

      <div className="max-w-3xl">
        <ProductForm product={null} brands={brands} categories={categories} />
      </div>
    </div>
  );
}
