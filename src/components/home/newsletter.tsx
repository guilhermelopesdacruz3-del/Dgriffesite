"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Container } from "@/components/ui/container";
import { storeConfig } from "@/lib/config";

/**
 * Newsletter com cupom de primeira compra.
 * Fase 9: conecta ao backend (lead + e-mail via Resend). Hoje só registra
 * a intenção localmente e revela o cupom — sem promessa de envio.
 */
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <section className="py-16 md:py-20">
      <Container>
        <div className="rounded-3xl bg-accent-50 px-6 py-12 text-center md:px-16">
          <h2 className="font-serif text-3xl leading-tight md:text-4xl">
            15% OFF na sua primeira compra
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-stone-600">
            Receba novidades, dicas práticas de saúde ocular e o cupom de boas-vindas.
            Sem spam — você sai quando quiser.
          </p>

          {done ? (
            <div className="mx-auto mt-8 max-w-md">
              <p className="flex items-center justify-center gap-2 font-medium text-accent-700">
                <Check size={18} aria-hidden /> Inscrição confirmada!
              </p>
              <p className="mt-2 text-sm text-stone-600">Use o cupom abaixo no carrinho:</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(storeConfig.commerce.firstPurchaseCoupon);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-accent-600 bg-white px-5 py-2.5 font-mono text-lg font-semibold text-accent-700 transition-colors hover:bg-accent-600 hover:text-white"
              >
                {storeConfig.commerce.firstPurchaseCoupon}
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? "Cupom copiado" : ""}
              </span>
            </div>
          ) : (
            <form
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (/.+@.+\..+/.test(email)) setDone(true);
              }}
            >
              <Input
                type="email"
                required
                placeholder="seu@email.com.br"
                aria-label="Seu e-mail"
                className="h-12 rounded-full sm:flex-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="accent" size="lg" className="shrink-0">
                Quero o cupom
              </Button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
