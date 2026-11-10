import { db } from "@/lib/db";
import { LensManager, type LensRow } from "@/components/admin/lens-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lentes — Painel admin", robots: { index: false } };

/** Fase 13 — lentes vendidas junto com armações de grau (preço/tipos editáveis). */
export default async function AdminLensesPage() {
  const lenses = await db.lensPackage.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      active: true,
      sortOrder: true,
    },
  });

  const rows: LensRow[] = lenses.map((l) => ({
    ...l,
    price: String(l.price),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Lentes</h1>
        <p className="mt-1 text-sm text-stone-500">
          Pacotes vendidos com os óculos de grau (ou avulsos). O cliente escolhe uma por item no checkout.
        </p>
      </header>

      <LensManager rows={rows} />
      <p className="text-xs text-stone-400">
        O preço é revalidado no banco no momento do pedido. Lentes com pedido registrado não são apagadas (histórico) — viram “inativas”.
      </p>
    </div>
  );
}
