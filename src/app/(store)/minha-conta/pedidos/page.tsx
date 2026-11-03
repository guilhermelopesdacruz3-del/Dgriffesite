import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Meus pedidos" };

/** Fase 5 — lista de pedidos do cliente logado, mais recentes primeiro. */
export default async function MyOrdersPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      code: true,
      status: true,
      total: true,
      createdAt: true,
      trackingCode: true,
      items: { select: { productName: true, quantity: true } },
    },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
        <p className="font-serif text-xl">Você ainda não fez pedidos</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Encontre sua armação no catálogo — e experimente no provador virtual antes.
        </p>
        <Button href="/produtos" variant="soft" className="mt-6">
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl leading-tight">Meus pedidos</h1>

      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
        {orders.map((order) => {
          const info = ORDER_STATUS_INFO[order.status];
          const units = order.items.reduce((acc, item) => acc + item.quantity, 0);
          const firstItem = order.items[0]?.productName;
          return (
            <li key={order.code}>
              <Link
                href={`/pedido/${order.code}`}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-stone-50"
              >
                <div className="min-w-40">
                  <p className="font-mono text-sm font-semibold">{order.code}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(order.createdAt)}</p>
                </div>

                <div className="min-w-56 flex-1 text-sm text-stone-600">
                  <p className="truncate">
                    {firstItem}
                    {order.items.length > 1 ? ` +${order.items.length - 1} outro(s)` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {units} {units === 1 ? "item" : "itens"}
                    {order.trackingCode ? ` · Rastreio ${order.trackingCode}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={info.badge}>{info.label}</Badge>
                  <span className="font-medium">{formatBRL(Number(order.total))}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
