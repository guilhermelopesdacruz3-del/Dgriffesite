"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";
import { lensPackageSchema } from "@/lib/validators/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Fase 13 — CRUD dos pacotes de lente (óculos de grau / de contato).
 * O checkout revalida preço e status no banco na hora do pedido — mudanças
 * no painel valem imediatamente para novos carrinhos.
 */
export async function saveLensPackage(values: unknown, id?: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = lensPackageSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const input = parsed.data;

  try {
    const data = {
      name: input.name,
      description: input.description,
      price: input.price.replace(",", "."),
      active: input.active,
      sortOrder: Number(input.sortOrder),
    };

    if (id) {
      await db.lensPackage.update({ where: { id }, data });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "lensPackage.update",
        "LensPackage",
        id,
        { name: input.name },
      );
    } else {
      const created = await db.lensPackage.create({ data });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "lensPackage.create",
        "LensPackage",
        created.id,
        { name: input.name },
      );
    }

    revalidatePath("/admin/lentes");
    revalidatePath("/produtos"); // preço da lente entra no fluxo do checkout pela PDP
    return { ok: true };
  } catch (err) {
    console.error("[saveLensPackage]", err);
    return { ok: false, error: "Não foi possível salvar a lente." };
  }
}

export async function deleteLensPackage(id: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  try {
    const lens = await db.lensPackage.findUnique({
      where: { id },
      select: { name: true, _count: { select: { orderItems: true } } },
    });
    if (!lens) return { ok: false, error: "Lente não encontrada." };

    if (lens._count.orderItems > 0) {
      // histórico de pedidos: desativa em vez de apagar
      await db.lensPackage.update({ where: { id }, data: { active: false } });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "lensPackage.deactivate",
        "LensPackage",
        id,
        { name: lens.name },
      );
    } else {
      await db.lensPackage.delete({ where: { id } });
      await audit(
        { id: guard.user.id, email: guard.user.email },
        "lensPackage.delete",
        "LensPackage",
        id,
        { name: lens.name },
      );
    }

    revalidatePath("/admin/lentes");
    return { ok: true };
  } catch (err) {
    console.error("[deleteLensPackage]", err);
    return { ok: false, error: "Não foi possível remover a lente." };
  }
}
