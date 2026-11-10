"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";
import { goldPriceSchema } from "@/lib/validators/admin";
import { GOLD_PRICE_SETTING_KEY, syncJewelryPrices } from "@/lib/jewelry";

type ActionResult = { ok: true; synced: number } | { ok: false; error: string };

/**
 * Fase 14 — cotação do ouro (R$/grama), editada no painel em /admin/ajustes.
 * Salvar já revalida o preço de todas as joias cadastradas:
 * precoFinal = peso (g) × cotação × 2,7.
 */
export async function saveGoldPrice(values: unknown): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = goldPriceSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const goldPerGram = parsed.data.goldPerGram.replace(",", ".");

  try {
    const current = await db.setting.findUnique({
      where: { key: GOLD_PRICE_SETTING_KEY },
      select: { value: true },
    });
    if (current?.value === goldPerGram) return { ok: true, synced: 0 };

    await db.setting.upsert({
      where: { key: GOLD_PRICE_SETTING_KEY },
      create: { key: GOLD_PRICE_SETTING_KEY, value: goldPerGram },
      update: { value: goldPerGram },
    });

    const synced = await syncJewelryPrices();
    await audit(
      { id: guard.user.id, email: guard.user.email },
      "goldPrice.update",
      "Setting",
      GOLD_PRICE_SETTING_KEY,
      { goldPerGram },
    );

    revalidatePath("/admin/ajustes");
    revalidatePath("/produtos");
    revalidatePath("/");
    return { ok: true, synced };
  } catch (err) {
    console.error("[saveGoldPrice]", err);
    return { ok: false, error: "Não foi possível salvar a cotação." };
  }
}
