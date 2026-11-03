"use client";

/**
 * Painel de receitas do cliente (Fase 7b): upload da foto/PDF da receita e a
 * lista com o status da análise do óptico. O arquivo vai direto para o bucket
 * privado via /api/minhas-receitas/upload; a lista recarrega em seguida.
 */
import { useCallback, useRef, useState } from "react";
import { CheckCircle2, Clock, FilePlus2, FileText, Loader2, Send, Trash2, XCircle } from "lucide-react";

export interface ReceitaRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "PENDING" | "VALIDATED" | "REJECTED";
  notes: string | null;
  createdAt: string | Date;
  /** Estado transiente do botão de exclusão (2 cliques). */
  _confirming?: boolean;
}

const STATUS_UI = {
  PENDING: { label: "Em análise", tone: "bg-amber-50 text-amber-800", icon: Clock },
  VALIDATED: { label: "Validada", tone: "bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  REJECTED: { label: "Recusada", tone: "bg-red-50 text-red-700", icon: XCircle },
} as const;

function fecha(d: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}

function kb(n: number) {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.round(n / 1024)} KB`;
}

export function ReceitasPanel({ initial }: { initial: ReceitaRow[] }) {
  const [receitas, setReceitas] = useState<ReceitaRow[]>(initial);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/minhas-receitas", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { receitas: ReceitaRow[] };
      setReceitas(data.receitas);
    }
  }, []);

  async function upload(file: File) {
    setErro(null);
    setOkMsg(null);
    setSending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/minhas-receitas/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (res.ok && data.ok) {
        setOkMsg("Receita enviada! O óptico analisa e você vê o status aqui e no checkout.");
        await reload();
      } else {
        setErro(data.message ?? "Falha no envio — tente novamente.");
      }
    } catch {
      setErro("Rede interrompida — tente novamente.");
    } finally {
      setSending(false);
    }
  }

  async function excluir(id: string) {
    setErro(null);
    // exclusão em 2 cliques (confirmação)
    const target = receitas.find((r) => r.id === id);
    if (!target || target.status !== "PENDING") return;
    if (!target._confirming) {
      setReceitas((rs) => rs.map((r) => (r.id === id ? { ...r, _confirming: true } : r)));
      window.setTimeout(
        () => setReceitas((rs) => rs.map((r) => (r.id === id ? { ...r, _confirming: false } : r))),
        4000,
      );
      return;
    }
    const { deleteMyReceita } = await import("@/actions/minhas-receitas");
    const result = await deleteMyReceita(id);
    if (result.ok) {
      await reload();
    } else {
      setErro(result.message);
      await reload();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <FilePlus2 size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
          Enviar receita
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Foto ou digitalização da receita do oftalmologista (JPEG, PNG, WEBP ou PDF — até 10 MB).
          A ótica valida antes de montar as lentes dos seus pedidos.
        </p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700">
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={sending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden /> Enviando…
            </>
          ) : (
            <>
              <Send size={15} aria-hidden /> Escolher arquivo
            </>
          )}
        </label>
        {okMsg && <p className="mt-3 text-sm font-medium text-emerald-700">{okMsg}</p>}
        {erro && <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>}
      </section>

      {/* Lista */}
      <section aria-label="Minhas receitas" className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {receitas.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-stone-500">
            Nenhuma receita enviada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {receitas.map((r) => {
              const ui = STATUS_UI[r.status];
              const Icone = ui.icon;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <FileText size={18} className="shrink-0 text-stone-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={r.fileName}>
                      {r.fileName}
                    </p>
                    <p className="text-xs text-stone-400">
                      {fecha(r.createdAt)} · {kb(r.sizeBytes)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${ui.tone}`}>
                    <Icone size={12} aria-hidden /> {ui.label}
                  </span>
                  <a
                    href={`/api/minhas-receitas/${r.id}/arquivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent-700 hover:underline"
                  >
                    Abrir
                  </a>
                  {r.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => void excluir(r.id)}
                      className="inline-flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-red-600"
                    >
                      <Trash2 size={13} aria-hidden />
                      {r._confirming ? "Confirmar exclusão" : "Excluir"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
