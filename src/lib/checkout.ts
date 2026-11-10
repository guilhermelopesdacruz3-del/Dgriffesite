/**
 * Checkout (server-only).
 *
 * Fluxo da Fase 4:
 *   1. O carrinho vive no localStorage (funciona para visitante e logado) — o
 *      SERVIDOR nunca confia nos preços recebidos: re-consulta o banco e
 *      monta as linhas oficiais do pedido.
 *   2. Cupom e frete são revalidados aqui, com as mesmas funções usadas pela
 *      interface (evaluateCoupon / findShippingOption).
 *   3. Order + OrderItem (snapshot imutável) + Payment + reservas de estoque
 *      são gravados numa transação única.
 *   4. Pagamento: com MERCADO_PAGO_ACCESS_TOKEN criamos uma Preference (Pix,
 *      cartão e boleto na página hospedada do Mercado Pago) e o cliente é
 *      redirecionado ao init_point. Sem token (desenvolvimento) o pedido
 *      entra em "modo demonstração": permanece aguardando pagamento e o
 *      endpoint /api/demo/pagar (desativado automaticamente com token
 *      configurado) simula a aprovação para testar todo o pós-pagamento.
 *   5. O webhook /api/webhooks/mercadopago (idempotente por
 *      providerPaymentId) registra a resposta do gateway e muda os status:
 *      aprovado → order PAID, reserva convertida em venda e baixa no estoque.
 */
import { z } from "zod";
import { randomInt, randomUUID } from "node:crypto";
import { MercadoPagoConfig, Preference } from "mercadopago";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "./db";
import { evaluateCoupon } from "./coupons";
import { findShippingOption } from "./shipping";
import { storeConfig } from "./config";
import { layoutMail, sendMail, escapeHtml } from "./email";
import { formatBRL } from "./utils";

// ============================================================
// Contratos
// ============================================================

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable(),
        quantity: z.number().int().min(1).max(10),
        /** Pacote de lentes escolhido na PDP (Fase 7b) — null = só armação. */
        lensPackageId: z.string().min(1).nullable().optional(),
      }),
    )
    .min(1),
  /** Receita vinculada aos itens com lentes (checada: dono + status válido). */
  prescriptionId: z.string().min(1).nullable().optional(),
  cupom: z.string().max(40).nullable().optional(),
  /** Id da opção de frete escolhida (PAC | SEDEX | RETIRADA). */
  freteId: z.string().min(1),
  contato: z.object({
    nome: z.string().min(3).max(120),
    email: z.string().email().max(140),
    telefone: z.string().min(10).max(20),
  }),
  entrega: z.object({
    cep: z.string().min(8).max(9),
    rua: z.string().min(3).max(140),
    numero: z.string().min(1).max(10),
    complemento: z.string().max(80).nullable().optional(),
    bairro: z.string().min(2).max(80),
    cidade: z.string().min(2).max(80),
    uf: z.string().length(2).toUpperCase(),
    observacoes: z.string().max(500).nullable().optional(),
  }),
  metodo: z.enum(["PIX", "CARD", "BOLETO"]),
});

export type CheckoutPayload = z.infer<typeof checkoutSchema>;

export interface CheckoutResult {
  ok: false;
  message: string;
}

export interface CheckoutSuccess {
  ok: true;
  code: string;
  /** Destino: init_point do Mercado Pago ou página do pedido (modo demo). */
  redirectUrl: string;
  demo: boolean;
}

