import { storeConfig } from "./config";
import {
  melhorEnvioConfigured,
  quoteMelhorEnvio,
  SHIP_FROM_CEP,
} from "./shipping-melhor-envio";

/**
 * Cotação de frete da loja.
 *
 * Com token do Melhor Envio configurado, cota preço real (Correios +
 * transportadoras agregadas) com cache de 15 min por CEP+valor; em qualquer
 * falha da API cai na estimativa local determinística — o cliente nunca fica
 * sem opção de frete.
 *
 * Regra comercial decidida pelo lojista: frete é sempre cobrado (sem frete
 * grátis acima de valor). "Retirada na loja" permanece grátis.
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

/** Retirada na loja física (Capão da Canoa/RS). */
export function pickupOption(): ShippingOption {
  return {
    id: "RETIRADA",
    carrier: storeConfig.name,
    service: `Retirada na loja (${storeConfig.stores[0].city.split("—")[0].trim()})`,
    deadline: null,
    price: 0,
  };
}

// Regiões por primeiro dígito do CEP: faixa, prazo base (dias úteis) e
// valor base do Pac — usadas apenas no fallback (sem provedor real).
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

/** Preço base do Pac na origem (RS → demais regiões). */
const PAC_MIN = 19.9;
const SEDEX_MULTIPLIER = 1.55; // Sedex: ~55% mais caro e ~45% mais rápido

/** Arredonda para 2 casas (moeda). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Estimativa local determinística (fallback). */
function simulatedQuote(cepInput: string): ShippingOption[] {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return [];

  const region = REGIONS.find((r) => r.digits.includes(cep[0])) ?? REGIONS[1];
  // RS (origem) para Sul é curto; faixas 8/9 partem do Sul.
  const sameState = cep.startsWith("95");
  const base = sameState ? PAC_MIN - 8 : PAC_MIN + region.basePrice;
  const micro = Number(cep.slice(6)) % 9;

  const pacBase = round2(Math.max(12.9, base + micro));
  const pacDays = sameState ? 2 : Math.max(2, Math.round(region.baseDays + micro / 4));
  const sedexDays = Math.max(1, Math.round(pacDays * 0.55));

  return [
    { id: "PAC", carrier: "Correios", service: "Pac", deadline: pacDays, price: pacBase },
    {
      id: "SEDEX",
      carrier: "Correios",
      service: "Sedex",
      deadline: sedexDays,
      price: round2(pacBase * SEDEX_MULTIPLIER),
    },
    pickupOption(),
  ];
}

/** Ordena por preço (mais barato primeiro) e junta a retirada. */
function withPickup(options: ShippingOption[]): ShippingOption[] {
  return [...options].sort((a, b) => a.price - b.price).concat([pickupOption()]);
}

// Cache em memória: evita bater no Melhor Envio a cada requote do carrinho.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; options: ShippingOption[] }>();

/**
 * Cota principal da loja (assíncrona): Melhor Envio quando configurado,
 * estimativa local como reserva. Sempre inclui a retirada na loja.
 */
export async function quoteShipping(
  cepInput: string,
  subtotal: number,
): Promise<ShippingOption[]> {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return [];

  if (melhorEnvioConfigured()) {
    const key = `${cep}:${round2(subtotal)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.options;

    try {
      const options = await quoteMelhorEnvio(cep, subtotal);
      if (options.length > 0) {
        const result = withPickup(options);
        cache.set(key, { at: Date.now(), options: result });
        return result;
      }
    } catch (err) {
      console.warn("[frete] Melhor Envio falhou, usando estimativa local:", err instanceof Error ? err.message : err);
    }
  }
  return simulatedQuote(cep);
}

/** Busca uma opção de cotação pelo id (revalidação do checkout no servidor). */
export async function findShippingOption(
  cep: string,
  subtotal: number,
  optionId: string,
): Promise<ShippingOption | null> {
  const options = await quoteShipping(cep, subtotal);
  return options.find((o) => o.id === optionId) ?? null;
}

/** CEP de origem das postagens (para exibição/admin). */
export function shipFrom(): string {
  const c = SHIP_FROM_CEP;
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}
