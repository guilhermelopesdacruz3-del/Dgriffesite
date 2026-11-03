"use client";

/**
 * Fase 7b — cartão da receita vinculada no pedido (admin): visualiza o
 * arquivo (redirect para URL assinada do bucket privado), valida ou recusa
 * com nota. O botão vira "Confirmar recusa" no 2º clique para evitar engano.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText, Loader2, XCircle } from "lucide-react";
import { reviewPrescriptionAction } from "@/actions/admin/prescriptions";

export interface PrescriptionCard {
  id: string;
  fileName: string;
  status: "PENDING" | "VALIDATED" | "REJECTED";
  notes: string | null;
  createdAt: Date | string;
}

export function PrescriptionReview({ receita }: { receita: PrescriptionCard }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [erro, setErro] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const readOnly = receita.status !== "PENDING";

  async function decidir(decision: "VALIDATED" | "REJECTED") {
    setState("busy");
    setErro(null);
    const result = await reviewPrescriptionAction({
      prescriptionId: receita.id,
      decision,
      note: note.trim() || null,
    });
    if (result.ok) {
      setState("done");
      router.refresh();
    } else {
      setErro(result.message);
      setState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <FileText size={16} className="shrink-0 text-stone-400" aria-hidden />
          <span className="truncate font-medium" title={receita.fileName}>
            {receita.fileName}
          </span>
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            receita.status === "PENDING"
              ? "bg-amber-100 text-amber-800"
              : receita.status === "VALIDATED"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-700"
          }`}
        >
          {receita.status === "PENDING" ? "Em análise" : receita.status === "VALIDATED" ? "Validada" : "Recusada"}
        </span>
      </div>
      {receita.notes && <p className="mt-2 text-xs text-stone-500">Observação do cliente: {receita.notes}</p>}

      <a
        href={`/api/minhas-receitas/${receita.id}/arquivo`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline"
      >
        <Eye size={13} /> Ver arquivo da receita (link assinado, expira em 15 min)
      </a>

      {!readOnly && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Nota interna/para o cliente (opcional)"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent-600"
          />
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void decidir("VALIDATED")}
                disabled={state === "busy"}
                className="flex-1 cursor-pointer rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {state === "busy" ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Confirmar VALIDAÇÃO"}
              </button>
              <button
                type="button"
                onClick={() => void decidir("REJECTED")}
                disabled={state === "busy"}
                className="flex-1 cursor-pointer rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                Confirmar RECUSA
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void decidir("VALIDATED")}
                className="flex-1 cursor-pointer rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                <CheckCircle2 size={13} className="mr-1 inline" /> Validar receita
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex-1 cursor-pointer rounded-full border border-red-600 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
              >
                <XCircle size={13} className="mr-1 inline" /> Recusar
              </button>
            </div>
          )}
          {erro && <p className="text-xs text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}
