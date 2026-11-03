"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteMyAccount, exportMyData } from "@/actions/account";

/**
 * Painel LGPD (auditoria A12): exercício dos direitos de acesso e eliminação
 * sem precisar falar com a loja. Duas ações bem separadas:
 *  • Exportar — baixa um JSON com todos os dados pessoais;
 *  • Excluir — pede a palavra "EXCLUIR" e apaga receitas/endereços/favoritos;
 *    os pedidos passados são anonimizados (ficam na contabilidade da loja).
 */
export function LgpdPanel() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    setError(null);
    try {
      const result = await exportMyData();
      if (!result.ok || !result.json) {
        setError(result.ok ? "Exportação vazia." : result.error);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `meus-dados-pierre-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(u);
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteMyAccount(confirmText.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Sesão encerrada pela própria ação — a página de conta não existe mais.
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      aria-label="Meus dados (LGPD)"
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h2 className="flex items-center gap-2 font-serif text-xl">
        <ShieldAlert className="size-5 text-stone-500" aria-hidden />
        Seus dados privados (LGPD)
      </h2>

      {/* Exportação */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4">
        <div>
          <p className="font-medium">Exportar meus dados</p>
          <p className="text-sm text-stone-500">
            Baixe um arquivo com perfil, endereços, pedidos, receitas e favoritos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={download} disabled={exporting}>
          <Download className="size-4" aria-hidden />
          {exporting ? "Preparando…" : "Baixar JSON"}
        </Button>
      </div>

      {/* Eliminação */}
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 font-medium text-red-900">
          <Trash2 className="size-4" aria-hidden />
          Excluir minha conta
        </p>
        <p className="mt-1 text-sm text-red-800/80">
          Apaga receitas (e os arquivos), endereços, favoritos e o cadastro. Pedidos passados ficam
          anonimizados para fins contábeis. <strong>Não dá para desfazer.</strong>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Digite "EXCLUIR"'
            aria-label='Confirmação — digite EXCLUIR'
            className="w-52 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <Button
            variant="danger"
            size="sm"
            onClick={remove}
            disabled={deleting || confirmText.trim().toUpperCase() !== "EXCLUIR"}
          >
            {deleting ? "Excluindo…" : "Excluir para sempre"}          </Button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
