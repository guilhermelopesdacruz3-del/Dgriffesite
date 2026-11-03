import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Package,
  PackagePlus,
  ReceiptText,
  ScanFace,
  TicketPercent,
  Wallet,
  Boxes,
  Undo2,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard — Painel admin", robots: { index: false } };

/** Status que contam como receita confirmada (pagamento liquidado na loja). */
const STATUS_PAGOS = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;
/** Fase 6 — visão geral: pedidos, receita, produtos, estoque baixo e provador.
 *  Fase 11a — bloco "Financeiro": faturamento, ticket médio, em aberto,
 *  reembolsos e gráfico de receita dos últimos 14 dias (tudo do próprio banco). */
export default async function AdminDashboardPage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    ordersByStatus,
    productCount,
    lowStockVariants,
    recentOrders,
    tryOnOpens,
    tryOn7d,
    pagos30d,
  ] = await Promise.all([
    // Uma única consulta: valor somado e nº de pedidos por status
    db.order.groupBy({ by: ["status"], _sum: { total: true }, _count: { status: true } }),
    db.product.count({ where: { deletedAt: null } }),
    db.productVariant.findMany({
      where: { stock: { lte: 3 }, active: true },
      orderBy: { stock: "asc" },
      take: 6,
      select: {
        id: true,
        stock: true,
        colorName: true,
        product: { select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } },
      },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { code: true, status: true, total: true, createdAt: true, customerName: true },
    }),
    db.tryOnEvent.count({ where: { event: "OPENED" } }),
    db.tryOnEvent.count({ where: { event: "OPENED", createdAt: { gte: since } } }),
    db.order.findMany({
      where: { paidAt: { gte: since30 }, status: { in: [...STATUS_PAGOS] } },
      select: { paidAt: true, total: true },
    }),
  ]);
  // ---- Financeiro: derivados da agregação por status ----
  const somaPor = (st: readonly string[]) =>
    ordersByStatus
      .filter((r) => st.includes(r.status))
      .reduce((acc, r) => acc + Number(r._sum.total ?? 0), 0);
  const qtdPor = (st: readonly string[]) =>
    ordersByStatus.filter((r) => st.includes(r.status)).reduce((acc, r) => acc + r._count.status, 0);

  const faturamento = somaPor(STATUS_PAGOS);
  const pedidosPagos = qtdPor(STATUS_PAGOS);
  const ticketMedio = pedidosPagos > 0 ? faturamento / pedidosPagos : 0;
  const emAberto = somaPor(["AWAITING_PAYMENT"]);
  const emAbertoQtd = qtdPor(["AWAITING_PAYMENT"]);
  const reembolsado = somaPor(["REFUNDED"]);
  const reembolsosQtd = qtdPor(["REFUNDED"]);
  const faturamento30d = pagos30d.reduce((acc, o) => acc + Number(o.total), 0);

  // Barras dos últimos 14 dias (agrupado em memória — volume de uma ótica é baixo)
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    return { label: d.toLocaleDateString("pt-BR", { day: "2-digit" }), total: 0 };
  });
  const diaMs = 24 * 60 * 60 * 1000;
  const baseDia = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 13);
    return d.getTime();
  })();
  for (const o of pagos30d) {
    if (!o.paidAt) continue;
    const idx = Math.round((new Date(o.paidAt).setHours(0, 0, 0, 0) - baseDia) / diaMs);
    if (idx < 0 || idx > 13) continue; // fora da janela do gráfico
    dias[idx].total += Number(o.total);
  }
  const diaMax = Math.max(...dias.map((d) => d.total), 1);

  const statusCount = new Map(ordersByStatus.map((r) => [r.status, r._count.status]));
  const pending = (statusCount.get("AWAITING_PAYMENT") ?? 0) + (statusCount.get("AWAITING_PRESCRIPTION_VALIDATION") ?? 0);
  const active = (statusCount.get("PAID") ?? 0) + (statusCount.get("PREPARING") ?? 0) + (statusCount.get("SHIPPED") ?? 0);
  const toPrepare = statusCount.get("PAID") ?? 0; // pagos aguardando envio
  const lowStockCount = await db.productVariant.count({ where: { stock: { lte: 3 }, active: true } });

  const kpis = [
    {
      label: "Pedidos em aberto",
      value: String(pending),
      hint: "pagamento/receita pendentes",
      icon: ReceiptText,
    },
    {
      label: "Pedidos ativos",
      value: String(active),
      hint: "pagos/em preparação/enviados",
      icon: Package,
    },
    {
      label: "Receita confirmada",
      value: formatBRL(faturamento),
      hint: `${pedidosPagos} pedidos pagos`,
      icon: Wallet,
    },
    {
      label: "Provador aberto",
      value: String(tryOnOpens),
      hint: `${tryOn7d} nos últimos 7 dias`,
      icon: ScanFace,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Visão geral da operação — {productCount} produtos cadastrados.</p>
      </header>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{k.label}</p>
              <k.icon size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
            </div>
            <p className="mt-3 font-serif text-2xl">{k.value}</p>
            <p className="mt-1 text-xs text-stone-500">{k.hint}</p>
          </div>
        ))}
      </section>

      {/* Finanças — números do dinheiro: faturado, a receber, devolvido e ritmo diário */}
      <section aria-label="Financeiro" className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <Wallet size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          Financeiro
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Faturamento</p>
              <Banknote size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
            </div>
            <p className="mt-3 font-serif text-2xl">{formatBRL(faturamento)}</p>
            <p className="mt-1 text-xs text-stone-500">confirmado · {formatBRL(faturamento30d)} nos últimos 30 dias</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">A receber</p>
              <ReceiptText size={18} className="text-amber-600" strokeWidth={1.7} aria-hidden />
            </div>
            <p className="mt-3 font-serif text-2xl">{formatBRL(emAberto)}</p>
            <p className="mt-1 text-xs text-stone-500">
              {emAbertoQtd > 0 ? (
                <Link href="/admin/pedidos?status=AWAITING_PAYMENT" className="text-accent-700 hover:underline">
                  {emAbertoQtd} pedido(s) aguardando pagamento — ver
                </Link>
              ) : (
                "nenhum pedido aguardando pagamento"
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Ticket médio</p>
              <Package size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
            </div>
            <p className="mt-3 font-serif text-2xl">{formatBRL(ticketMedio)}</p>
            <p className="mt-1 text-xs text-stone-500">por pedido pago ({pedidosPagos} no total)</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Reembolsos</p>
              <Undo2 size={18} className="text-stone-400" strokeWidth={1.7} aria-hidden />
            </div>
            <p className="mt-3 font-serif text-2xl">{formatBRL(reembolsado)}</p>
            <p className="mt-1 text-xs text-stone-500">{reembolsosQtd > 0 ? `${reembolsosQtd} pedido(s) devolvido(s)` : "nada devolvido até hoje"}</p>
          </div>
        </div>

        {/* Receita por dia — barras em CSS puro (sem dependências) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Receita por dia — últimos 14 dias</p>
            <span className="text-xs text-stone-400">máx. {formatBRL(diaMax)}</span>
          </div>
          <div className="mt-4 flex items-end gap-1.5" style={{ height: 96 }}>
            {dias.map((d) => {
              const h = Math.max(4, Math.round((d.total / diaMax) * 88));
              return (
                <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${formatBRL(d.total)}`}>
                  <div className="w-full rounded-t bg-accent-200" style={{ height: d.total > 0 ? h : 3 }} />
                  <span className="truncate text-[10px] text-stone-400">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ações rápidas — a "cara" diária do painel */}
      <section aria-label="Ações rápidas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/pedidos?status=PAID"
          className="group rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-accent-600"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Pedidos para preparar</p>
            <ReceiptText size={17} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          </div>
          <p className="mt-3 font-serif text-2xl">{toPrepare}</p>
          <p className="mt-1 text-xs text-stone-500 group-hover:text-ink">
            pagos aguardando envio — abrir com um toque
          </p>
        </Link>
        <Link
          href="/admin/produtos/novo"
          className="group rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-accent-600"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cadastrar produto</p>
            <PackagePlus size={17} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          </div>
          <p className="mt-3 font-serif text-2xl">Novo</p>
          <p className="mt-1 text-xs text-stone-500 group-hover:text-ink">
            armações, cores, estoque e imagens
          </p>
        </Link>
        <Link
          href="/admin/produtos"
          className="group rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-accent-600"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Estoque baixo</p>
            <Boxes size={17} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          </div>
          <p className={`mt-3 font-serif text-2xl ${lowStockCount > 0 ? "text-amber-600" : ""}`}>{lowStockCount}</p>
          <p className="mt-1 text-xs text-stone-500 group-hover:text-ink">
            {lowStockCount > 0 ? "variações para repor — ver na lista" : "tudo em nível saudável"}
          </p>
        </Link>
        <Link
          href="/admin/cupons"
          className="group rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-accent-600"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Campanha de cupom</p>
            <TicketPercent size={17} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          </div>
          <p className="mt-3 font-serif text-2xl">Criar</p>
          <p className="mt-1 text-xs text-stone-500 group-hover:text-ink">
            desconto % ou valor fixo, com validade
          </p>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Últimos pedidos */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-2" aria-label="Últimos pedidos">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Últimos pedidos</h2>
            <Link href="/admin/pedidos" className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline">
              Ver todos <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">
              Nenhum pedido ainda. Quando a loja vender, eles aparecem aqui para você acompanhar.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {recentOrders.map((o) => {
                const info = ORDER_STATUS_INFO[o.status];
                return (
                  <li key={o.code}>
                    <Link href={`/admin/pedidos/${o.code}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-stone-50">
                      <div>
                        <p className="font-mono text-sm font-medium">{o.code}</p>
                        <p className="text-xs text-stone-500">
                          {o.customerName} · {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={info.badge}>{info.label}</Badge>
                        <span className="text-sm font-medium">{formatBRL(Number(o.total))}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Estoque baixo */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6" aria-label="Estoque baixo">
          <h2 className="flex items-center gap-2 font-serif text-lg">
            <AlertTriangle size={17} className="text-amber-600" aria-hidden />
            Estoque baixo
          </h2>
          {lowStockVariants.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Nenhuma variação com estoque ≤ 3. 👍</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {lowStockVariants.map((v) => (
                <li key={v.product.slug + (v.colorName ?? "")} className="flex items-center gap-3">
                  <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {v.product.images[0] ? (
                      <Image src={v.product.images[0].url} alt="" fill sizes="36px" className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/produtos/${v.product.id}`} className="block truncate text-sm font-medium hover:text-accent-700 hover:underline">
                      {v.product.name}
                    </Link>
                    <p className="text-xs text-stone-500">{v.colorName ?? "Variação única"}</p>
                  </div>
                  <span className={v.stock === 0 ? "text-sm font-semibold text-red-600" : "text-sm font-semibold text-amber-600"}>
                    {v.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
