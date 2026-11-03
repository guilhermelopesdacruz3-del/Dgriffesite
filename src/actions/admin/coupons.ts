"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";
import { couponSchema } from "@/lib/validators/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Fase 6 — CRUD de cupons. Escopo abre em ALL (categoria/marca/produto
 * específicos ficam para quando houver demanda real).
 */
export async function saveCoupon(values: unknown, id?: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = couponSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const input = parsed.data;

  if (input.type === "PERCENT" && Number(input.value.replace(",", ".")) > 90) {
    return { ok: false, error: "Cupom percentual acima de 90% não é permitido." };
  }

  try {
    const code = input.code;
    const data = {
      code,
      description: input.description || null,
      type: input.type,
      value: input.value.replace(",", "."),
      minOrder: input.minOrder ? input.minOrder.replace(",", ".") : null,
      maxUses: input.maxUses ? Number(input.maxUses) : null,
      endsAt: input.endsAt ? new Date(`${input.endsAt}T23:59:59`) : null,
      scope: "ALL" as const,
      active: input.active ?? true,
    };

    if (id) {
      const existing = await db.coupon.findUnique({ where: { id }, select: { code: true, usedCount: true } });
      if (!existing) return { ok: false, error: "Cupom não encontrado." };
      const collision = await db.coupon.findUnique({ where: { code }, select: { id: true } });
      if (collision && collision.id !== id) return { ok: false, error: `Código ${code} já existe.` };
      // Não dá para reduzir o limite abaixo do que já foi usado
      if (data.maxUses !== null && data.maxUses < existing.usedCount) {
        return {
          ok: false,
          error: `Já foram feitos ${existing.usedCount} usos — o limite precisa ser ≥ ${existing.usedCount}.`,
        };
      }
      await db.coupon.update({ where: { id }, data });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "coupon.update",
        "Coupon",
        id,
        { ...data, endsAt: data.endsAt?.toISOString() ?? null },
      );
    } else {
      const collision = await db.coupon.findUnique({ where: { code }, select: { id: true } });
      if (collision) return { ok: false, error: `Código ${code} já existe.` };
      const created = await db.coupon.create({ data });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "coupon.create",
        "Coupon",
        created.id,
        { ...data, endsAt: data.endsAt?.toISOString() ?? null },
      );
    }

    revalidatePath("/admin/cupons");
    // Cupom muda preço no carrinho/checkout — revalida também
    revalidatePath("/carrinho");
    revalidatePath("/checkout");
    return { ok: true };
  } catch (err) {
    console.error("[saveCoupon]", err);
    return { ok: false, error: "Não foi possível salvar o cupom." };
  }
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  try {
    const coupon = await db.coupon.findUnique({ where: { id }, select: { code: true, usedCount: true } });
    if (!coupon) return { ok: false, error: "Cupom não encontrado." };
    if (coupon.usedCount > 0) {
      // histórico de uso: desativa em vez de apagar
      await db.coupon.update({ where: { id }, data: { active: false } });
    } else {
      await db.coupon.delete({ where: { id } });
    }

    await audit(
      { id: guard.user.id, email: guard.user.email },
      "coupon.delete",
      "Coupon",
      id,
      { code: coupon.code },
    );

    revalidatePath("/admin/cupons");
    return { ok: true };
  } catch (err) {
    console.error("[deleteCoupon]", err);
    return { ok: false, error: "Não foi possível remover o cupom." };
  }
}
