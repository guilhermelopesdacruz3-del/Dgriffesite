import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CouponManager, type CouponRow } from "@/components/admin/coupon-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cupons — Painel admin", robots: { index: false } };

/** Fase 6 — cupons de desconto (criar, editar, desativar). */
export default async function AdminCouponsPage() {
  const coupons = await db.coupon.findMany({
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      minOrder: true,
      maxUses: true,
      usedCount: true,
      endsAt: true,
      active: true,
    },
  });

  const rows: CouponRow[] = coupons.map((c) => ({
    ...c,
    value: String(c.value),
    minOrder: c.minOrder ? String(c.minOrder) : null,
    endsAt: c.endsAt ? c.endsAt.toISOString().slice(0, 10) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Cupons</h1>
        <p className="mt-1 text-sm text-stone-500">
          Desconto percentual ou fixo. O checkout aplica um cupom por pedido.
        </p>
      </header>

      <CouponManager rows={rows} />
      <p className="text-xs text-stone-400">
        Cupons com uso registrado não são apagados (histórico) — viram “inativos”.
      </p>
    </div>
  );
}
