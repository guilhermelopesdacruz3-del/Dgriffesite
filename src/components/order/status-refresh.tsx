/**
 * Auto-atualização da página do pedido enquanto o pagamento está
 * aguardando o gateway. A cada 8s dispara router.refresh() — o conteúdo
 * server-side reaparece com o status novo (Pix/webhook).
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StatusAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(id);
  }, [router]);

  // Sem visual: só o refresh em background
  return null;
}