/** Mercado Pago só é ativado quando o token está configurado. */
export function isMercadoPagoEnabled(): boolean {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

/** Alfabeto sem caracteres ambíguos (sem I/O/0). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";

/**
 * Código amigável do pedido, ex.: "PZ-9F3KQ2LM" (auditoria A3).
 * crypto.randomInt (não Math.random) + 8 posições: ~34^8 ≈ 1,8 trilhões de
 * combinações imprevisíveis — o código deixa de ser "adivinhável".
 */
function generateOrderCode(): string {
  let id = "";
  for (let i = 0; i < 8; i += 1) {
    id += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `PZ-${id}`;
}

/**
 * Token de acesso para pedidos SEM conta (auditoria A2): o link do pedido
 * leva `?t=<token>` e a página só abre com o token correto.
 */
function generateAccessToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Erro interno para abortar a transação quando o cupom esgota (A5). */
class CouponExhaustedError extends Error {}

const money = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

// ============================================================
// Criação do pedido
// ============================================================

interface OfficialLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  productName: string;
  variantSku: string | null;
  /** Preço unitário do PRODUTO — a lente fica à parte (coluna lensPackageId). */
  unitPrice: number;
  lineTotal: number;
  snapshot: Record<string, unknown>;
  /** Fase 7b — pacote de lentes para a linha. */
  lensPackageId: string | null;
  lensPackageSnapshot: { name: string; price: number } | null;
}

/**
 * Cria o pedido a partir do payload já validado (zod). Toda precificação é
 * recalculada AQUI. Em caso de dados divergentes (produto inativo, sem
 * estoque, frete inválido) devolve CheckoutResult com o motivo.
 */
export async function createCheckout(
  payload: CheckoutPayload,
  userId: string | null,
): Promise<CheckoutSuccess | CheckoutResult> {
  // ---------- 1. Linhas oficiais, com preço do banco ----------
  const wantedIds = [...new Set(payload.items.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: wantedIds }, active: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      price: true,
      material: true,
      gender: true,
      brand: { select: { name: true, slug: true } },
      images: { where: { isMain: true }, take: 1 },
      variants: {
        select: {
          id: true,
          stock: true,
          colorName: true,
          size: true,
          priceOverride: true,
        },
      },
    },
  });
  if (products.length !== wantedIds.length) {
    return {
      ok: false,
      message: "Alguns itens do carrinho não estão mais disponíveis. Revise seu carrinho.",
    };
  }
  const byId = new Map(products.map((p) => [p.id, p]));

  // Pacotes de lentes pedidos no carrinho (Fase 7b): preço/validade do BANCO
  const lensIds = [...new Set(payload.items.map((i) => i.lensPackageId).filter(Boolean))] as string[];
  const lensById = new Map(
    lensIds.length
      ? (await db.lensPackage.findMany({ where: { id: { in: lensIds }, active: true } })).map((p) => [
          p.id,
          { name: p.name, price: Number(p.price) },
        ])
      : [],
  );

  const lines: OfficialLine[] = [];
  /** Fase 7b — total de lentes por linha (entra no subtotal, fora do cupom). */
  const lensData = (id: string | null | undefined) => (id ? (lensById.get(id) ?? null) : null);
  if (lensIds.length > 0 && !userId) {
    return {
      ok: false,
      message: "Para comprar com lentes de grau, entre na sua conta — a receita é vinculada ao perfil.",
    };
  }
  for (const item of payload.items) {
    const product = byId.get(item.productId);
    if (!product) return { ok: false, message: "Produto indisponível no carrinho." };

    // Produto com variação escolhida (cor/tamanho): valida a variação inteira
    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) return { ok: false, message: `Variação indisponível em ${product.name}.` };
      if (variant.stock < item.quantity) {
        return { ok: false, message: `Estoque insuficiente para ${product.name}.` };
      }
      const price = money(variant.priceOverride ?? product.price);
      const lens = lensData(item.lensPackageId);
      if (item.lensPackageId && !lens) {
        return { ok: false, message: `Pacote de lentes indisponível em ${product.name}.` };
      }
      const lensPrice = lens ? lens.price : 0;
      lines.push({
        productId: product.id,
        variantId: variant.id,
        quantity: item.quantity,
        productName: product.name,
        variantSku: `sku:${variant.id}`,
        unitPrice: price,
        lineTotal: (price + lensPrice) * item.quantity,
        snapshot: {
          name: product.name,
          brand: product.brand.name,
          color: variant.colorName,
          size: variant.size,
          image: product.images[0]?.url ?? null,
          specs: { material: product.material, gender: product.gender, sku: product.sku },
          ...(lens ? { lens } : {}),
        },
        lensPackageId: lens ? item.lensPackageId ?? null : null,
        lensPackageSnapshot: lens,
      });
    } else {
      // Sem variação: soma o estoque de todas as variações do produto
      const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
      if (totalStock < item.quantity) {
        return { ok: false, message: `Estoque insuficiente para ${product.name}.` };
      }
      const price = money(product.price);
      const lens = lensData(item.lensPackageId);
      if (item.lensPackageId && !lens) {
        return { ok: false, message: `Pacote de lentes indisponível em ${product.name}.` };
      }
      const lensPrice = lens ? lens.price : 0;
      lines.push({
        productId: product.id,
        variantId: null,
        quantity: item.quantity,
        productName: product.name,
        variantSku: null,
        unitPrice: price,
        lineTotal: (price + lensPrice) * item.quantity,
        snapshot: {
          name: product.name,
          brand: product.brand.name,
          image: product.images[0]?.url ?? null,
          specs: { material: product.material, gender: product.gender, sku: product.sku },
          ...(lens ? { lens } : {}),
        },
        lensPackageId: lens ? item.lensPackageId ?? null : null,
        lensPackageSnapshot: lens,
      });
    }
  }

  const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));

  // ---------- 2. Receita obrigatória quando há lentes (Fase 7b) ----------
  const comLentes = lines.filter((l) => l.lensPackageSnapshot !== null);
  let prescription: { id: string; status: string } | null = null;
  if (comLentes.length > 0) {
    if (!payload.prescriptionId) {
      return {
        ok: false,
        message: "Anexe ou selecione uma receita de óculos para montar as lentes.",
      };
    }
    const rx = await db.prescription.findUnique({
      where: { id: payload.prescriptionId },
      select: { id: true, userId: true, status: true },
    });
    if (!rx || rx.userId !== userId) {
      return { ok: false, message: "Receita não encontrada na sua conta." };
    }
    if (rx.status === "REJECTED") {
      return {
        ok: false,
        message: "Esta receita foi recusada pela ótica. Envie uma nova na Minha conta > Minhas receitas.",
      };
    }
    // VALIDATED ou PENDING são aceitas: PENDING prende o pedido em análise
    // após o pagamento (AWAITING_PRESCRIPTION_VALIDATION), VALIDATED segue direto.
    prescription = { id: rx.id, status: rx.status };
  }

  // ---------- 3. Cupom (revalidação servidora) ----------
  let discount = 0;
  let discountLabel: string | null = null;
  let couponCode: string | null = null;
  if (payload.cupom?.trim()) {
    const result = await evaluateCoupon(
      payload.cupom,
      lines.map((l) => ({ productId: l.productId, price: l.unitPrice, quantity: l.quantity })),
      userId,
    );
    if (!result.ok) return { ok: false, message: result.message };
    discount = result.discount;
    discountLabel = result.label;
    couponCode = result.coupon?.code ?? null;
  }

  // ---------- 4. Frete (cota revalidada aqui) ----------
  const option = findShippingOption(payload.entrega.cep, subtotal, payload.freteId);
  if (!option) {
    return { ok: false, message: "Frete não disponível para o CEP informado." };
  }
  const shippingCost = money(option.price);
  const total = money(Math.max(0, subtotal - discount + shippingCost));

  // ---------- 5. Transação: Order + items + Payment + reservas ----------
  const code = generateOrderCode();
  // Convidado (sem conta) recebe token de acesso: a página do pedido só abre
  // pelo link com `?t=...` (auditoria A2). Com conta, o dono entra logado.
  const accessToken = userId ? null : generateAccessToken();
  try {
    await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        code,
        userId,
        accessToken,
        email: payload.contato.email,
        customerName: payload.contato.nome,
        customerPhone: payload.contato.telefone,
        // A confirmação real fica por conta do webhook (ou do modo demo).
        status: "AWAITING_PAYMENT",
        subtotal,
        discount,
        shippingCost,
        total,
        couponCode,
        discountLabel,
        shippingMethod: option.id,
        shippingCarrier: option.carrier,
        shippingService: option.service,
        shippingDeadline: option.deadline,
        shipCep: payload.entrega.cep,
        shipStreet: payload.entrega.rua,
        shipNumber: payload.entrega.numero,
        shipComplement: payload.entrega.complemento ?? null,
        shipDistrict: payload.entrega.bairro,
        shipCity: payload.entrega.cidade,
        shipState: payload.entrega.uf,
        customerNotes: payload.entrega.observacoes ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            variantSku: l.variantSku,
            snapshot: l.snapshot as Prisma.InputJsonValue,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            withLenses: l.lensPackageSnapshot !== null,
            lensPackageId: l.lensPackageId,
            lensPackageSnapshot: (l.lensPackageSnapshot as Prisma.InputJsonValue) ?? undefined,
            prescriptionId: l.lensPackageSnapshot ? (prescription?.id ?? null) : null,
          })),
        },
        payments: {
          create: {
            method: payload.metodo as PaymentMethod,
            provider: "mercadopago",
            status: "PENDING",
            amount: total,
          },
        },
      },
    });

    // Reserva de estoque (20 min por padrão; webhook consumiu em venda)
    const expiresAt = new Date(Date.now() + storeConfig.commerce.stockReservationMinutes * 60_000);
    for (const line of lines.filter((l) => l.variantId)) {
      await tx.stockReservation.create({
        data: {
          orderId: order.id,
          variantId: line.variantId!,
          quantity: line.quantity,
          status: "ACTIVE",
          expiresAt,
        },
      });
    }

    // Uso do cupom (alimentação do contador maxUses)
    if (couponCode) {
      // Auditoria (A5): incremento CONDICIONAL dentro da transação — se o cupom
      // esgotar entre a validação e a gravação (duas pessoas comprando no mesmo
      // segundo), a transação inteira falha em vez de estourar o maxUses.
      const coupon = await tx.coupon.findUnique({
        where: { code: couponCode },
        select: { maxUses: true },
      });
      const updated = await tx.coupon.updateMany({
        where: {
          code: couponCode,
          ...(coupon?.maxUses != null ? { usedCount: { lt: coupon.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.count === 0) throw new CouponExhaustedError();
    }
  });
  } catch (err) {
    if (err instanceof CouponExhaustedError) {
      return {
        ok: false,
        message: `O cupom ${couponCode} acabou de esgotar os usos disponíveis. Finalize sem o cupom ou fale com a gente.`,
      };
    }
    throw err;
  }

  // ---------- 5. Mercado Pago: preferência + redirect ----------
  if (isMercadoPagoEnabled()) {
    const redirect = await createMercadoPagoPreference(
      code,
      payload.contato.email,
      lines.map((l) => ({
        id: `item-${l.productId}-${l.variantId ?? "s"}`,
        title: `${l.snapshot.brand as string} ${l.snapshot.name as string}`,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      total,
      accessToken,
    );
    if (redirect) return { ok: true, code, redirectUrl: redirect, demo: false };
    // Preferência falhou (ex.: token inválido): o pedido ficou salvo e o
    // cliente pode reabrir o pagamento pela página do pedido.
    return {
      ok: false,
      message: `Pedido ${code} criado, mas houve falha ao abrir o pagamento. Abra a página do pedido e tente novamente.`,
    };
  }

  // Modo demonstração (desenvolvimento): vai direto para a página do pedido.
  // Convidado: o link inclui o token de acesso (?t=) — sem ele a página
  // retorna 404 (auditoria A2).
  return {
    ok: true,
    code,
    redirectUrl: `/pedido/${code}${accessToken ? `?t=${accessToken}` : ""}`,
    demo: true,
  };
}

/** Cria a preferência Mercado Pago e devolve a URL de checkout hospedado. */
async function createMercadoPagoPreference(
  code: string,
  payerEmail: string,
  items: { id: string; title: string; quantity: number; unitPrice: number }[],
  total: number,
  orderAccessToken?: string | null,
): Promise<string | null> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!;
  // Pedido de convidado: os retornos do MP precisam carregar o token `?t=`
  // para a página do pedido abrir (auditoria A2).
  const guestTokenSuffix = orderAccessToken ? `?t=${orderAccessToken}` : "";
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const baseUrl = storeConfig.siteUrl.replace(/\/$/, "");
    const preference = await new Preference(client).create({
      body: {
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          quantity: i.quantity,
          currency_id: "BRL",
          unit_price: i.unitPrice,
        })),
        payer: { email: payerEmail },
        external_reference: code,
        back_urls: {
          success: `${baseUrl}/pedido/${code}${guestTokenSuffix}`,
          pending: `${baseUrl}/pedido/${code}${guestTokenSuffix}`,
          failure: `${baseUrl}/pedido/${code}${guestTokenSuffix}`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });
    const init =
      accessToken.startsWith("TEST-")
        ? preference.sandbox_init_point ?? preference.init_point
        : preference.init_point;
    console.info(`MP preference criada para ${code} — total ${total} — init ${init}`);
    return init ? String(init) : null;
  } catch (err) {
    console.error("mercadopago preference error:", err);
    return null;
  }
}

// ============================================================
// Pós-pagamento (webhook + modo demonstração)
// ============================================================

/** Porção útil do payload do gateway (tipagem própria, mínimo necessário). */
export type MpPaymentData = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_approved?: string;
  payment_type_id?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      external_resource_url?: string;
    };
  };
};

