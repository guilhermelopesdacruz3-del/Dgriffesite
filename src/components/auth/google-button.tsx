"use client";

import { signIn } from "next-auth/react";

/**
 * Botão OAuth — apenas texto (sem imitar logotipos de terceiros,
 * conforme requisito de identidade própria).
 */
export function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: callbackUrl ?? "/minha-conta" })}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white text-[15px] font-medium transition-colors hover:bg-stone-50"
    >
      Continuar com Google
    </button>
  );
}
