import { NextResponse } from "next/server";
import { applyGoldPrice, fetchGoldPricePerGram } from "@/lib/jewelry";

export const dynamic = "force-dynamic";

/**
 * Fase 14b — cron diário da Vercel: atualiza a cotação do ouro (XAU-BRL via
 * AwesomeAPI) e revalida os preços das joias. Agendado em vercel.json.
 * Se CRON_SECRET estiver configurado na Vercel, exige o header Authorization
 * que a própria Vercel envia. Falha da fonte NÃO altera a cotação atual.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  const perGram = await fetchGoldPricePerGram();
  if (perGram === null) {
    return NextResponse.json(
      { ok: false, error: "cotação externa indisponível — valor atual mantido" },
      { status: 502 },
    );
  }

  const synced = await applyGoldPrice(perGram);
  return NextResponse.json({ ok: true, goldPerGram: perGram, synced });
}
