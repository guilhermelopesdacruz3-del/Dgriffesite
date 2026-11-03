"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveCoupon, deleteCoupon } from "@/actions/admin/coupons";
import { couponSchema, type CouponInput } from "@/lib/validators/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";

/**
 * Fase 6 — gestão de cupons: listagem + formulário criar/editar em linha.
 */
export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FIXED";
  value: string;
  minOrder: string | null;
  maxUses: number | null;
  usedCount: number;
  endsAt: string | null;
  active: boolean;
};

export function CouponManager({ rows }: { rows: CouponRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CouponInput>({ resolver: zodResolver(couponSchema) });

  function startEdit(row?: CouponRow) {
    setFeedback(null);
    reset(
      row
        ? {
            code: row.code,
            description: row.description ?? "",
            type: row.type,
            value: row.value,
            minOrder: row.minOrder ?? "",
            maxUses: row.maxUses ? String(row.maxUses) : "",
            endsAt: row.endsAt ?? "",
            active: row.active,
          }
        : { code: "", description: "", type: "PERCENT", value: "", minOrder: "", maxUses: "", endsAt: "", active: true },
    );
    setEditing(row ? row.id : "new");
  }

  async function onSaved() {
    setEditing(null);
    setFeedback("Cupom salvo ✓");
    router.refresh();
  }

  async function onRemove(id: string) {
    const res = await deleteCoupon(id);
    setConfirming(null);
    setFeedback(res.ok ? "Cupom removido ✓" : res.error);
    router.refresh();
  }

  if (editing !== null) {
    return (
      <form
        onSubmit={handleSubmit(async (values) => {
          const res = await saveCoupon(values, editing === "new" ? undefined : editing);
          if (res.ok) await onSaved();
          else setFeedback(res.error);
        })}
        className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6"
      >
        <h2 className="font-serif text-lg">{editing === "new" ? "Novo cupom" : "Editar cupom"}</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-code">Código</Label>
            <Input id="c-code" className="mt-1.5 font-mono uppercase" placeholder="PRIMEIRA15" {...register("code")} />
            <FieldError>{errors.code?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-type">Tipo</Label>
            <select id="c-type" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("type")}>
              <option value="PERCENT">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="c-value">Valor</Label>
            <Input id="c-value" className="mt-1.5" inputMode="decimal" placeholder="15" {...register("value")} />
            <FieldError>{errors.value?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-min">Pedido mínimo (R$, opcional)</Label>
            <Input id="c-min" className="mt-1.5" inputMode="decimal" {...register("minOrder")} />
            <FieldError>{errors.minOrder?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-max">Limite de usos (vazio = ilimitado)</Label>
            <Input id="c-max" className="mt-1.5" inputMode="numeric" {...register("maxUses")} />
            <FieldError>{errors.maxUses?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-ends">Termina em (opcional)</Label>
            <Input id="c-ends" className="mt-1.5" type="date" {...register("endsAt")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-desc">Descrição interna (opcional)</Label>
            <Input id="c-desc" className="mt-1.5" {...register("description")} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-accent-600" {...register("active")} />
            Ativo
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar cupom"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
        </div>
        {feedback && <p className="mt-3 text-sm text-red-600">{feedback}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="accent" size="sm" onClick={() => startEdit()}>
          + Novo cupom
        </Button>
      </div>
      {feedback && <p className="text-sm font-medium text-green-700">{feedback}</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Nenhum cupom cadastrado. Crie um para campanhas (ex.: primeira compra).
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Código</th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">Desconto</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Condições</th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">Usos</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{c.code}</span>
                    {c.description ? <span className="block text-[11px] text-stone-500">{c.description}</span> : null}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {c.type === "PERCENT" ? `${c.value}%` : formatBRL(Number(c.value))}
                  </td>
                  <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                    {c.minOrder ? `mín. ${formatBRL(Number(c.minOrder))}` : "sem mínimo"}
                    {c.endsAt ? ` · até ${c.endsAt}` : ""}
                  </td>
                  <td className="hidden px-4 py-3 text-stone-600 lg:table-cell">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? <Badge variant="sale">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                        Editar
                      </Button>
                      {confirming === c.id ? (
                        <Button variant="danger" size="sm" onClick={() => onRemove(c.id)}>
                          Confirmar
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(c.id)}
                          className="cursor-pointer px-2 text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
