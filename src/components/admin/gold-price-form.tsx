"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveGoldPrice, refreshGoldPrice } from "@/actions/admin/gold";
import { goldPriceSchema, type GoldPriceInput } from "@/lib/validators/admin";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";

/**
 * Fase 14/14b — edita a cotação do ouro (R$/grama) manualmente ou puxa a
 * cotação de mercado (XAU-BRL, AwesomeAPI). Qualquer das duas recalcula
 * automaticamente o preço de todas as joias: peso × cotação × 2,7.
 */
export function GoldPriceForm({ current }: { current: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoldPriceInput>({
    resolver: zodResolver(goldPriceSchema),
    defaultValues: { goldPerGram: current },
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFeedback(null);
        const res = await saveGoldPrice(values);
        if (res.ok) {
          setFeedback(res.synced > 0 ? `Cotação salva ✓ · ${res.synced} joia(s) com preço atualizado` : "Cotação salva ✓");
          router.refresh();
        } else {
          setFeedback(res.error);
        }
      })}
      className="mt-4 flex flex-col gap-1.5 sm:max-w-xs"
    >
      <Label htmlFor="g-price">Cotação (R$ por grama)</Label>
      <Input id="g-price" className="mt-1.5" inputMode="decimal" placeholder="420.00" {...register("goldPerGram")} />
      <FieldError>{errors.goldPerGram?.message}</FieldError>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar cotação"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFeedback(null);
            const res = await refreshGoldPrice();
            setBusy(false);
            if (res.ok) {
              setFeedback(
                res.price !== undefined
                  ? `Cotação de mercado: ${formatBRL(res.price)}/g ✓ · ${res.synced} joia(s) atualizada(s)`
                  : "Cotação de mercado ✓",
              );
              router.refresh();
            } else {
              setFeedback(res.error);
            }
          }}
        >
          {busy ? "Buscando…" : "Buscar cotação de mercado"}
        </Button>
      </div>
      {feedback && (
        <p className={feedback.includes("✓") ? "text-sm font-medium text-green-700" : "text-sm text-red-600"}>
          {feedback}
        </p>
      )}
    </form>
  );
}
