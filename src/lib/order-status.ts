import type { OrderStatus } from "@prisma/client";

/**
 * Róturos/badge dos status de pedido — compartilhado entre a lista "Meus
 * pedidos", a página do pedido e (no futuro) o admin.
 */
export const ORDER_STATUS_INFO: Record<OrderStatus, { label: string; badge: "neutral" | "accent" | "ink" | "outline" }> = {
  AWAITING_PAYMENT: { label: "Aguardando pagamento", badge: "neutral" },
  AWAITING_PRESCRIPTION_VALIDATION: { label: "Receita em análise", badge: "neutral" },
  PAID: { label: "Pago", badge: "accent" },
  PREPARING: { label: "Em preparação", badge: "accent" },
  SHIPPED: { label: "Enviado", badge: "accent" },
  DELIVERED: { label: "Entregue", badge: "ink" },
  CANCELLED: { label: "Cancelado", badge: "outline" },
  REFUNDED: { label: "Reembolsado", badge: "outline" },
};
