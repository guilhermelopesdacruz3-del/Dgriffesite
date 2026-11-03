/**
 * Fase 7b — revisão da receita pelo óptico (dentro do pedido no admin).
 *
 * VALIDATED: libera a montagem — o pedido preso em
 * AWAITING_PRESCRIPTION_VALIDATION passa a PREPARING.
 * REJECTED: não dá para montar as lentes com grau perdido — o pedido vai para
 * CANCELLED (com contato do cliente pelo WhatsApp; estorno segue a política de
 * pagamento da loja).
 */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";

const reviewSchema = z.object({
  prescriptionId: z.string().min(1),
  decision: z.enum(["VALIDATED", "REJECTED"]),
  note: z.string().max(500).optional().nullable(),
});

export type PrescriptionAction =
  | { ok: true }
  | { ok: false; message: string };

export async function reviewPrescriptionAction(values: unknown): Promise<PrescriptionAction> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return { ok: false, message: guard.error };

  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { prescriptionId, decision, note } = parsed.data;

  const receita = await db.prescription.findUnique({
    where: { id: prescriptionId },
    select: {
      id: true,
      status: true,
      userId: true,
      orderItems: { select: { order: { select: { id: true, status: true } } } },
    },
  });
  if (!receita) return { ok: false, message: "Receita não encontrada." };
  if (receita.status !== "PENDING") {
    return { ok: false, message: "Esta receita já foi analisada." };
  }

  const status = decision;
  const orderIds = receita.orderItems.map((o) => o.order.id);
  const openOrders = receita.orderItems
    .filter((o) => o.order.status === "AWAITING_PRESCRIPTION_VALIDATION")
    .map((o) => o.order.id);

  await db.$transaction(async (tx) => {
    await tx.prescription.update({
      where: { id: prescriptionId },
      data: { status, notes: note ?? undefined, reviewedAt: new Date(), reviewedById: guard.user.id },
    });
    for (const orderId of new Set([...openOrders, ...(status === "REJECTED" ? orderIds : [])])) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: status === "VALIDATED" ? "PREPARING" : "CANCELLED",
          cancelledAt: status === "REJECTED" ? new Date() : undefined,
        },
      });
    }
  });

  await audit({ id: guard.user.id, email: guard.user.email }, "prescription.review", "Prescription", prescriptionId, {
    decision,
    note: note ?? null,
    ordersAffected: [...new Set(orderIds)],
  });

  for (const orderId of [...new Set(orderIds)]) {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { code: true } });
    if (order) revalidatePath(`/admin/pedidos/${order.code}`);
  }
  return { ok: true };
}
