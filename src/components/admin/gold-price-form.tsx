"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveGoldPrice } from "@/actions/admin/gold";
import { goldPriceSchema, type GoldPriceInput } from "@/lib/validators/admin";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

/**
 * Fase 14 — edita a cotação do ouro (R$/grama). Salvar recalcula
 * automaticamente o preço de todas as joias: peso × cotação × 2,7.
 */
export function GoldPriceForm({ current }: { current: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);

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
      <Button type="submit" variant="accent" className="mt-2 self-start" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar cotação"}
      </Button>
      {feedback && (
        <p className={feedback.includes("✓") ? "text-sm font-medium text-green-700" : "text-sm text-red-600"}>
          {feedback}
        </p>
      )}
    </form>
  );
}
