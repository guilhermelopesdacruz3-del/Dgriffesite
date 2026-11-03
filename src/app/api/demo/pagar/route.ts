/**
 * POST /api/demo/pagar — modo demonstração (desenvolvimento).
 *
 * Aprova o pagamento de um pedido criado SEM MERCADO_PAGO_ACCESS_TOKEN para
 * testar todo o pós-pagamento (status, estoque, página do pedido). Com token
 * configurado a rota é recusada — em produção nada dela é alcançável por
 * fluxo normal, e a aprovação real vem do webhook.
 *
 * Auditoria (A1): além de exigir ausência do token do MP, a rota é desativada
 * em produção (`NODE_ENV=production`) — mesmo que alguém publique a loja sem
 * configurar o gateway, nenhum anônimo pode aprovar pedidos por aqui.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { approveDemoOrder, isMercadoPagoEnabled } from "@/lib/checkout";

const bodySchema = z.object({ code: z.string().min(5).max(14) });

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || isMercadoPagoEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Rodando com Mercado Pago configurado — a aprovação real vem do webhook. Desabilitado.",
      },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Informe o código do pedido." }, { status: 400 });
  }

  const approved = await approveDemoOrder(parsed.data.code.toUpperCase());
  if (!approved) {
    return NextResponse.json(
      { ok: false, message: "Pedido não encontrado ou já processado." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, status: "PAID" });
}