/**
 * LGPD (minimização, decisão com a loja): o payload do gateway NÃO é guardado
 * cru. Gravamos um recorte em lista branca — operacional e sem dados pessoais:
 * nada de e-mail do pagador, nome, CPF, número/cartão ou "last4" que o MP às
 * vezes devolve. O necessário para o negócio (valor, status, datas, método e
 * os códigos de Pix na tela) é explicitamente escolhido aqui.
 */
export function sanitizeMpPayment(data: MpPaymentData): Record<string, unknown> {
  const tx = data.point_of_interaction?.transaction_data;
  return {
    id: data.id,
    status: data.status ?? null,
    status_detail: data.status_detail ?? null,
    external_reference: data.external_reference ?? null,
    transaction_amount: data.transaction_amount ?? null,
    date_approved: data.date_approved ?? null,
    payment_type_id: data.payment_type_id ?? null,
    pix: tx
      ? {
          qr_code: tx.qr_code ?? null,
          qr_code_base64: tx.qr_code_base64 ?? null,
          boleto_url: tx.external_resource_url ?? null,
        }
      : null,
  };
}

/**
 * Idempotente: registra um pagamento do Mercado Pago associado a uma ordem.
 * Se o pagamento já foi processado (status != PENDING), não faz nada.
 */
export async function processMercadoPagoPayment(data: MpPaymentData): Promise<void> {
  const externalId = String(data.id);
  const target = await db.payment.findFirst({
    where: { providerPaymentId: externalId },
  });

  if (!target) {
    // Primeira chegada: ancora o providerPaymentId na linha pendente
    const order = data.external_reference
      ? await db.order.findUnique({ where: { code: data.external_reference } })
      : null;
    if (!order) return; // notificação de outro sistema/gateway
    const pending = await db.payment.findFirst({
      where: { orderId: order.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    if (!pending) return;
    await db.payment.update({
      where: { id: pending.id },
      data: { providerPaymentId: externalId },
    });
    await applyGatewayResult(pending.id, data);
  } else {
    await applyGatewayResult(target.id, data);
  }
}

function applyGatewayResult(paymentId: string, data: MpPaymentData): Promise<void> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== "PENDING") return; // idempotência

    const mapped = mapMpStatus(data.status);
    const transaction = data.point_of_interaction?.transaction_data;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: mapped.payment,
        paidAt: mapped.payment === "APPROVED" ? new Date() : null,
        pixCode: transaction?.qr_code ?? null,
        pixQrCodeBase64: transaction?.qr_code_base64 ?? null,
        boletoUrl: transaction?.external_resource_url ?? null,
        // LGPD (minimização): payload passa pela lista branca — sem e-mail do
        // pagador, nome/CPF ou dígitos de cartão. Ver sanitizeMpPayment().
        raw: sanitizeMpPayment(data) as unknown as object,
      },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: mapped.order,
        ...(mapped.payment === "APPROVED" ? { paidAt: new Date() } : {}),
      },
    });
  }).then(async () => {
    // Pós-pagamento (Fase 7b): receita PENDENTE prende o pedido em validação.
    const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
    if (payment) await maybeHoldForPrescription(payment.orderId, data.status);
    // Fase 11: e-mail de confirmação ao cliente (best-effort, só no aprovado).
    if (data.status === "approved" && payment) {
      await sendOrderConfirmationEmail(payment.orderId);
    }
  });
}

