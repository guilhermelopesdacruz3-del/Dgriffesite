"use client";

/**
 * Formulário de credenciais (gateway de pagamento + frete) do /admin/ajustes.
 * Campos de senha: vazios = mantém o valor atual; nunca exibimos o segredo.
 */
import { useState, useTransition } from "react";
import { saveCredenciais, limparCredencial, testarMelhorEnvio } from "@/actions/admin/credenciais";
import { formatBRL } from "@/lib/utils";

export interface CredState {
  mp: { source: string; masked: string | null };
  mpHook: { source: string; masked: string | null };
  me: { source: string; masked: string | null };
  meCep: string;
  meSandbox: boolean;
  mpAtivo: boolean;
}

const rotuloFonte: Record<string, string> = {
  site: "salvo no site",
  env: "reserva da Vercel",
  "nao-configurado": "não configurado",
};

function Fonte({ source }: { source: string }) {
  const cor =
    source === "site"
      ? "text-emerald-700"
      : source === "env"
        ? "text-stone-500"
        : "text-amber-700";
  return <span className={`text-xs ${cor}`}>· {rotuloFonte[source] ?? source}</span>;
}

export function CredenciaisForm({ state }: { state: CredState }) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [mp, setMp] = useState("");
  const [mpHook, setMpHook] = useState("");
  const [me, setMe] = useState("");
  const [cep, setCep] = useState(state.meCep);
  const [sandbox, setSandbox] = useState(state.meSandbox);
  const [teste, setTeste] = useState<
    | { tipo: "ok"; linhas: string[] }
    | { tipo: "erro"; texto: string }
    | { tipo: "carregando" }
    | null
  >(null);

  const salvar = () =>
    startTransition(async () => {
      const res = await saveCredenciais({
        mpAccessToken: mp,
        mpWebhookSecret: mpHook,
        meToken: me,
        shipFromCep: cep,
        meSandbox: sandbox,
      });
      if (res.ok) {
        setMensagem({ tipo: "ok", texto: "Configuração salva — já está valendo." });
        setMp(""); setMpHook(""); setMe("");
        // Recarrega para refletir os novos valores mascarados
        setTimeout(() => window.location.reload(), 900);
      } else {
        setMensagem({ tipo: "erro", texto: res.error });
      }
    });

  const limpar = (campo: string) =>
    startTransition(async () => {
      const res = await limparCredencial(campo);
      if (res.ok) setTimeout(() => window.location.reload(), 500);
      else setMensagem({ tipo: "erro", texto: res.error });
    });

  const testar = async () => {
    setTeste({ tipo: "carregando" });
    const res = await testarMelhorEnvio();
    if (res.ok) {
      setTeste({
        tipo: "ok",
        linhas: res.opcoes.map(
          (o) =>
            `${o.carrier} · ${o.service} — ${formatBRL(o.price)}${o.deadline ? ` · prazo ${o.deadline} dias úteis` : ""}`,
        ),
      });
    } else {
      setTeste({ tipo: "erro", texto: res.error });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ---------- Mercado Pago ---------- */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-base">Pagamento — Mercado Pago</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              state.mpAtivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {state.mpAtivo ? "Pix/cartão ativos" : "modo demonstração"}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Cole o token de produção em <a className="underline underline-offset-2" href="https://www.mercadopago.com.br/panel/credentials" target="_blank" rel="noreferrer">Mercado Pago → Suas integrações → Credenciais</a> (Access Token de produção).
        </p>

        <label className="mt-3 block text-sm font-medium" htmlFor="mp-token">
          Access Token <Fonte source={state.mp.source} />
        </label>
        <input
          id="mp-token"
          type="password"
          autoComplete="new-password"
          value={mp}
          onChange={(e) => setMp(e.target.value)}
          placeholder={state.mp.masked ?? "APP-USR-…"}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-stone-400">
          {state.mp.masked ? `atual: ${state.mp.masked}` : "nenhum token salvo"}
        </p>

        <label className="mt-3 block text-sm font-medium" htmlFor="mp-hook">
          Webhook Secret (opcional, mais segurança) <Fonte source={state.mpHook.source} />
        </label>
        <input
          id="mp-hook"
          type="password"
          autoComplete="new-password"
          value={mpHook}
          onChange={(e) => setMpHook(e.target.value)}
          placeholder={state.mpHook.masked ?? "opcional"}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      {/* ---------- Melhor Envio ---------- */}
      <div>
        <h3 className="font-serif text-base">Envio — Melhor Envio</h3>
        <p className="mt-1 text-sm text-stone-600">
          Token do painel em <a className="underline underline-offset-2" href="https://www.melhorenvio.com.br/panel/integrations" target="_blank" rel="noreferrer">Melhor Envio → Configurações → Integrações → Aplicações</a>.
        </p>

        <label className="mt-3 block text-sm font-medium" htmlFor="me-token">
          Token <Fonte source={state.me.source} />
        </label>
        <input
          id="me-token"
          type="password"
          autoComplete="new-password"
          value={me}
          onChange={(e) => setMe(e.target.value)}
          placeholder={state.me.masked ?? "Bearer eyJ…"}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-stone-400">
          {state.me.masked ? `atual: ${state.me.masked}` : "nenhum token salvo — o site usa a estimativa de frete local"}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="me-cep">
              CEP de origem
            </label>
            <input
              id="me-cep"
              inputMode="numeric"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-stone-400">95555000 = Capão da Canoa/RS</p>
          </div>
          <label className="mt-6 flex items-start gap-2 text-sm sm:mt-0">
            <input
              type="checkbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Sandbox (ambiente de teste)
              <span className="block text-xs text-stone-400">só para cotações de teste — desligue para vender</span>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={testar}
          className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
        >
          {teste?.tipo === "carregando" ? "Testando…" : "Testar cotação (Capão da Canoa → POA)"}
        </button>
        {teste?.tipo === "ok" && (
          <ul className="mt-2 space-y-1 text-sm text-emerald-800">
            {teste.linhas.map((l, i) => (
              <li key={i}>✓ {l}</li>
            ))}
          </ul>
        )}
        {teste?.tipo === "erro" && <p className="mt-2 text-sm text-red-700">{teste.texto}</p>}
      </div>

      {/* ---------- Ações ---------- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar configuração"}
        </button>
        <button
          type="button"
          onClick={() => limpar("mpAccessToken")}
          disabled={pending || !state.mp.masked}
          className="text-xs text-stone-500 underline underline-offset-2 disabled:opacity-30"
        >
          limpar token do MP
        </button>
        <button
          type="button"
          onClick={() => limpar("meToken")}
          disabled={pending || !state.me.masked}
          className="text-xs text-stone-500 underline underline-offset-2 disabled:opacity-30"
        >
          limpar token do ME
        </button>
      </div>
      {mensagem && (
        <p className={`text-sm ${mensagem.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
