/**
 * Cupons — validação e cálculo de desconto (server-only).
 *
 * Fase 4: regras respeitadas — ativo, janela de validade, valor mínimo do
 * pedido, maxUses (limite global), perUserLimit (compras anteriores do
 * usuário) e escopo (ALL, CATEGORY, BRAND, PRODUCT — o desconto incide
 * apenas nas parcelas abrangidas).
 */
import type { Coupon, CouponType } from "@prisma/client";
import { db } from "./db";

export interface CouponItem {
  productId: string;
  price: number;
  quantity: number;
}

export interface CouponResult {
  ok: boolean;
  /** Mensagem amigável (sucesso ou motivo da negativa). */
  message: string;
  /** Valor do desconto aplicado (0 quando inválido). */
  discount: number;
  /** Rótulo completo, ex.: "cupom PRIMEIRA15 (-15%)". */
  label: string;
  coupon?: {
    code: string;
    type: CouponType;
    value: number;
  };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Verifica o cupom jogado contra o carrinho. `userOrdersCount` é quantos
 * pedidos válidos o usuário já fez (perUserLimit); null = visitante.
 */
export async function evaluateCoupon(
  codeInput: string,
  items: CouponItem[],
  userId: string | null,
): Promise<CouponResult> {
  const code = codeInput.trim().toUpperCase();
  if (!code) return { ok: false, message: "Informe um código de cupom.", discount: 0, label: "" };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (subtotal <= 0) return { ok: false, message: "Seu carrinho está vazio.", discount: 0, label: "" };

  let coupon: Coupon | null = null;
  try {
    coupon = await db.coupon.findUnique({ where: { code } });
  } catch (err) {
    // Fallback da demonstração: sem banco local reconhecemos apenas o cupom
    // principal do seed, para que o fluxo de cupons seja testável offline.
    console.error("coupon lookup failed (using demo fallback):", err);
    return demoCoupon(code, subtotal);
  }

  if (!coupon || !coupon.active) {
    return { ok: false, message: `O cupom ${code} não existe ou está inativo.`, discount: 0, label: "" };
  }
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, message: `O cupom ${code} ainda não está valendo.`, discount: 0, label: "" };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ok: false, message: `O cupom ${code} expirou.`, discount: 0, label: "" };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, message: `O cupom ${code} esgotou os usos disponíveis.`, discount: 0, label: "" };
  }
  if (coupon.perUserLimit != null && coupon.perUserLimit > 0) {
    if (userId == null) {
      return {
        ok: false,
        message: `O cupom ${code} é só para a primeira compra — entre na sua conta para usar.`,
        discount: 0,
        label: "",
      };
    }
    const used = await db.order.count({
      where: { userId, couponCode: code, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    });
    if (used >= coupon.perUserLimit) {
      return { ok: false, message: `Você já usou o cupom ${code} nesta conta.`, discount: 0, label: "" };
    }
  }

  // Escopo: o desconto incide só nas parcelas com escopo válido
  let eligibleSubtotal = subtotal;
  if (coupon.scope !== "ALL") {
    const ids = coupon.scopeRefs;
    if (ids.length === 0) {
      return { ok: false, message: `O cupom ${code} está mal configurado.`, discount: 0, label: "" };
    }
    const products = await db.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, categoryId: true, brandId: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    eligibleSubtotal = items.reduce((s, i) => {
      const p = byId.get(i.productId);
      if (!p) return s;
      const match =
        (coupon.scope === "PRODUCT" && ids.includes(p.id)) ||
        (coupon.scope === "BRAND" && ids.includes(p.brandId)) ||
        (coupon.scope === "CATEGORY" && ids.includes(p.categoryId));
      return match ? s + i.price * i.quantity : s;
    }, 0);
    if (eligibleSubtotal <= 0) {
      return { ok: false, message: `O cupom ${code} não vale para os itens do seu carrinho.`, discount: 0, label: "" };
    }
  }

  if (coupon.minOrder != null && subtotal < Number(coupon.minOrder)) {
    return {
      ok: false,
      message: `O cupom ${code} vale apenas em compras acima de ${fmt(Number(coupon.minOrder))}.`,
      discount: 0,
      label: "",
    };
  }

  // Cálculo do desconto (em cima da parcela abrangida)
  const raw =
    coupon.type === "PERCENT" ? (eligibleSubtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  const discount = Math.min(round2(raw), subtotal);
  const label =
    coupon.type === "PERCENT"
      ? `cupom ${code} (-${Number(coupon.value).toLocaleString("pt-BR")} %)`
      : `cupom ${code} (-${fmt(Number(coupon.value))})`;
  return {
    ok: true,
    message: `Cupom ${code} aplicado com sucesso.`,
    discount,
    label,
    coupon: { code, type: coupon.type, value: Number(coupon.value) },
  };
}

/** Fallback sem banco: só o cupom de boas-vindas do seed. */
function demoCoupon(code: string, subtotal: number): CouponResult {
  const welcome = "PRIMEIRA15";
  if (code !== welcome) {
    return { ok: false, message: `O cupom ${code} não existe ou está inativo.`, discount: 0, label: "" };
  }
  const discount = Math.min(round2((subtotal * 15) / 100), subtotal);
  return {
    ok: true,
    message: `Cupom ${code} aplicado com sucesso.`,
    discount,
    label: `cupom ${code} (-15%)`,
    coupon: { code, type: "PERCENT", value: 15 },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