/**
 * Fase 11 — e-mail de confirmação do pedido (best-effort: nunca trava a
 * compra). Enviado quando o pagamento é APROVADO — o link vai para a página
 * do pedido (com o token `?t=` nos pedidos de convidado).
 */
async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        code: true,
        email: true,
        customerName: true,
        total: true,
        accessToken: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            lensPackage: { select: { name: true, price: true } },
          },
        },
      },
    });
    if (!order || !order.email) return;

    const base = storeConfig.siteUrl.replace(/\/$/, "");
    const link = `${base}/pedido/${order.code}${order.accessToken ? `?t=${order.accessToken}` : ""}`;
    const lista = order.items
      .map(
        (i) =>
          `<li style="margin:4px 0;">${escapeHtml(i.productName)}${
            i.lensPackage ? ` + lentes ${escapeHtml(i.lensPackage.name)}` : ""
          } × ${i.quantity}</li>`,
      )
      .join("");

    const mail = layoutMail(
      "Recebemos seu pedido!",
      `<p>Olá, ${escapeHtml(order.customerName.split(" ")[0])}!</p>
       <p>O pagamento do pedido <strong>${escapeHtml(order.code)}</strong> foi aprovado —
       total ${formatBRL(Number(order.total))}. Sua armação já entrou na fila do
       preparo (conferência de receita quando aplicável) para o envio.</p>
       <ul style="padding-left:20px;margin:16px 0;">${lista}</ul>
       <p>Acompanhe o status em tempo real:</p>
       <p style="margin:20px 0;">
         <a href="${link}" style="background:#1c1917;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">Ver meu pedido</a>
       </p>
       <p style="font-size:13px;color:#78716c;word-break:break-all;">Se o botão não abrir, copie este endereço: ${link}</p>`,
    );
    await sendMail({ to: order.email, subject: `Pedido ${order.code} recebido — D'Griffe`, ...mail });
  } catch (err) {
    console.error("[email-pedido] falha ao enviar confirmação:", err);
  }
}

