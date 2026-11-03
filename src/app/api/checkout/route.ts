/**
 * POST /api/checkout — finalização do pedido.
 * Body: payload validado pelo checkoutSchema (zod). Os preços do carrinho
 * NÃO são confiáveis: o servidor re-consulta o banco (checkout.ts).
 * Respostas:
 *   ok:true  → { code, redirectUrl, demo }  (redirectUrl = MP ou /pedido/CODE)
 *   ok:false → { message } com motivo amigável
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkoutSchema, createCheckout } from "@/lib/checkout";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = checkoutSchema.safeParse(json);

    if (!payload.success) {
      const issue = payload.error.issues[0]?.message ?? "Dados de compra inválidos.";
      return NextResponse.json({ ok: false, message: issue }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`checkout:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { ok: false, message: "Muitas tentativas. Aguarde 1 minuto e tente novamente." },
        { status: 429 },
      );
    }

    const session = await auth();
    const result = await createCheckout(payload.data, session?.user?.id ?? null);

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("checkout api error:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Não foi possível concluir o pedido agora. Confira o banco de dados e tente novamente.",
      },
      { status: 500 },
    );
  }
}
