/**
 * POST /api/frete — cotação de frete por CEP.
 * Body: { cep: string, subtotal: number }
 * Cota real via Melhor Envio quando configurado; estimativa local como
 * reserva (ver src/lib/shipping.ts).
 */
import { NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cep?: string; subtotal?: number };
    const cep = String(body.cep ?? "");
    const subtotal = Number(body.subtotal ?? 0);

    const options = await quoteShipping(cep, subtotal);
    if (options.length === 0) {
      return NextResponse.json(
        { ok: false, message: "CEP inválido. Use o formato 00000-000." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, options });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Não foi possível calcular o frete agora." },
      { status: 400 },
    );
  }
}