/**
 * Fase 7b — depois do pagamento APROVADO, se o pedido tem itens com lente cuja
 * receita ainda está PENDING o status vira AWAITING_PRESCRIPTION_VALIDATION
 * (em vez de PAID): o óptico analisa a receita no admin antes de preparar.
 */
export async function maybeHoldForPrescription(orderId: string, gatewayStatus?: string): Promise<void> {
  if (gatewayStatus && gatewayStatus !== "approved") return;
  try {
    const item = await db.orderItem.findFirst({
      where: { orderId, prescriptionId: { not: null }, prescription: { status: "PENDING" } },
      select: { id: true },
    });
    if (!item) return;
    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (order?.status === "PAID") {
      await db.order.update({
        where: { id: orderId },
        data: { status: "AWAITING_PRESCRIPTION_VALIDATION" },
      });
    }
  } catch (err) {
    console.error("[checkout] falha ao prender pedido em validação de receita", err);
  }
}

/** Mapeia status do gateway para os enums locais (Payment/Order). */
function mapMpStatus(
  status?: string,
): {
  payment: "PENDING" | "APPROVED" | "IN_PROCESS" | "REJECTED" | "REFUNDED" | "CANCELLED";
  order: "AWAITING_PAYMENT" | "PAID" | "CANCELLED" | "REFUNDED";
} {
  switch (status) {
    case "approved":
      return { payment: "APPROVED", order: "PAID" };
    case "in_process":
    case "authorized":
      return { payment: "IN_PROCESS", order: "AWAITING_PAYMENT" };
    case "rejected":
      return { payment: "REJECTED", order: "AWAITING_PAYMENT" };
    case "cancelled":
      return { payment: "CANCELLED", order: "CANCELLED" };
    case "refunded":
      return { payment: "REFUNDED", order: "REFUNDED" };
    default:
      return { payment: "PENDING", order: "AWAITING_PAYMENT" };
  }
}

