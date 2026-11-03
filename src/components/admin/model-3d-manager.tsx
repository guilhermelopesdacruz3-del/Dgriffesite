"use client";

/**
 * Fase 7 — cartão do modelo 3D do produto na página de edição (admin).
 *
 * - Upload do `.glb` (via API /api/admin/model3d/upload, com guarda admin e
 *   checagem de assinatura binária);
 * - "Calibrar no estúdio": abre o provador em modo calibração (?calib=1),
 *   onde os deslizadores ajustam o encaixe e o botão salva no banco;
 * - Desativar: remove o modelo (a loja volta a mostrar a armação padrão).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, CheckCircle2, Loader2, RotateCcw, ExternalLink, Boxes } from "lucide-react";
import { deactivateModel3dAction } from "@/actions/admin/models-3d";

interface Model3dData {
  id: string;
  glbUrl: string;
  sizeBytes: number;
  active: boolean;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  tilt: number;
  turn: boolean;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export function Model3dManager({
  productId,
  slug,
  initial,
}: {
  productId: string;
  slug: string;
  initial: Model3dData | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"none" | "uploading" | "deactivating">("none");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function upload(file: File) {
    setFeedback(null);
    setBusy("uploading");
    try {
      const form = new FormData();
      form.append("productId", productId);
      form.append("file", file);
      const res = await fetch("/api/admin/model3d/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setFeedback({ ok: false, text: data.message ?? "Falha no envio." });
      } else {
        setFeedback({
          ok: true,
          text: "Modelo salvo ✓ — abra o estúdio para calibrar o encaixe.",
        });
        router.refresh();
      }
    } catch {
      setFeedback({ ok: false, text: "Rede interrompida — tente novamente." });
    } finally {
      setBusy("none");
    }
  }

  async function deactivate() {
    if (!initial) return;
    setFeedback(null);
    setBusy("deactivating");
    const result = await deactivateModel3dAction(initial.id);
    setBusy("none");
    setConfirmingRemove(false);
    if (result.ok) {
      setFeedback({ ok: true, text: "Modelo desativado — a loja usa a armação padrão." });
      router.refresh();
    } else {
      setFeedback({ ok: false, text: result.message });
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg">
        <Boxes size={18} className="text-accent-700" strokeWidth={1.7} aria-hidden />
        Modelo 3D (provador)
      </h2>
      <p className="mt-1 text-xs text-stone-500">
        Armação .glb que os clientes experimentam para este produto. Enquanto
        não houver modelo, a loja exibe a armação padrão.
      </p>

      {initial ? (
        <div className="mt-4 rounded-xl bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Arquivo ativo</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                initial.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"
              }`}
            >
              {initial.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-600">
            <dt>Tamanho</dt>
            <dd className="text-ink">{formatBytes(initial.sizeBytes)}</dd>
            <dt>Escala</dt>
            <dd className="font-mono">{initial.scale.toFixed(2)}</dd>
            <dt>Rotações (X/Y/Z)</dt>
            <dd className="font-mono">
              {initial.rotX}° / {initial.rotY}° / {initial.rotZ}°
            </dd>
            <dt>Inclinação</dt>
            <dd className="font-mono">{initial.tilt}°</dd>
            <dt>Frente invertida</dt>
            <dd>{initial.turn ? "sim" : "não"}</dd>
          </dl>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-4 text-center text-xs text-stone-500">
          Nenhum modelo 3D cadastrado para este produto.
        </p>
      )}

      {/* Upload / troca do arquivo */}
      <div className="mt-4">
        <label className="block cursor-pointer">
          <input
            type="file"
            accept=".glb"
            className="hidden"
            disabled={busy !== "none"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // permite reenviar o mesmo arquivo
              if (file) void upload(file);
            }}
          />
          <span
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition hover:border-accent-600 hover:text-accent-700 ${
              busy === "uploading" ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {busy === "uploading" ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Box size={16} aria-hidden />
            )}
            {initial ? "Trocar arquivo .glb" : "Enviar arquivo .glb"}
          </span>
        </label>
        <p className="mt-1 text-[11px] text-stone-400">
          Até 30 MB · glTF binário (.glb) · validamos o formato no servidor
        </p>
      </div>

      {/* Calibrar + remover */}
      {initial && initial.active && (
        <div className="mt-3 flex flex-col gap-2">
          <Link
            href={`/provador/estudio?produto=${slug}&calib=1`}
            target="_blank"
            className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            <ExternalLink size={15} aria-hidden />
            Calibrar no estúdio
          </Link>
          {confirmingRemove ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deactivate}
                disabled={busy === "deactivating"}
                className="flex-1 cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {busy === "deactivating" ? "Removendo…" : "Confirmar remoção"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="cursor-pointer rounded-xl border border-stone-300 px-3 py-2 text-sm"
              >
                <RotateCcw size={15} aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="cursor-pointer rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50"
            >
              Remover modelo
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 flex items-start gap-1.5 text-xs ${
            feedback.ok ? "text-emerald-700" : "text-red-700"
          }`}
          role="status"
        >
          {feedback.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden />
          ) : null}
          {feedback.text}
        </p>
      )}
    </section>
  );
}

/** Dica rescrita ao lado do formulário: como cola o modelo no produto. */
export function Model3dHint() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
      <h3 className="font-serif text-base text-ink">Como funciona o provador 3D</h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs">
        <li>Envie o arquivo .glb da armação (cor/modelagem equivalente).</li>
        <li>Abra o "Calibrar no estúdio" e ative a câmera.</li>
        <li>
          Ajuste escala, posição e inclinação até o encaixe ficar realista — o
          botão "Salvar calibração no produto" grava para todos os clientes.
        </li>
        <li>
          O cliente vê na hora: a página do produto abre o provador com a
          calibração salva.
        </li>
      </ol>
    </section>
  );
}
