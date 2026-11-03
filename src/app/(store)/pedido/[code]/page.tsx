import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle, ExternalLink, MapPin, Truck } from "lucide-react";
import { auth } from "@/auth";
import { getRoleFromDb } from "@/lib/admin";
import { db } from "@/lib/db";
import { storeConfig } from "@/lib/config";
import { formatBRL, formatDate } from "@/lib/utils";
import { isMercadoPagoEnabled } from "@/lib/checkout";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { StatusAutoRefresh } from "@/components/order/status-refresh";
import { DemoPayButton } from "@/components/order/demo-pay-button";
import { PixCopy } from "@/components/order/pix-copy";

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}

export const metadata: Metadata = { title: "Pedido confirmado" };

// Export estático (ZIP de demo): nenhum pedido é pré-gerado — pedidos reais
// exigem banco/servidor. No deploy normal, tudo continua dinâmico.
export async function generateStaticParams() {
  return [];
}

const STATUS_UI = {
  AWAITING_PAYMENT: {
    label: "Aguardando pagamento",
    detail: "Conclua o pagamento para que a loja prepare o envio.",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  AWAITING_PRESCRIPTION_VALIDATION: {
    label: "Validação da receita",
    detail: "Recebemos o pagamento e suas lentes estão em validação.",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  PAID: {
    label: "Pagamento confirmado",
    detail: "Sua armação está sendo preparada com todo carinho.",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  PREPARING: {
    label: "Em preparo",
    detail: "Empacotando e conferindo as lentes antes do envio.",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  SHIPPED: {
    label: "Enviado",
    detail: "O pacote já está com a transportadora.",
    tone: "bg-sky-50 text-sky-800 border-sky-200",
    icon: Truck,
  },
  DELIVERED: {
    label: "Entregue",
    detail: "Bom uso! Qualquer ajuste fale com a gente via WhatsApp.",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelado",
    detail: "Este pedido foi cancelado. Fale com a loja se tiver dúvidas.",
    tone: "bg-red-50 text-red-800 border-red-200",
    icon: XCircle,
  },
  REFUNDED: {
    label: "Reembolsado",
    detail: "O valor do pedido foi devolvido.",
    tone: "bg-stone-100 text-stone-700 border-stone-300",
    icon: XCircle,
  },
} as const;

export default async function OrderPage({ params, searchParams }: Props) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const order = await db.order.findUnique({
    where: { code },
    include: {
      items: {
        include: {
          prescription: { select: { id: true, fileName: true, status: true } },
          lensPackage: { select: { name: true, price: true } },
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
      shipment: true,
    },
  });
  if (!order) notFound();

  // ---------------------------------------------------------------
  // Controle de acesso (auditoria A2): a página mostra nome, telefone e
  // endereço, então só abre quando o visitante prova ser o dono:
  //  • pedido COM conta: sessão do dono (ou ADMIN);
  //  • pedido de CONVIDADO: o token secreto do link (`?t=...`).
  // Qualquer outro caso → 404, sem revelar que o código existe.
  // ---------------------------------------------------------------
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  // Papel confirmado no banco (auditoria A21): não confia no JWT antigo.
  const isAdmin = (await getRoleFromDb(viewerId)) === "ADMIN";
  if (order.userId) {
    if (viewerId !== order.userId && !isAdmin) notFound();
  } else if (order.accessToken) {
    const { t } = await searchParams;
    if (!t || t !== order.accessToken) notFound();
  } else {
    // Pedido antigo de convidado sem token (criado antes da correção): só ADMIN vê.
    if (!isAdmin) notFound();
  }

  const ui = STATUS_UI[order.status];
  const payment = order.payments[order.payments.length - 1];
  const demoEnabled = !isMercadoPagoEnabled();
  /** A receita exibida: pega a primeira lente com receita anexada. */
  const receita = order.items.find((i) => i.prescription)?.prescription ?? null;

  return (
    <Container className="py-10 sm:py-12">
      {/* Status auto-atualiza enquanto aguarda o gateway */}
      {order.status === "AWAITING_PAYMENT" && <StatusAutoRefresh />}

      <div
        className={`flex flex-col gap-2 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${ui.tone}`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">Pedido {order.code}</p>
          <h1 className="flex items-center gap-2 font-serif text-2xl sm:text-3xl">
            <ui.icon size={26} aria-hidden /> {ui.label}
          </h1>
          <p className="mt-1 text-sm opacity-80">{ui.detail}</p>
        </div>
        <p className="text-xs opacity-70">
          criado em {formatDate(order.createdAt)}
          {order.paidAt ? ` · pago em ${formatDate(order.paidAt)}` : ""}
        </p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---------- Itens ---------- */}
          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <h2 className="border-b border-stone-200 px-6 py-4 font-serif text-lg">Itens</h2>
            <ul className="divide-y divide-stone-100">
              {order.items.map((item) => {
                const snap = item.snapshot as {
                  name?: string;
                  brand?: string;
                  color?: string | null;
                  size?: string | null;
                  image?: string | null;
                };
                return (
                  <li key={item.id} className="flex items-center gap-4 px-6 py-4">
                    {snap.image ? (
                      <Image
                        src={snap.image}
                        alt={snap.name ?? item.productName}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-xl object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-xl bg-stone-100 font-serif text-xl text-stone-400">
                        {(snap.name ?? item.productName).slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-stone-500">
                        {snap.brand}
                        {snap.color && ` · ${snap.color}`}
                        {snap.size && ` · ${snap.size}`} · {item.quantity}× {formatBRL(Number(item.unitPrice))}
                      </p>
                      {item.lensPackage && (
                        <p className="mt-0.5 text-xs text-accent-700">
                          Com lentes: {item.lensPackage.name} (+{" "}
                          {formatBRL(Number(item.lensPackage.price))})
                        </p>
                      )}
                    </div>
                    <p className="font-semibold">
                      {formatBRL(
                        (Number(item.unitPrice) + (item.lensPackage ? Number(item.lensPackage.price) : 0)) *
                          item.quantity,
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---------- Receita anexada (Fase 7b) ---------- */}
          {receita && (
            <section className="rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="font-serif text-lg">Receita de óculos</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-0 truncate font-medium" title={receita.fileName}>
                  {receita.fileName}
                </span>
                {receita.status === "PENDING" && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                    Em análise pela ótica
                  </span>
                )}
                {receita.status === "VALIDATED" && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                    Validada ✓
                  </span>
                )}
                {receita.status === "REJECTED" && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-700">
                    Recusada — fale com a ótica
                  </span>
                )}
                <a
                  href={`/api/minhas-receitas/${receita.id}/arquivo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-accent-700 hover:underline"
                >
                  abrir arquivo
                </a>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {receita.status === "PENDING"
                  ? "O óptico confere os graus antes de montar. Fica de olho no seu e-mail!"
                  : receita.status === "VALIDATED"
                    ? "Receita aprovada — suas lentes entram em montagem."
                    : "A receita não pode ser usada (foto ilegível ou grau não atualizado). Fale com a ótica pelo WhatsApp para reenviar."}
              </p>
            </section>
          )}

          {/* ---------- Como pagar (Pix/boleto, quando o MP devolve) ---------- */}
          {order.status === "AWAITING_PAYMENT" && payment && (
            <section className="rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="font-serif text-lg">Como pagar</h2>

              {payment.pixQrCodeBase64 && (
                <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${payment.pixQrCodeBase64}`}
                    alt="QR Code do Pix"
                    className="h-40 w-40 rounded-xl border border-stone-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-600">
                      Escaneie o QR Code no app do seu banco. O pedido é confirmado
                      automaticamente em segundos.
                    </p>
                    {payment.pixCode && <PixCopy code={payment.pixCode} />}
                  </div>
                </div>
              )}

              {!payment.pixQrCodeBase64 && payment.boletoUrl && (
                <a
                  href={payment.boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink hover:text-white"
                >
                  <ExternalLink size={16} /> Visualizar boleto
                </a>
              )}

              {!payment.pixQrCodeBase64 && !payment.boletoUrl && (
                <p className="mt-3 text-sm text-stone-600">
                  {payment.method === "PIX" ? (
                    <>
                      O QR Code do Pix aparece aqui assim que o Mercado Pago confirmar.
                      Se você saiu sem pagar, entre na página de pagamento pelo
                      e-mail do pedido.
                    </>
                  ) : payment.method === "BOLETO" ? (
                    <>
                      O link do boleto aparece aqui em instantes. O prazo de vencimento
                      é de 1–2 dias úteis.
                    </>
                  ) : (
                    <>
                      Volte para a página de pagamento do Mercado Pago (o link foi
                      enviado para seu e-mail) para concluir no cartão.
                    </>
                  )}
                </p>
              )}

              {/* Dev: completa a venda quando nenhuma integração está ativa */}
              {demoEnabled && (
                <div className="mt-5 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
                  <p className="text-xs text-stone-500">
                    <strong>Modo demonstração:</strong> nenhum Mercado Pago configurado
                    — use o botão abaixo para simular a aprovação e testar o
                    fluxo pós-pagamento (status, estoque).
                  </p>
                  <DemoPayButton code={order.code} />
                </div>
              )}
            </section>
          )}

          {/* ---------- Entrega ---------- */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-lg">Entrega</h2>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  <MapPin size={13} /> Endereço
                </p>
                <p>
                  {order.shipStreet}, {order.shipNumber}
                  {order.shipComplement ? ` — ${order.shipComplement}` : ""}
                  <br />
                  {order.shipDistrict} · {order.shipCity}/{order.shipState}
                  <br />
                  CEP {order.shipCep}
                </p>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  <Truck size={13} /> Frete
                </p>
                <p>
                  {order.shippingCarrier ? `${order.shippingCarrier} — ` : ""}
                  {order.shippingService ?? order.shippingMethod}
                  <br />
                  {order.shippingDeadline
                    ? `prazo estimado: ${order.shippingDeadline} dias úteis`
                    : "retirada na loja"}
                </p>
                {order.shipment?.trackingCode ? (
                  <p className="mt-2">
                    <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Rastreio
                    </span>
                    <span className="font-mono text-[13px]">{order.shipment.trackingCode}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {order.customerNotes && (
              <p className="mt-4 text-sm text-stone-500">
                <span className="font-medium text-ink">Observações:</span> {order.customerNotes}
              </p>
            )}
          </section>
        </div>

        {/* ---------- Resumo ---------- */}
        <aside>
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-lg">Resumo</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Subtotal</dt>
                <dd>{formatBRL(Number(order.subtotal))}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>{order.discountLabel ?? "Desconto"}</dt>
                  <dd>−{formatBRL(Number(order.discount))}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-stone-500">Frete</dt>
                <dd>
                  {Number(order.shippingCost) === 0 ? "Grátis" : formatBRL(Number(order.shippingCost))}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
                <dt className="font-serif text-base">Total</dt>
                <dd className="font-serif text-2xl font-semibold">{formatBRL(Number(order.total))}</dd>
              </div>
            </dl>

            <hr className="border-stone-200" />
            <div className="text-sm text-stone-500">
              <p className="font-medium text-ink">{order.customerName}</p>
              <p>{order.email}</p>
              <p>{order.customerPhone}</p>
            </div>

            <p className="text-xs text-stone-400">
              Dúvidas sobre este pedido? Chame no{" "}
              <a
                href={`https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent(
                  `Olá! Dúvida sobre o pedido ${order.code}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                WhatsApp {storeConfig.contact.whatsappDisplay}
              </a>
            </p>

            <Button href="/produtos" variant="soft" className="w-full">
              Continuar comprando
            </Button>
            {order.userId && (
              <p className="text-center text-xs text-stone-400">
                Todos os seus pedidos ficam na{" "}
                <Link href="/minha-conta" className="underline">
                  sua conta
                </Link>
                .
              </p>
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}
