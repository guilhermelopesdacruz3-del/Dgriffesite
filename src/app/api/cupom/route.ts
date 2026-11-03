/**
 * POST /api/cupom — validação de cupom do carrinho.
 * Body: { code: string, items: [{ productId, price, quantity }] }
 * Sem banco disponível, o cupom de boas-vindas do seed (PRIMEIRA15)
 * continua respondendo (fallback de demonstração, ver coupons.ts).
 */
import { NextResponse } from "next/server";
import { evaluateCoupon } from "@/lib/coupons";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      items?: { productId: string; price: number; quantity: number }[];
    };

    // Auditoria (A23): sem limite antes, um script podia "chutar" códigos
    // promocionais à vontade (enumeração). 30 tentativas/60s por IP.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`cupom:${ip}`, 30, 60_000)) {
      return NextResponse.json(
        { ok: false, message: "Muitas tentativas. Aguarde um minuto.", discount: 0, label: "" },
        { status: 429 },
      );
    }

    const items = (body.items ?? []).filter(
      (i) => typeof i.productId === "string" && Number(i.price) >= 0 && Number(i.quantity) > 0,
    );
    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Adicione produtos antes de aplicar um cupom." },
        { status: 400 },
      );
    }

    // Usuário logado habilita checagens de perUserLimit
    const session = await auth();
    const result = await evaluateCoupon(
      body.code ?? "",
      items,
      session?.user?.id ?? null,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("cupom api error:", error);
    return NextResponse.json(
      { ok: false, message: "Não foi possível validar o cupom agora.", discount: 0, label: "" },
      { status: 500 },
    );
  }
}
