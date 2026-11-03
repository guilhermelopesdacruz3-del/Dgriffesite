"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { registerUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Checkbox } from "@/components/ui/field";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    // Auditoria (A10): consentimento NÃO vem pré-marcado (LGPD) — a pessoa
    // marca se quiser receber novidades.
    defaultValues: { name: "", email: "", password: "", passwordConfirm: "", marketingOptIn: false },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);

    // 1) cria a conta (server action valida tudo de novo no servidor)
    const result = await registerUser(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    // 2) já loga com as credenciais informadas
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (res?.error) {
      setServerError("Conta criada! Faça login para continuar.");
      return;
    }

    router.push(callbackUrl || "/minha-conta");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" autoComplete="name" placeholder="Como você quer ser chamado" {...register("name")} />
        <FieldError>{errors.name?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com.br" {...register("email")} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="•••••••• (mín. 8)" {...register("password")} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="passwordConfirm">Confirmar senha</Label>
          <Input id="passwordConfirm" type="password" autoComplete="new-password" placeholder="repita a senha" {...register("passwordConfirm")} />
          <FieldError>{errors.passwordConfirm?.message}</FieldError>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-stone-600">
        <Checkbox className="mt-0.5" {...register("marketingOptIn")} />
        Quero receber novidades e ofertas por e-mail (opcional, cancelável a qualquer momento).
      </label>

      {serverError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
