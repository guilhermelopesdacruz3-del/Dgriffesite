import { db } from "@/lib/db";

/**
 * Fase 14 — joias em ouro vendidas por grama.
 *
 * A cotação mora na tabela `Setting` (key/value), editável no painel
 * em /admin/ajustes — não há outra fonte de dados. O peso em gramas é
 * o campo `Product.weight`, que já existia. O multiplicador 2,7 cobre
 * mão de obra, encargos e margem.
 *
 * O preço é persistido em `Product.price` e revalidado automaticamente
 * sempre que a cotação muda ou uma joia é salva (`syncJewelryPrices`),
 * então listagens, PDP e checkout — que já leem `product.price` —
 * continuam funcionando sem alterações.
 */
export const GOLD_PRICE_SETTING_KEY = "goldPricePerGram";
export const GOLD_MULTIPLIER = 2.7;
export const DEFAULT_GOLD_PRICE_PER_GRAM = 420.0; // só na primeira instalação (seed)

/** Gramas por troy ounce — conversão da cotação internacional XAU. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/**
 * Parse do bid XAU-BRL (R$ por troy ounce) → R$ por grama de ouro à vista.
 * Retorna NaN quando o valor é inutilizável.
 */
export function parseXauBrlPerGram(bid: string): number {
  const bidNumber = Number(bid);
  if (!Number.isFinite(bidNumber) || bidNumber <= 0) return NaN;
  return Math.round((bidNumber / GRAMS_PER_TROY_OUNCE) * 100) / 100;
}

/**
 * Busca a cotação do ouro à vista na AwesomeAPI (XAU-BRL, fonte pública e
 * gratuita). Retorna null quando a fonte está indisponível — nesse caso a
 * cotação atual no banco deve ser mantida (nunca zerar preços).
 */
export async function fetchGoldPricePerGram(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/XAU-BRL", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { XAUBRL?: { bid?: string } };
    const bid = json?.XAUBRL?.bid;
    if (!bid) return null;
    const perGram = parseXauBrlPerGram(bid);
    return Number.isFinite(perGram) && perGram > 0 ? perGram : null;
  } catch {
    return null;
  }
}

/** Persiste a cotação e revalida os preços das joias. Retorna joias atualizadas. */
export async function applyGoldPrice(goldPerGram: number): Promise<number> {
  const value = goldPerGram.toFixed(2);
  const current = await db.setting.findUnique({
    where: { key: GOLD_PRICE_SETTING_KEY },
    select: { value: true },
  });
  if (current?.value === value) return 0;
  await db.setting.upsert({
    where: { key: GOLD_PRICE_SETTING_KEY },
    create: { key: GOLD_PRICE_SETTING_KEY, value },
    update: { value },
  });
  return syncJewelryPrices();
}

/** Cotação atual (R$/grama). Sem registro no banco → valor padrão. */
export async function getGoldPricePerGram(): Promise<number> {
  const row = await db.setting.findUnique({
    where: { key: GOLD_PRICE_SETTING_KEY },
    select: { value: true },
  });
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GOLD_PRICE_PER_GRAM;
}

/** precoFinal = gramas × cotação × 2.7, arredondado para centavos. */
export function computeGoldPrice(grams: number, goldPerGram: number): number {
  return Math.round(grams * goldPerGram * GOLD_MULTIPLIER * 100) / 100;
}

/** Recalcula o preço de todas as joias com a cotação e o peso vigentes. */
export async function syncJewelryPrices(): Promise<number> {
  const gold = await getGoldPricePerGram();
  const jewels = await db.product.findMany({
    where: { type: "JEWEL", deletedAt: null },
    select: { id: true, weight: true, price: true },
  });

  let touched = 0;
  for (const jewel of jewels) {
    if (!jewel.weight) continue; // sem peso não há como precificar
    const fresh = computeGoldPrice(jewel.weight, gold);
    if (Number(jewel.price) === fresh) continue;
    await db.product.update({
      where: { id: jewel.id },
      data: { price: fresh.toFixed(2) },
    });
    touched++;
  }
  return touched;
}
