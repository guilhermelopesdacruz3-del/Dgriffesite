import { storeConfig } from "./config";

/**
 * Cotação de frete da loja.
 *
 * Fase 4: cotação simulada e determinística a partir do CEP (região,
 * sobreposições regionais e micro-variância dos dígitos finais). O peso da
 * caixa é tratado como uniforme (óculos = pacote leve).
 *
 * Para plugar um provedor real (Melhor Envio/Correios) basta reimplementar
 * `quoteShipping` mantendo a mesma assinatura — a API `/api/frete`, o
 * carrinho e o checkout continuam inalterados.
 */

/** CEP válido no formato brasileiro (com ou sem hífen). */
export function isValidCep(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep.trim());
}

/** Normaliza "12345-678" / "12345678" → "12345678". */
export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

export interface ShippingOption {
  /** id estável gravado no pedido (compatível com Order.shippingMethod). */
  id: string;
  carrier: string;
  service: string;
  /** dias úteis estimados (null = retirada na loja) */
  deadline: number | null;
  price: number;
}

// Regiões por primeiro dígito do CEP: faixa, prazo base (dias úteis) e
// valor base do Pac.
const REGIONS: {
  digits: string[];
  name: string;
  basePrice: number;
  baseDays: number;
}[] = [
  { digits: ["0", "1"], name: "Grande São Paulo", basePrice: 0, baseDays: 2 },
  { digits: ["2"], name: "Sudeste", basePrice: 3, baseDays: 4 },
  { digits: ["3"], name: "Sudeste", basePrice: 3, baseDays: 4 },
  { digits: ["4", "5", "6"], name: "Nordeste/Norte", basePrice: 8, baseDays: 6 },
  { digits: ["7"], name: "Centro-Oeste", basePrice: 7, baseDays: 6 },
  { digits: ["8", "9"], name: "Sul", basePrice: 5, baseDays: 4 },
];

/** Preço base do Pac na capital (SP) — os complementos regionais somam em cima. */
const PAC_MIN = 16.9;
const SEDEX_MULTIPLIER = 1.55; // Sedex: ~55% mais caro e ~45% mais rápido

/** Arredonda para 2 casas (moeda). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cota principal da loja. Determinística a partir do CEP do destino e do
 * subtotal (o frete grátis do config aplica-se ao Pac; Sedex fica com 50%).
 */
export function quoteShipping(cepInput: string, subtotal: number): ShippingOption[] {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return [];

  const region =
    REGIONS.find((r) => r.digits.includes(cep[0])) ?? REGIONS[1];

  // Microssobrepoição pelos últimos dígitos (+0 a +8), evitando que todos os
  // CEPs da mesma faixa tenham valor idêntico.
  const micro = Number(cep.slice(6)) % 9;

  const pacBase = round2(PAC_MIN + region.basePrice + micro);
  const pacDays = Math.max(2, Math.round(region.baseDays + micro / 4));
  const sedexDays = Math.max(1, Math.round(pacDays * 0.55));

  const options: ShippingOption[] = [
    {
      id: "PAC",
      carrier: "Correios",
      service: "Pac",
      deadline: pacDays,
      price: pacBase,
    },
    {
      id: "SEDEX",
      carrier: "Correios",
      service: "Sedex",
      deadline: sedexDays,
      price: round2(pacBase * SEDEX_MULTIPLIER),
    },
    {
      id: "RETIRADA",
      carrier: storeConfig.name,
      service: "Retirada na loja (Paulista)",
      deadline: null,
      price: 0,
    },
  ];

  // Frete grátis do config: Pac grátis acima do valor; Sedex pela metade.
  const freeAbove = storeConfig.commerce.freeShippingAbove;
  if (subtotal >= freeAbove) {
    return options.map((o) =>
      o.id === "PAC"
        ? { ...o, price: 0 }
        : o.id === "SEDEX"
          ? { ...o, price: round2(o.price * 0.5) }
          : o,
    );
  }
  return options;
}

/** Busca uma opção de cotação pelo id (validação no servidor do checkout). */
export function findShippingOption(
  cep: string,
  subtotal: number,
  optionId: string,
): ShippingOption | null {
  return quoteShipping(cep, subtotal).find((o) => o.id === optionId) ?? null;
}
