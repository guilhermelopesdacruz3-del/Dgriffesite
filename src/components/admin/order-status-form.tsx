"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrder } from "@/actions/admin/orders";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import type { OrderStatus } from "@prisma/client";

/**
 * Fase 6 — mudança de status do pedido + código de rastreio.
 * Fluxo simples da operação diária: acerta status, cola código, salva.
 */
export function OrderStatusForm({
  code,
  status,
  trackingCode,
}: {
  code: string;
  status: OrderStatus;
  trackingCode: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<OrderStatus>(status);
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setFeedback(null);
        const res = await updateOrder({
          code,
          status: nextStatus,
          trackingCode: tracking.trim(),
        });
        setSaving(false);
        if (res.ok) {
          setFeedback("Pedido atualizado ✓");
          router.refresh();
        } else {
          setError(res.error);
        }
      }}
      className="rounded-2xl border border-stone-200 bg-white p-6"
      aria-label="Atualizar pedido"
    >
      <h2 className="font-serif text-lg">Atualizar status</h2>
      <p className="mt-1 text-xs text-stone-500">
        Cada mudança fica registrada no histórico de auditoria.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="order-status">Status</Label>
          <select
            id="order-status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
            className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] focus:border-accent-600 focus:outline-none"
          >
            {(Object.keys(ORDER_STATUS_INFO) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_INFO[s].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="order-tracking">Código de rastreio (opcional)</Label>
          <Input
            id="order-tracking"
            className="mt-1.5 font-mono"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="BR1234567890"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar atualização"}
        </Button>
        {feedback && <span className="text-sm font-medium text-green-700">{feedback}</span>}
        <FieldError>{error}</FieldError>
      </div>
    </form>
  );
}
