"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  requestPasswordReset,
  confirmPasswordReset,
} from "@/actions/reset-senha";
import { Button } from "@/components/ui/button";

/**
 * Fase 11 — /recuperar-senha, com dois modos na mesma página:
 *  • sem ?token=: formulário para pedir o e-mail com o link;
 *  • com ?token=: form de nova senha (o link do e-mail chega aqui).
 */
export function RecuperarSenhaForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const modo = token ? "confirmar" : "pedir";

  // ---- pedir link ----
  const [email, setEmail] = useState("");
  const [pedido, setPedido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // ---- nova senha ----
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setPedido(null);
    try {
      const res = await requestPasswordReset({ email });
      // Sempre "ok" na 1ª etapa (anti-enumeração) — mensagem neutra.
      if (res.ok) setPedido(res.message);
    } finally {
      setEnviando(false);
    }
  }

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await confirmPasswordReset({ token, next, confirm });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setConcluido(true);
    } finally {
      setEnviando(false);
    }
  }

  if (modo === "confirmar" && concluido) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl">Senha trocada!</h1>
        <p className="mt-2 text-sm text-stone-500">
          Sua nova senha já está funcionando. Entre com ela agora.
        </p>
        <Button href="/entrar" className="mt-6" size="md">
          Ir para o login
        </Button>
      </div>
    );
  }

  if (modo === "confirmar") {
    return (
      <form onSubmit={trocar} className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl">Criar nova senha</h1>
        <p className="mt-2 text-sm text-stone-500">
          Escolha uma senha nova com pelo menos 8 caracteres, contendo letras e números.
        </p>

        <label className="mt-6 block text-sm font-medium">
          Nova senha
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Repetir nova senha
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-ink"
          />
        </label>

        {erro && <p className="mt-4 text-sm text-red-700">{erro}</p>}

        <Button type="submit" className="mt-6 w-full" disabled={enviando}>
          {enviando ? "Trocando…" : "Trocar senha"}
        </Button>
      </form>
    );
  }

  // Modo "pedir"
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="font-serif text-2xl">Esqueci minha senha</h1>
      <p className="mt-2 text-sm text-stone-500">
        Informe o e-mail da conta e enviamos um link para você criar uma senha nova.
        O link vale 1 hora.
      </p>

      {!pedido ? (
        <form onSubmit={pedir} className="mt-6">
          <label className="block text-sm font-medium">
            E-mail cadastrado
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-ink"
            />
          </label>
          <Button type="submit" className="mt-5 w-full" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar link"}
          </Button>
          <p className="mt-4 text-center text-sm">
            <Link href="/entrar" className="underline underline-offset-4 hover:text-ink">
              Lembrei a senha — voltar ao login
            </Link>
          </p>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{pedido}</p>
      )}
    </div>
  );
}
