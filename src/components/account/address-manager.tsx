"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressInput } from "@/lib/validators/account";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Fase 5 — CRUD de endereços de entrega: listagem com padrão, formulário de
 * criar/editar e remoção em duas etapas. Mutations por server actions.
 */

export type AddressItem = {
  id: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
  receiverName: string | null;
  phone: string | null;
};

function formatCep(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const EMPTY: AddressInput = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  isDefault: false,
  receiverName: "",
  phone: "",
};

export function AddressManager({ addresses }: { addresses: AddressItem[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // null = lista; "new" = criar; id = editando esse endereço
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
  });

  function startEdit(item?: AddressItem) {
    setFeedback(null);
    setConfirming(null);
    reset(
      item
        ? {
            cep: formatCep(item.cep),
            street: item.street,
            number: item.number,
            complement: item.complement ?? "",
            district: item.district,
            city: item.city,
            state: item.state,
            isDefault: item.isDefault,
            receiverName: item.receiverName ?? "",
            phone: item.phone ?? "",
          }
        : { ...EMPTY },
    );
    setEditing(item ? item.id : "new");
  }

  async function onSaved() {
    setEditing(null);
    setFeedback("Endereço salvo ✓");
    router.refresh();
  }

  async function onRemove(id: string) {
    setBusy(true);
    const res = await deleteAddress(id);
    setBusy(false);
    setConfirming(null);
    if (res.ok) {
      setFeedback("Endereço removido ✓");
      router.refresh();
    } else {
      setFeedback(res.error);
    }
  }

  async function onSetDefault(id: string) {
    setBusy(true);
    const res = await setDefaultAddress(id);
    setBusy(false);
    if (res.ok) {
      setFeedback("Padrão atualizado ✓");
      router.refresh();
    } else {
      setFeedback(res.error);
    }
  }

  // ------------------------------------------------------------- Lista
  if (editing === null) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-lg">Endereços de entrega</h2>
          <Button variant="soft" size="sm" onClick={() => startEdit()}>
            + Novo endereço
          </Button>
        </div>

        {feedback && <p className="text-sm font-medium text-green-700">{feedback}</p>}

        {addresses.length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center text-sm text-stone-500">
            Nenhum endereço cadastrado. O endereço padrão aparece no checkout.
          </p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={cn(
                "rounded-2xl border p-5",
                a.isDefault ? "border-accent-600 bg-accent-50/40" : "border-stone-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed">
                  {a.street}, {a.number}
                  {a.complement ? ` — ${a.complement}` : ""}
                  <br />
                  {a.district} — {a.city}/{a.state}
                  <br />
                  CEP {formatCep(a.cep)}
                  {a.receiverName ? <><br />Recebe: {a.receiverName}</> : null}
                  {a.phone ? <><br />Tel.: {a.phone}</> : null}
                </p>
                {a.isDefault && <Badge variant="sale">Padrão</Badge>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!a.isDefault && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onSetDefault(a.id)}>
                    Tornar padrão
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                  Editar
                </Button>
                {confirming === a.id ? (
                  <>
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => onRemove(a.id)}>
                      Confirmar remoção
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(a.id)}
                    className="cursor-pointer px-2 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ------------------------------------------------------------- Form
  return (
    <div className="rounded-2xl border border-stone-200 p-6">
      <h2 className="font-serif text-lg">
        {editing === "new" ? "Novo endereço" : "Editar endereço"}
      </h2>
      <FieldError>
        {errors.cep?.message || errors.street?.message || errors.number?.message || errors.district?.message || errors.city?.message || errors.state?.message}
      </FieldError>

      <form
        onSubmit={handleSubmit(async (values) => {
          await saveAddress(values, editing === "new" ? undefined : editing);
          await onSaved();
        })}
        className="mt-5 grid gap-4 sm:grid-cols-6"
      >
        <div className="sm:col-span-2">
          <Label htmlFor="end-cep">CEP</Label>
          <Input
            id="end-cep"
            className="mt-1.5"
            inputMode="numeric"
            placeholder="00000-000"
            {...register("cep")}
            onChange={(e) => setValue("cep", formatCep(e.target.value), { shouldValidate: false })}
          />
          <FieldError>{errors.cep?.message}</FieldError>
        </div>
        <div className="sm:col-span-4">
          <Label htmlFor="end-street">Rua</Label>
          <Input id="end-street" className="mt-1.5" {...register("street")} />
          <FieldError>{errors.street?.message}</FieldError>
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="end-number">Número</Label>
          <Input id="end-number" className="mt-1.5" {...register("number")} />
          <FieldError>{errors.number?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="end-complement">Complemento (opcional)</Label>
          <Input id="end-complement" className="mt-1.5" {...register("complement")} />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="end-district">Bairro</Label>
          <Input id="end-district" className="mt-1.5" {...register("district")} />
          <FieldError>{errors.district?.message}</FieldError>
        </div>
        <div className="sm:col-span-4">
          <Label htmlFor="end-city">Cidade</Label>
          <Input id="end-city" className="mt-1.5" {...register("city")} />
          <FieldError>{errors.city?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="end-state">UF</Label>
          <Input id="end-state" className="mt-1.5" maxLength={2} {...register("state")} />
          <FieldError>{errors.state?.message}</FieldError>
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="end-receiver">Quem recebe (opcional)</Label>
          <Input id="end-receiver" className="mt-1.5" {...register("receiverName")} />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="end-phone">Telefone no local (opcional)</Label>
          <Input id="end-phone" className="mt-1.5" inputMode="tel" {...register("phone")} />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>

        <label className="sm:col-span-6 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-accent-600 focus:ring-accent-600"
            {...register("isDefault")}
          />
          <span className="text-sm">Tornar este o endereço padrão</span>
        </label>

        <div className="sm:col-span-6 flex gap-3 border-t border-stone-100 pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar endereço"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
