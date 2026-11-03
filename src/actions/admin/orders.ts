"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction } from "@/lib/admin";
import { orderUpdateSchema } from "@/lib/validators/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Fase 6 — gestão de pedidos: atualização de status + código de rastreio.
 * Cada mudança vai para o AuditLog (quem, quando, antes → depois).
 */
export async function updateOrder(values: unknown): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = orderUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { code, status, trackingCode } = parsed.data;

  try {
    const order = await db.order.findUnique({
      where: { code },
      select: {
        id: true,
        status: true,
        trackingCode: true,
        couponCode: true,
      },
    });
    if (!order) return { ok: false, error: "Pedido não encontrado." };
    if (order.status === status && (order.trackingCode ?? "") === trackingCode) {
      return { ok: true }; // nada a mudar
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          trackingCode: trackingCode || null,
        },
      });

      // Auditoria (A5): cupom devolvido ao "estoque" quando o pedido é
      // cancelado ou reembolsado — o uso só conta em compra que se concretiza.
      const couponGoesBack =
        (status === "CANCELLED" || status === "REFUNDED") &&
        order.couponCode &&
        order.status !== "CANCELLED" &&
        order.status !== "REFUNDED";
      if (couponGoesBack && order.couponCode) {
        await tx.coupon.updateMany({
          where: { code: order.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // Rastreio também vive no envio (a PDP do pedido lê de lá)
      if (trackingCode) {
        await tx.shipment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            carrier: "Manual",
            status: status === "DELIVERED" ? "DELIVERED" : "CREATED",
            trackingCode,
            shippedAt: ["SHIPPED", "DELIVERED"].includes(status) ? new Date() : null,
            deliveredAt: status === "DELIVERED" ? new Date() : null,
          },
          update: {
            trackingCode,
            status: status === "DELIVERED" ? "DELIVERED" : "CREATED",
            shippedAt: ["SHIPPED", "DELIVERED"].includes(status) ? new Date() : undefined,
            deliveredAt: status === "DELIVERED" ? new Date() : undefined,
          },
        });
      }
    });

    await audit(
      { id: guard.user.id, email: guard.user.email },
      "order.status_change",
      "Order",
      order.id,
      { code, before: order.status, after: status, trackingCode: trackingCode || null },
    );

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${code}`);
    revalidatePath(`/pedido/${code}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateOrder]", err);
    return { ok: false, error: "Não foi possível atualizar o pedido." };
  }
}
