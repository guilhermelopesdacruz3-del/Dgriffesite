"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveLensPackage, deleteLensPackage } from "@/actions/admin/lenses";
import { lensPackageSchema, type LensPackageInput } from "@/lib/validators/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";

/**
 * Fase 13 — gestão das lentes vendidas com óculos de grau (e avulsas):
 * listagem + formulário criar/editar em linha, no padrão dos cupons.
 */
export type LensRow = {
  id: string;
  name: string;
  description: string;
  price: string;
  active: boolean;
  sortOrder: number;
};

export function LensManager({ rows }: { rows: LensRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LensPackageInput>({ resolver: zodResolver(lensPackageSchema) });

  function startEdit(row?: LensRow) {
    setFeedback(null);
    reset(
      row
        ? {
            name: row.name,
            description: row.description ?? "",
            price: row.price,
            sortOrder: String(row.sortOrder),
            active: row.active,
          }
        : { name: "", description: "", price: "", sortOrder: "0", active: true },
    );
    setEditing(row ? row.id : "new");
  }

  async function onSaved() {
    setEditing(null);
    setFeedback("Lente salva ✓");
    router.refresh();
  }

  async function onRemove(id: string) {
    const res = await deleteLensPackage(id);
    setConfirming(null);
    setFeedback(res.ok ? "Lente removida ✓" : res.error);
    router.refresh();
  }

  if (editing !== null) {
    return (
      <form
        onSubmit={handleSubmit(async (values) => {
          const res = await saveLensPackage(values, editing === "new" ? undefined : editing);
          if (res.ok) await onSaved();
          else setFeedback(res.error);
        })}
        className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6"
      >
        <h2 className="font-serif text-lg">{editing === "new" ? "Nova lente" : "Editar lente"}</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="l-name">Nome (aparece no checkout)</Label>
            <Input id="l-name" className="mt-1.5" placeholder="Visão Clara HD + Azul" {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="l-price">Preço (R$) — valor da LENTE, sem a armação</Label>
            <Input id="l-price" className="mt-1.5" inputMode="decimal" placeholder="349.90" {...register("price")} />
            <FieldError>{errors.price?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="l-order">Ordem de exibição (menor primeiro)</Label>
            <Input id="l-order" className="mt-1.5" inputMode="numeric" {...register("sortOrder")} />
            <FieldError>{errors.sortOrder?.message}</FieldError>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-accent-600" {...register("active")} />
              Disponível para venda
            </label>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="l-desc">Descrição (o cliente lê no checkout)</Label>
            <textarea
              id="l-desc"
              rows={3}
              maxLength={400}
              className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]"
              placeholder="Lente nacional com tratamento antirreflexo e proteção contra luz azul…"
              {...register("description")}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar lente"}
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
          + Nova lente
        </Button>
      </div>
      {feedback && <p className="text-sm font-medium text-green-700">{feedback}</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Nenhuma lente cadastrada. Cadastre ao menos uma para vender óculos de grau no site.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Lente</th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">Preço</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Ordem</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.name}</span>
                    <span className="block max-w-md text-[11px] text-stone-500">{l.description}</span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{formatBRL(Number(l.price))}</td>
                  <td className="hidden px-4 py-3 text-stone-600 md:table-cell">{l.sortOrder}</td>
                  <td className="px-4 py-3">
                    {l.active ? <Badge variant="sale">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(l)}>
                        Editar
                      </Button>
                      {confirming === l.id ? (
                        <Button variant="danger" size="sm" onClick={() => onRemove(l.id)}>
                          Confirmar
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(l.id)}
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
