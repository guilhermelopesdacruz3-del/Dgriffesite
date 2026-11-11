"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";
import { goldPriceSchema } from "@/lib/validators/admin";
import { GOLD_PRICE_SETTING_KEY, applyGoldPrice, fetchGoldPricePerGram } from "@/lib/jewelry";

type ActionResult = { ok: true; synced: number; price?: number } | { ok: false; error: string };

function revalidateLoja() {
  revalidatePath("/admin/ajustes");
  revalidatePath("/produtos");
  revalidatePath("/");
}

/**
 * Fase 14 — cotação manual do ouro (R$/grama), editada no painel.
 * Salvar já revalida o preço de todas as joias:
 * precoFinal = peso (g) × cotação × 2,7.
 */
export async function saveGoldPrice(values: unknown): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = goldPriceSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const goldPerGram = Number(parsed.data.goldPerGram.replace(",", "."));

  try {
    const current = await db.setting.findUnique({
      where: { key: GOLD_PRICE_SETTING_KEY },
      select: { value: true },
    });
    if (current?.value === goldPerGram.toFixed(2)) return { ok: true, synced: 0 };

    const synced = await applyGoldPrice(goldPerGram);
    await audit(
      { id: guard.user.id, email: guard.user.email },
      "goldPrice.update",
      "Setting",
      GOLD_PRICE_SETTING_KEY,
      { goldPerGram },
    );

    revalidateLoja();
    return { ok: true, synced };
  } catch (err) {
    console.error("[saveGoldPrice]", err);
    return { ok: false, error: "Não foi possível salvar a cotação." };
  }
}

/**
 * Fase 14b — atualiza a cotação pela fonte externa (AwesomeAPI, XAU-BRL):
 * ouro à vista, preço por troy ounce ÷ 31,1035. Usada pelo botão
 * "Buscar cotação de mercado" no painel e pelo cron diário da Vercel
 * (/api/cron/gold). Em caso de falha da fonte, a cotação atual é mantida.
 */
export async function refreshGoldPrice(): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  try {
    const perGram = await fetchGoldPricePerGram();
    if (perGram === null) {
      return { ok: false, error: "Cotação externa indisponível agora — o valor atual foi mantido." };
    }

    const synced = await applyGoldPrice(perGram);
    await audit(
      { id: guard.user.id, email: guard.user.email },
      "goldPrice.auto",
      "Setting",
      GOLD_PRICE_SETTING_KEY,
      { goldPerGram: perGram },
    );

    revalidateLoja();
    return { ok: true, synced, price: perGram };
  } catch (err) {
    console.error("[refreshGoldPrice]", err);
    return { ok: false, error: "Não foi possível atualizar a cotação." };
  }
}
