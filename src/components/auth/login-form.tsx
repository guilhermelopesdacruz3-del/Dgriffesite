"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/field";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      // redirect:false → tratamos o resultado manualmente (mensagensPT)
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!res || res.error) {
        if (res?.error === "rate_limited") {
          setServerError("Muitas tentativas. Aguarde um minuto e tente de novo.");
        } else {
          setServerError("E-mail ou senha inválidos.");
        }
        return;
      }

      router.push(callbackUrl || "/minha-conta");
      router.refresh();
    } catch {
      setServerError("Erro inesperado. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" placeholder="voce@email.com.br" autoComplete="email" {...register("email")} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
        <FieldError>{errors.password?.message}</FieldError>
        <FieldHint>
          Esqueceu? Em breve o botão de recuperação chega na sua conta — por enquanto,
          fale com a gente no WhatsApp.
        </FieldHint>
      </div>

      {serverError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-center text-sm text-stone-500">
        Não tem conta?{" "}
        <Link href="/criar-conta" className="font-medium text-accent-700 underline-offset-4 hover:underline">
          Criar agora
        </Link>
      </p>
    </form>
  );
}