/**
 * Converte reservas ACTIVE da ordem em vendas: baixa no estoque + log de
 * movimentação. Só executa uma vez (reservas marcadas CONSUMED).
 */
export async function consumeReservations(orderId: string): Promise<void> {
  const reservations = await db.stockReservation.findMany({
    where: { orderId, status: "ACTIVE" },
  });
  if (reservations.length === 0) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { code: true } });

  await db.$transaction(async (tx) => {
    for (const r of reservations) {
      // Auditoria (A6): decremento CONDICIONAL — a baixa só acontece se o
      // estoque atual ainda cobre a reserva (evita estoque negativo/oversell
      // quando duas transações leem o mesmo saldo ao mesmo tempo).
      const updated = await tx.productVariant.updateMany({
        where: { id: r.variantId, stock: { gte: r.quantity } },
        data: { stock: { decrement: r.quantity } },
      });
      if (updated.count === 0) {
        console.error(
          `[estoque] pedido ${order?.code ?? orderId}: reserva ${r.id} sem saldo suficiente para baixar ${r.quantity}`,
        );
        continue;
      }
      await tx.stockMovement.create({
        data: {
          variantId: r.variantId,
          delta: -r.quantity,
          reason: "SALE",
          note: `Venda — pedido ${order?.code ?? orderId}`,
        },
      });
      await tx.stockReservation.update({
        where: { id: r.id },
        data: { status: "CONSUMED" },
      });
    }
  });
}

/**
 * Aprovação do modo DEMONSTRAÇÃO — em produção este caminho é inalcançável:
 * o endpoint /api/demo/pagar desativa com MERCADO_PAGO_ACCESS_TOKEN presente.
 * Produz o mesmo efeito do webhook aprovado (pedido PAID + estoque baixado).
 */
export async function approveDemoOrder(code: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { code },
    include: { payments: true },
  });
  if (!order) return false;
  const pending = order.payments.find((p) => p.status === "PENDING");
  if (!pending) return true; // já processado antes

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: pending.id },
      data: { status: "APPROVED", paidAt: new Date(), raw: { demo: true } },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });
  });
  await consumeReservations(order.id);
  // Fase 7b: receita PENDENTE prende o pedido para o óptico validar.
  await maybeHoldForPrescription(order.id, "approved");
  // Fase 11: e-mail de confirmação (best-effort), igual ao fluxo do gateway.
  await sendOrderConfirmationEmail(order.id);
  return true;
}
