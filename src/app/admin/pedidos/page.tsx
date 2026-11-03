import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pedidos — Painel admin", robots: { index: false } };

/**
 * Fase 6 — lista de pedidos para a operação. Filtros por status via query
 * (?status=PAIDªamilies). Simples e direto: a operação diária usa pouco.
 */
const STATUS_FILTERS = [
  "",
  "AWAITING_PAYMENT",
  "AWAITING_PRESCRIPTION_VALIDATION",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" && (STATUS_FILTERS as readonly string[]).includes(sp.status)
    ? sp.status
    : "";

  const orders = await db.order.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      code: true,
      status: true,
      total: true,
      createdAt: true,
      customerName: true,
      email: true,
      trackingCode: true,
      items: { select: { quantity: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Pedidos</h1>
          <p className="mt-1 text-sm text-stone-500">
            {orders.length} pedido(s){statusFilter ? " no filtro atual" : " (recentes primeiro)"}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s;
            return (
              <Link
                key={s || "todos"}
                href={s ? `/admin/pedidos?status=${s}` : "/admin/pedidos"}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-ink hover:text-ink"
                }
              >
                {s ? ORDER_STATUS_INFO[s as keyof typeof ORDER_STATUS_INFO].label : "Todos"}
              </Link>
            );
          })}
        </nav>
      </header>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Nenhum pedido neste filtro.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Pedido</th>
                <th scope="col" className="px-4 py-3">Cliente</th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">Data</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Itens</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((o) => {
                const info = ORDER_STATUS_INFO[o.status];
                const units = o.items.reduce((acc, i) => acc + i.quantity, 0);
                return (
                  <tr key={o.code} className="transition-colors hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/pedidos/${o.code}`} className="font-mono font-medium underline-offset-2 hover:underline">
                        {o.code}
                      </Link>
                      {o.trackingCode ? (
                        <span className="block text-[11px] text-stone-500">rastreio {o.trackingCode}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {o.customerName}
                      <span className="block text-[11px] text-stone-500">{o.email}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-600 sm:table-cell">{formatDate(o.createdAt)}</td>
                    <td className="hidden px-4 py-3 text-stone-600 md:table-cell">{units}</td>
                    <td className="px-4 py-3">
                      <Badge variant={info.badge}>{info.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatBRL(Number(o.total))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
