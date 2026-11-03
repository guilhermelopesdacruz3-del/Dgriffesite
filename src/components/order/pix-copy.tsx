/**
 * Copiar código Pix (copia-e-cola) com feedback visual de 2s.
 * Client-side — chamado a partir da página server do pedido.
 */
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function PixCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bloqueado (http sem localhost): usuário copia manualmente
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-3 w-full cursor-pointer break-all rounded-xl border border-stone-200 bg-stone-50 p-3 text-left text-xs text-stone-600 hover:border-accent-600"
    >
      <span className="mb-1 flex items-center gap-1 font-semibold text-ink">
        {copied ? (
          <>
            <Check size={13} className="text-emerald-700" /> Copiado!
          </>
        ) : (
          <>
            <Copy size={13} /> Pix copia-e-cola (clique)
          </>
        )}
      </span>
      {code}
    </button>
  );
}
