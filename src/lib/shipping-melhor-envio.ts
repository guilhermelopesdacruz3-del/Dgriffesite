/**
 * Cliente da API do Melhor Envio (cotação de frete real).
 *
 * Credenciais por variáveis de ambiente:
 *  - MELHOR_ENVIO_TOKEN   — token de usuário gerado em melhor Envio → Integrações
 *  - MELHOR_ENVIO_BASE    — (opcional) https://sandbox.melhorenvio.com.br p/ testes
 *  - SHIP_FROM_CEP        — CEP de origem (Capão da Canoa/RS)
 *
 * Sem token configurado a cotação real é desativada e a loja usa a estimativa
 * local (fallback em src/lib/shipping.ts) — o checkout nunca fica sem frete.
 */

export const SHIP_FROM_CEP = (process.env.SHIP_FROM_CEP ?? "95555000").replace(/\D/g, "");

export function melhorEnvioConfigured(): boolean {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN);
}

interface MeQuote {
  id: number;
  name: string;
  company?: { name?: string };
  price?: string | number;
  delivery_time?: number | null;
  custom_delivery_time?: string | number | null;
}

export interface MeOption {
  id: string;
  carrier: string;
  service: string;
  deadline: number | null;
  price: number;
}

/**
 * Cota no Melhor Envio. Caixa padrão de ótica: 25×18×10 cm, 0,5 kg
 * (proteção rígida para armações/joias). `insurance` = subtotal do carrinho
 * (valor declarado). Lança em caso de falha — o chamador decide o fallback.
 */
export async function quoteMelhorEnvio(
  cepDestino: string,
  insurance: number,
): Promise<MeOption[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) throw new Error("Melhor Envio não configurado (MELHOR_ENVIO_TOKEN).");

  const base = process.env.MELHOR_ENVIO_BASE ?? "https://www.melhorenvio.com.br";
  const body = {
    from: { postal_code: SHIP_FROM_CEP },
    to: { postal_code: cepDestino },
    products: [
      {
        id: "pacote-padrao",
        width: 25,
        height: 18,
        length: 10,
        weight: 0.5, // kg
        insurance_value: Math.max(0, Math.round(insurance * 100) / 100),
        quantity: 1,
      },
    ],
    options: { receipt: false, own_hand: false, reverse: false, non_commercial: false },
  };

  const res = await fetch(`${base}/api/v2/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // A API do Melhor Envio exige User-Agent identificando a aplicação.
      "User-Agent": "Aplicacao dgriffesite (contato@dgriffe.com.br)",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Melhor Envio respondeu ${res.status}`);
  const data = (await res.json()) as MeQuote[] | MeQuote;
  const list = Array.isArray(data) ? data : [data];

  const options: MeOption[] = [];
  for (const q of list) {
    const price = Number(q.price);
    if (!q.id || !Number.isFinite(price) || price <= 0) continue;
    // Prazo: campo customizado quando presente; senão o padrão do serviço.
    let deadline: number | null = null;
    if (typeof q.custom_delivery_time === "string" && /^\d+$/.test(q.custom_delivery_time)) {
      deadline = Number(q.custom_delivery_time);
    } else if (typeof q.custom_delivery_time === "number" && q.custom_delivery_time > 0) {
      deadline = q.custom_delivery_time;
    } else if (typeof q.delivery_time === "number" && q.delivery_time > 0) {
      deadline = q.delivery_time;
    }
    options.push({
      id: `ME-${q.id}`,
      carrier: q.company?.name?.trim() || "Transportadora",
      service: q.name?.trim() || `Serviço ${q.id}`,
      deadline,
      price: Math.round(price * 100) / 100,
    });
  }
  return options;
}
