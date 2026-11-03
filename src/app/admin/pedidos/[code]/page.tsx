import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { PrescriptionReview } from "@/components/admin/prescription-review";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pedido — Painel admin", robots: { index: false } };

/**
 * Fase 6 — detalhe do pedido na operação: cliente, itens, entrega, pagamento
 * e o formulário de status/rastreio.
 */
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const order = await db.order.findUnique({
    where: { code },
    include: {
      items: {
        select: {
          productName: true,
          variantSku: true,
          snapshot: true,
          quantity: true,
          unitPrice: true,
          withLenses: true,
          lensPackageSnapshot: true,
          lensPackage: { select: { name: true, price: true } },
          prescription: { select: { id: true, fileName: true, status: true, notes: true, createdAt: true } },
          product: { select: { slug: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } },
        },
      },
      payments: { take: 1, select: { method: true, status: true, providerPaymentId: true, provider: true } },
      shipment: { select: { carrier: true, serviceName: true, trackingCode: true, status: true } },
    },
  });
  if (!order) notFound();

  const info = ORDER_STATUS_INFO[order.status];
  /** Receitas desse pedido (dedupe — a mesma receita pode servir 2 itens). */
  const receitas = [
    ...new Map(order.items.filter((i) => i.prescription).map((i) => [i.prescription!.id, i.prescription!])).values(),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/pedidos" className="text-sm text-stone-500 hover:text-ink hover:underline">
            ← Pedidos
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{order.code}</h1>
          <p className="text-sm text-stone-500">{formatDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <Badge variant={info.badge}>{info.label}</Badge>
          <p className="mt-2 font-serif text-2xl">{formatBRL(Number(order.total))}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Itens + entrega + pagamento */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-6" aria-label="Itens do pedido">
            <h2 className="font-serif text-lg">Itens</h2>
            <ul className="mt-4 divide-y divide-stone-100">
              {order.items.map((item, i) => {
                const snap = item.snapshot as {
                  name?: string;
                  brand?: string;
                  color?: string | null;
                  size?: string | null;
                  image?: string | null;
                };
                const label = item.productName || snap.name || "Item";
                const img = item.product?.images[0]?.url ?? snap.image ?? null;
                const detail = [
                  item.variantSku ?? null,
                  snap.color ?? null,
                  snap.size ?? null,
                ].filter(Boolean).join(" · ");
                const lens = item.lensPackageSnapshot as { name?: string; price?: number } | null;
                const lensPrice = lens ? Number(lens.price ?? 0) : 0;
                return (
                <li key={`${label}-${i}`} className="flex items-center gap-4 py-4">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {img ? (
                      <Image src={img} alt="" fill sizes="44px" className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-stone-500">
                      {item.quantity} × {formatBRL(Number(item.unitPrice))}
                      {lensPrice > 0 ? ` + lentes ${formatBRL(lensPrice)}` : ""}
                      {detail ? ` · ${detail}` : ""}
                      {lens?.name ? ` · ${lens.name}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatBRL((Number(item.unitPrice) + lensPrice) * item.quantity)}
                  </span>
                </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-stone-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Subtotal</dt>
                <dd>{formatBRL(Number(order.subtotal))}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                  <dd>-{formatBRL(Number(order.discount))}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-stone-500">Frete</dt>
                <dd>{Number(order.shippingCost) === 0 ? "Grátis" : formatBRL(Number(order.shippingCost))}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd>{formatBRL(Number(order.total))}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-accent-600/40 bg-accent-50/40 p-6" aria-label="Receitas do pedido">
            <h2 className="font-serif text-lg">Receita de óculos</h2>
            {receitas.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">Este pedido não tem lentes de grau.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {receitas.map((r) => (
                  <PrescriptionReview
                    key={r.id}
                    receita={{
                      id: r.id,
                      fileName: r.fileName,
                      status: r.status as "PENDING" | "VALIDATED" | "REJECTED",
                      notes: r.notes,
                      createdAt: r.createdAt,
                    }}
                  />
                ))}
                <p className="text-[11px] text-stone-500">
                  Validar → o pedido sai da fila "receita em análise" e vai para
                  preparo. Recusar → pedido cancelado (contato pelo WhatsApp).
                </p>
              </div>
            )}
          </section>

          <OrderStatusForm code={order.code} status={order.status} trackingCode={order.trackingCode} />
        </div>

        {/* Cliente + entrega + pagamento */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-6" aria-label="Cliente">
            <h2 className="font-serif text-lg">Cliente</h2>
            <p className="mt-3 text-sm">
              {order.customerName}
              <span className="block text-stone-500">{order.email}</span>
              <span className="block text-stone-500">{order.customerPhone}</span>
            </p>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6" aria-label="Entrega">
            <h2 className="font-serif text-lg">Entrega</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              {order.shipStreet}, {order.shipNumber}
              {order.shipComplement ? ` — ${order.shipComplement}` : ""}
              <br />
              {order.shipDistrict} — {order.shipCity}/{order.shipState}
              <br />
              CEP {order.shipCep}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Método: {order.shippingMethod}
              {order.shippingService ? ` · ${order.shippingService}` : ""}
              {order.shippingDeadline ? ` · ${order.shippingDeadline} dias úteis` : ""}
            </p>
            {order.shipment?.trackingCode ? (
              <p className="mt-2 text-xs text-stone-500">
                Rastreio: <span className="font-mono">{order.shipment.trackingCode}</span>
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6" aria-label="Pagamento">
            <h2 className="font-serif text-lg">Pagamento</h2>
            {(() => {
              const payment = order.payments[0] ?? null;
              if (!payment) {
                return <p className="mt-3 text-sm text-stone-500">Aguardando registro do pagamento.</p>;
              }
              return (
                <p className="mt-3 text-sm text-stone-600">
                  {payment.method}
                  <span className="block text-stone-500">
                    Gateway: {payment.provider}
                    {payment.providerPaymentId ? ` · id ${payment.providerPaymentId}` : ""}
                  </span>
                  <span className="block font-medium">{payment.status}</span>
                </p>
              );
            })()}
          </section>
        </div>
      </div>
    </div>
  );
}
