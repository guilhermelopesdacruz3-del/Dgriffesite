"use client";

/**
 * Fase 9 — consentimento de cookies (LGPD art. 8º): nada de rastreio antes da
 * escolha do usuário. Gravamos `pierre.consent.v1` no localStorage:
 *   { essencial: sempre true, analise: bool, marketing: bool, ts }
 * Nenhum script de terceiro existe hoje na loja — o banner prepara o terreno
 * e documenta o comportamento: quem integrar analytics precisa checar
 * `hasConsent()` antes de carregar (assinatura no Esperar consent=true).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

export interface ConsentChoice {
  essencial: true;
  analise: boolean;
  marketing: boolean;
  ts: number;
}

const STORAGE_KEY = "pierre.consent.v1";
/** Evento interno disparado quando o consentimento muda (analytics oucem). */
export const CONSENT_EVENT = "pierre:consent";

/** Lê o consentimento atual (para scripts que dependem dele). */
export function hasConsent(kind: "analise" | "marketing"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as ConsentChoice)[kind]);
  } catch {
    return false;
  }
}

/** Banner principal: aparece só quando NÃO existe escolha salva. */
export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  const [analise, setAnalise] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage bloqueado: mostra o banner a cada visita (documento na página de privacidade) */
    }
    if (!saved) setVisivel(true);

    const abrirDeNovo = () => {
      setPersonalizando(true);
      setVisivel(true);
    };
    window.addEventListener(CONSENT_EVENT, abrirDeNovo);
    return () => window.removeEventListener(CONSENT_EVENT, abrirDeNovo);
  }, []);

  function salvar(consent: ConsentChoice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch {
      /* sem storage: segue a navegação igualmente */
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-5 shadow-xl md:inset-x-6"
    >
      <p className="flex items-start gap-2 text-sm text-stone-700">
        <Cookie size={18} className="mt-0.5 shrink-0 text-accent-700" aria-hidden />
        <span>
          Usamos cookies essenciais para o site funcionar (sessão de login,
          carrinho). Os opcionais (<strong>análise</strong> e{" "}
          <strong>marketing</strong>) só entram se você permitir — e você pode
          mudar de ideia a qualquer momento no rodapé.{" "}
          <Link
            href="/paginas/politica-de-privacidade"
            className="underline underline-offset-4 hover:text-accent-700"
          >
            Política de privacidade (LGPD)
          </Link>
          .
        </span>
      </p>

      {personalizando && (
        <div className="mt-3 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
          <label className="flex items-center justify-between">
            <span>
              Essenciais <span className="text-xs text-stone-400">(sempre ativos)</span>
            </span>
            <input type="checkbox" checked disabled className="accent-accent-600" />
          </label>
          <label className="flex cursor-pointer items-center justify-between">
            <span>
              Análise <span className="text-xs text-stone-400">(métricas anônimas de uso)</span>
            </span>
            <input
              type="checkbox"
              checked={analise}
              onChange={(e) => setAnalise(e.target.checked)}
              className="accent-accent-600"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between">
            <span>
              Marketing <span className="text-xs text-stone-400">(remarketing e mídia paga)</span>
            </span>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="accent-accent-600"
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!personalizando && (
          <button
            type="button"
            onClick={() => setPersonalizando(true)}
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Personalizar
          </button>
        )}
        {personalizando ? (
          <>
            <button
              type="button"
              onClick={() => salvar({ essencial: true, analise, marketing, ts: Date.now() })}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Salvar escolhas
            </button>
            <button
              type="button"
              onClick={() => salvar({ essencial: true, analise: true, marketing: true, ts: Date.now() })}
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
            >
              Aceitar tudo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => salvar({ essencial: true, analise: false, marketing: false, ts: Date.now() })}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Só o essencial
            </button>
            <button
              type="button"
              onClick={() => salvar({ essencial: true, analise: true, marketing: true, ts: Date.now() })}
              className="cursor-pointer rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
            >
              Aceitar tudo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Rodapé: reaparece o banner para mudar a escolha (direito de revogar).
 */
export function ReabrirConsentimento() {
  return (
    <button
      type="button"
      className="cursor-pointer text-left text-stone-400 underline-offset-4 transition-colors hover:text-stone-600 hover:underline"
      onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}
    >
      Preferências de cookies
    </button>
  );
}
