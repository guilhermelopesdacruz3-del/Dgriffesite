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
