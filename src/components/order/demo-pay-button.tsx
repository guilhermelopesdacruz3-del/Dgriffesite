/**
 * Botão do modo demonstração: marca o pagamento como aprovado através de
 * /api/demo/pagar (que se recusa quando MERCADO_PAGO_ACCESS_TOKEN existe).
 * Serve para testar o pós-pagamento localmente sem gateway.
 */
"use client";

import { useState } from "react";

export function DemoPayButton({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);

  async function handlePay() {
    setBusy(true);
    try {
      await fetch("/api/demo/pagar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={busy}
      className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
    >
      {busy ? "Processando…" : "Simular pagamento aprovado"}
    </button>
  );
}
