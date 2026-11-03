/**
 * POST /api/webhooks/mercadopago — notificações do gateway.
 *
 * O MP envia { type: "payment", data: { id } }; a fonte da verdade é o
 * próprio gateway: buscamos o pagamento pela API antes de gravar qualquer
 * status. Idempotente por providerPaymentId (checkout.ts processa só uma vez).
 *
 * Segurança: quando MERCADO_PAGO_WEBHOOK_SECRET está configurado, a assinatura
 * X-Signature é validada (HMAC-SHA256 sobre `data.<id>;x-request-id:...`).
 * Em desenvolvimento (sem secret) a rota aceita notificações e não queda.
 */
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processMercadoPagoPayment, isMercadoPagoEnabled } from "@/lib/checkout";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const paymentId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("data_id") ??
      null;
    const paymentType = url.searchParams.get("type") ?? url.searchParams.get("topic");

    // Corpo do webhook (MP moderno manda o recurso no body também)
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      data?: { id?: number | string };
    };

    const idFromBody = body.data?.id ?? null;
    const id = paymentId ?? idFromBody;

    if (!id || (paymentType && paymentType !== "payment")) {
      return NextResponse.json({ received: true }); // tópico irrelevante
    }

    // Validação de assinatura (produção)
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.headers.get("x-signature") ?? "";
      const requestId = request.headers.get("x-request-id") ?? "";
      if (!verifySignature(signature, requestId, String(id), secret)) {
        return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
      }
    } else {
      // Consulta no gateway: nunca acreditamos no status que chega no webhook
      if (isMercadoPagoEnabled()) {
        const client = new MercadoPagoConfig({
          accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
        });
        const mpPayment = await new Payment(client).get({ id: Number(id) });
        await processMercadoPagoPayment(
          mpPayment as unknown as Parameters<typeof processMercadoPagoPayment>[0],
        );
      } else if (process.env.NODE_ENV !== "production") {
        // Desenvolvimento (sem token): permite simular o webhook manualmente,
        // ex. com curl POST em /api/webhooks/mercadopago?data.id=123&type=payment
        // com { status: "approved", external_reference: "PZ-XXXXXX" }.
        // Auditoria (A1/A24): em produção esta porta de teste fica trancada
        // mesmo sem token configurado — webhook sem gateway não processa nada.
        await processMercadoPagoPayment({
          id: String(id),
          status: String((body as { status?: string }).status ?? "approved"),
          external_reference: (body as { external_reference?: string }).external_reference,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Devolvemos 500 sem expor detalhes; o Mercado Pago reenviará
    console.error("mercadopago webhook error:", error);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}

/**
 * HMAC-SHA256 como especifica a documentação do MP, com janela de frescor
 * (auditoria A13): o `ts` da assinatura precisa ter menos de 5 minutos —
 * assinaturas capturadas antigas são recusadas mesmo válidas (anti-replay).
 */
function verifySignature(sig: string, requestId: string, dataId: string, secret: string): boolean {
  // Ex.: ts=1712345678,v1=abc123...
  const parts = sig.split(",").map((p) => p.trim().replace(/^"(.*)"$/, "$1"));
  const ts = parts.find((p) => p.startsWith("ts="))?.slice(3);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!ts || !v1) return false;
  // Janela anti-replay: 5 minutos (em segundos).
  const tsSeconds = Number(ts);
  const skew = Math.abs(Date.now() / 1000 - tsSeconds);
  if (!Number.isFinite(tsSeconds) || skew > 5 * 60) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
