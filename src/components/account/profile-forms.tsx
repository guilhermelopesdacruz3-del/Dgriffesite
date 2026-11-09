"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, profileSchema, type ChangePasswordInput, type ProfileInput } from "@/lib/validators/account";
import { savePreferences, saveProfile, changePassword } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";

/**
 * Fase 5 — formulários de "Dados e senha": perfil (nome/telefone/CPF),
 * troca de senha e preferências LGPD. Server actions com feedback inline.
 */

function formatCpf(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ------------------------------------------------------------------ Perfil

export function ProfileForm({
  name,
  phone,
  documentValue,
}: {
  name: string;
  phone: string | null;
  documentValue: string | null;
}) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: name ?? "",
      phone: phone ? formatPhone(phone) : "",
      document: documentValue ? formatCpf(documentValue) : "",
    },
  });

  async function onSubmit(values: ProfileInput) {
    setServerMessage(null);
    setOk(false);
    const res = await saveProfile(values);
    if (res.ok) {
      setOk(true);
      router.refresh();
    } else {
      setServerMessage(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-stone-200 p-6">
      <h2 className="font-serif text-lg">Dados pessoais</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="perfil-nome">Nome completo</Label>
          <Input id="perfil-nome" className="mt-1.5" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="perfil-telefone">Telefone (WhatsApp)</Label>
          <Input
            id="perfil-telefone"
            className="mt-1.5"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            {...register("phone")}
            onChange={(e) => {
              setValue("phone", formatPhone(e.target.value), { shouldValidate: false });
            }}
          />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="perfil-documento">CPF (opcional)</Label>
          <Input
            id="perfil-documento"
            className="mt-1.5"
            inputMode="numeric"
            placeholder="000.000.000-00"
            {...register("document")}
            onChange={(e) => {
              setValue("document", formatCpf(e.target.value), { shouldValidate: false });
            }}
          />
          <FieldError>{errors.document?.message ?? "Usado na garantia e notas fiscais"}</FieldError>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar dados"}
        </Button>
        {ok && <span className="text-sm font-medium text-green-700">Atualizado ✓</span>}
        {serverMessage && <span className="text-sm text-red-600">{serverMessage}</span>}
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Senha

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setServerMessage(null);
    setOk(false);
    const res = await changePassword(values);
    if (res.ok) {
      setOk(true);
      reset({ current: "", next: "", confirm: "" });
    } else {
      setServerMessage(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-stone-200 p-6">
      <h2 className="font-serif text-lg">
        {hasPassword ? "Trocar senha" : "Criar senha de acesso"}
      </h2>
      {!hasPassword && (
        <FieldHint>Sua conta foi criada pelo Google — defina uma senha para entrar com e-mail também.</FieldHint>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {hasPassword && (
          <div className="sm:col-span-2">
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input id="senha-atual" type="password" className="mt-1.5" autoComplete="current-password" {...register("current")} />
            <FieldError>{errors.current?.message}</FieldError>
          </div>
        )}
        <div>
          <Label htmlFor="senha-nova">{hasPassword ? "Nova senha" : "Senha"}</Label>
          <Input id="senha-nova" type="password" className="mt-1.5" autoComplete="new-password" {...register("next")} />
          <FieldError>{errors.next?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="senha-confirm">Confirmar nova senha</Label>
          <Input id="senha-confirm" type="password" className="mt-1.5" autoComplete="new-password" {...register("confirm")} />
          <FieldError>{errors.confirm?.message}</FieldError>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : hasPassword ? "Trocar senha" : "Definir senha"}
        </Button>
        {ok && <span className="text-sm font-medium text-green-700">Senha salva ✓</span>}
        {serverMessage && <span className="text-sm text-red-600">{serverMessage}</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------- Preferências

export function PreferencesForm({
  marketingOptIn,
  tryOnPhotosOpt,
}: {
  marketingOptIn: boolean;
  tryOnPhotosOpt: boolean;
}) {
  const router = useRouter();
  const [marketing, setMarketing] = useState(marketingOptIn);
  const [photos, setPhotos] = useState(tryOnPhotosOpt);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  async function persist(nextMarketing: boolean, nextPhotos: boolean) {
    setSaving(true);
    setOk(false);
    const res = await savePreferences({ marketingOptIn: nextMarketing, tryOnPhotosOpt: nextPhotos });
    setSaving(false);
    if (res.ok) {
      setOk(true);
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 p-6" aria-label="Preferências de privacidade">
      <h2 className="font-serif text-lg">Preferências (LGPD)</h2>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={marketing}
          disabled={saving}
          onChange={(e) => {
            setMarketing(e.target.checked);
            persist(e.target.checked, photos);
          }}
          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-accent-600 focus:ring-accent-600"
        />
        <span className="text-sm leading-relaxed">
          Quero receber novidades e ofertas da Óptica Performance por e-mail/WhatsApp.
          <span className="block text-xs text-stone-500">
            Você pode desativar quando quiser (LGPD — Lei 13.709/2018).
          </span>
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={photos}
          disabled={saving}
          onChange={(e) => {
            setPhotos(e.target.checked);
            persist(marketing, e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-accent-600 focus:ring-accent-600"
        />
        <span className="text-sm leading-relaxed">
          Permito que as fotos do provador virtual sejam usadas para melhorar as recomendações.
          <span className="block text-xs text-stone-500">
            As fotos nunca são publicadas — uso interno de ajuste do provador.
          </span>
        </span>
      </label>

      <p aria-live="polite" className="mt-3 text-xs">
        {saving ? <span className="text-stone-500">Salvando…</span> : null}
        {ok ? <span className="font-medium text-green-700">Preferências salvas ✓</span> : null}
      </p>
    </section>
  );
}
