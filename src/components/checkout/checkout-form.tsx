"use client";

/**
 * Formulário do checkout (Fase 4 + 7b), em uma página só:
 *   1. identificação (nome/e-mail/telefone)
 *   2. receita de óculos (quando a compra tem lentes de grau)
 *   3. entrega (endereço por CEP)
 *   4. frete (opções recalculadas a partir do subtotal)
 *   5. pagamento (Pix / cartão / boleto via Mercado Pago)
 *
 * Os preços e o cupom vindos do carrinho são reenviados ao servidor, que
 * revalida tudo antes de criar o pedido (src/lib/checkout.ts). Cupom e CEP
 * são reutilizados do carrinho via sessionStorage, e ao concluir com
 * sucesso o carrinho é esvaziado.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  Lock,
  QrCode,
  Truck,
} from "lucide-react";
import type { ShippingOption } from "@/lib/shipping";
import { formatBRL } from "@/lib/utils";
import { linePrice, type CartLine } from "@/lib/cart-store";
import { readCart, cartSubtotal, clearCart, CART_EVENT } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";

const CUPOM_KEY = "pierre.cupom";
const FRETE_KEY = "pierre.frete.cep";

interface Prefill {
  nome: string;
  email: string;
  loggedIn: boolean;
}

const PAGAMENTO = [
  {
    id: "PIX" as const,
    label: "Pix",
    hint: "Aprovação na hora — a opção mais rápida.",
    icon: QrCode,
  },
  {
    id: "CARD" as const,
    label: "Cartão de crédito",
    hint: "Até 6x sem juros na página do Mercado Pago.",
    icon: CreditCard,
  },
  {
    id: "BOLETO" as const,
    label: "Boleto bancário",
    hint: "Cai em 1 a 2 dias úteis após o pagamento.",
    icon: Landmark,
  },
];

export function CheckoutForm({ prefill }: { prefill: Prefill }) {
  const router = useRouter();

  // ---------- carrinho + handoff do cupom ----------
  const [lines, setLines] = useState<CartLine[] | null>(null); // null = ainda carregando
  useEffect(() => {
    const load = () => setLines(readCart());
    load();
    window.addEventListener(CART_EVENT, load);
    return () => window.removeEventListener(CART_EVENT, load);
  }, []);

  const subtotal = useMemo(() => (lines ? cartSubtotal(lines) : 0), [lines]);

  /* ------- Receita de óculos (Fase 7b) ------- */
  const temLentes = Boolean(lines?.some((l) => l.lensPackageId));
  interface ReceitaRow {
    id: string;
    fileName: string;
    status: "PENDING" | "VALIDATED" | "REJECTED";
    createdAt: string;
  }
  const [receitas, setReceitas] = useState<ReceitaRow[] | null>(null);
  const [receitaId, setReceitaId] = useState<string | null>(null);
  const [rxErro, setRxErro] = useState<string | null>(null);
  const [rxEnviando, setRxEnviando] = useState(false);

  useEffect(() => {
    if (lines === null) return;
    // Só busca receitas quando a compra tem lentes (o servidor exige receita).
    if (lines.some((l) => l.lensPackageId)) {
      let alive = true;
      fetch("/api/minhas-receitas", { cache: "no-store" })
        .then(async (res) => {
          if (!alive) return;
          if (!res.ok) {
            setReceitas([]); // não logado: servidor vai exigir login
            return;
          }
          const data = (await res.json()) as { receitas: ReceitaRow[] };
          setReceitas(data.receitas);
          // Pré-seleciona uma receita válida (a mais recente OK) — dispense cliques
          const validada = data.receitas.find((r) => r.status === "VALIDATED");
          if (validada) setReceitaId(validada.id);
        })
        .catch(() => alive && setReceitas([]));
      return () => {
        alive = false;
      };
    }
    setReceitas(null);
    setReceitaId(null);
  }, [lines]);

  /** Upload inline de receita dentro do checkout (evita ida à conta). */
  async function enviarReceita(file: File) {
    setRxErro(null);
    setRxEnviando(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/minhas-receitas/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; message?: string; receita?: ReceitaRow };
      if (res.ok && data.ok && data.receita) {
        setReceitas((r) => [data.receita!, ...(r ?? [])]);
        setReceitaId(data.receita.id);
      } else {
        setRxErro(data.message ?? "Falha no envio da receita.");
      }
    } catch {
      setRxErro("Rede interrompida — tente novamente.");
    } finally {
      setRxEnviando(false);
    }
  }

  // ---------- estado de frete ----------
  const [freteOptions, setFreteOptions] = useState<ShippingOption[]>([]);
  const [freteId, setFreteId] = useState<string | null>(null);
  const [cep, setCep] = useState("");

  // ---------- estado do formulário ----------
  const [form, setForm] = useState({
    nome: prefill.nome,
    email: prefill.email,
    telefone: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    observacoes: "",
  });
  const [metodo, setMetodo] = useState<"PIX" | "CARD" | "BOLETO">("PIX");
  const [cupom] = useState(() => sessionStorageSafe(() => sessionStorage.getItem(CUPOM_KEY)));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega o CEP salvo no carrinho e cota as opções de frete
  useEffect(() => {
    const savedCep = sessionStorageSafe(() => sessionStorage.getItem(FRETE_KEY)) ?? "";
    const digits = savedCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCep(
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits,
    );
  }, []);

  // Cota o frete quando temos CEP completo e subtotal(prices do carrinho)
  useEffect(() => {
    if (!lines || cep.replace(/\D/g, "").length !== 8) return;
    let alive = true;
    (async () => {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cep: cep.replace(/\D/g, ""), subtotal }),
      });
      const data = (await res.json()) as { ok: boolean; options?: ShippingOption[] };
      if (!alive) return;
      if (data.ok && data.options) {
        setFreteOptions(data.options);
        setFreteId(data.options[0]?.id ?? null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cep, subtotal, lines]);

  // Busca endereço pelo CEP (ViaCEP é um serviço público sem chave)
  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = (await res.json()) as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };
        if (!alive || data.erro) return;
        setForm((f) => ({
          ...f,
          rua: data.logradouro ?? f.rua,
          bairro: data.bairro ?? f.bairro,
          cidade: data.localidade ?? f.cidade,
          uf: data.uf ?? f.uf,
        }));
      } catch {
        // ViaCEP fora do ar: cliente preenche manualmente
      }
    })();
    return () => {
      alive = false;
    };
  }, [cep]);

  const shipping = useMemo(
    () => freteOptions.find((o) => o.id === freteId) ?? null,
    [freteOptions, freteId],
  );
  const discount = 0; // o cupom só é revalidado de fato no servidor
  const total = useMemo(() => {
    if (!lines) return 0;
    const shippingPrice = shipping ? shipping.price : 0;
    return Math.max(0, subtotal + shippingPrice - discount);
  }, [lines, shipping, subtotal]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines || lines.length === 0 || !freteId) return;
    // Receita obrigatória SERVER-SIDE também — aqui só melhora o erro cedo.
    if (temLentes && !receitaId) {
      setError("Anexe ou selecione uma receita para os itens com lentes.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            lensPackageId: l.lensPackageId ?? null,
          })),
          prescriptionId: temLentes ? receitaId : null,
          cupom: cupom && cupom.length > 0 ? cupom : null,
          freteId,
          contato: {
            nome: form.nome,
            email: form.email,
            telefone: form.telefone,
          },
          entrega: {
            cep: cep.replace(/\D/g, ""),
            rua: form.rua,
            numero: form.numero,
            complemento: form.complemento || null,
            bairro: form.bairro,
            cidade: form.cidade,
            uf: form.uf,
            observacoes: form.observacoes || null,
          },
          metodo,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; redirectUrl: string; demo: boolean; code: string }
        | { ok: false; message: string };

      if (!data.ok) {
        setError(data.message);
        setSubmitting(false);
        return;
      }

      // Pedido criado: esvazia o carrinho e segue para o pagamento
      clearCart();
      window.setTimeout(() => {
        if (/^https?:\/\//.test(data.redirectUrl)) {
          window.location.href = data.redirectUrl; // página do Mercado Pago
        } else {
          router.push(data.redirectUrl);
        }
      }, 150);
    } catch {
      setError("Falha de comunicação com o servidor. Tente novamente.");
      setSubmitting(false);
    }
  }

  // ---------------- estados ----------------
  if (lines === null) {
    return (
      <div className="mt-10 grid place-items-center rounded-2xl border border-stone-200 bg-white p-12 text-stone-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="font-serif text-xl">Seu carrinho está vazio</p>
        <p className="mt-2 text-sm text-stone-500">
          Adicione produtos antes de finalizar o pedido.
        </p>
        <Button href="/produtos" variant="accent" className="mt-6">
          Ver produtos
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {/* ---------- 1. Identificação ---------- */}
        <section aria-labelledby="id-titulo" className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 id="id-titulo" className="font-serif text-xl">
            <span className="mr-2 text-accent-600">1.</span> Identificação
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                required
                minLength={3}
                value={form.nome}
                onChange={(e) => update("nome", e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
              />
              {prefill.loggedIn && (
                <p className="mt-1 text-xs text-stone-400">
                  Da sua conta ({prefill.email})
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="tel">Telefone (DDD) *</Label>
              <Input
                id="tel"
                required
                inputMode="tel"
                placeholder="(11) 90000-0000"
                value={form.telefone}
                onChange={(e) => update("telefone", e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>
        </section>

        {/* ---------- 2. Receita (compra com lentes de grau) ---------- */}
        {temLentes && (
          <section aria-labelledby="rec-titulo" className="rounded-2xl border border-accent-600/40 bg-accent-50/40 p-6">
            <h2 id="rec-titulo" className="font-serif text-xl">
              <span className="mr-2 text-accent-600">2.</span> Receita de óculos
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Lentes de grau são montadas por cima de um receituário validado pelo
              óptico. Anexe uma receita sua — o arquivo fica privado e só a ótica
              (e você) consegue visualizar.
            </p>

            {receitas === null ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                <Loader2 size={15} className="animate-spin" /> Carregando suas receitas…
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  {receitas.map((r) => (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm transition-colors has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
                    >
                      <input
                        type="radio"
                        name="receita"
                        checked={receitaId === r.id}
                        onChange={() => setReceitaId(r.id)}
                        className="accent-accent-600"
                      />
                      <FileText size={15} className="shrink-0 text-stone-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{r.fileName}</span>
                      {r.status === "PENDING" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          Em análise
                        </span>
                      )}
                      {r.status === "VALIDATED" && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Validada
                        </span>
                      )}
                      {r.status === "REJECTED" && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                          Recusada
                        </span>
                      )}
                    </label>
                  ))}
                  {receitas.length === 0 && (
                    <p className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-center text-sm text-stone-500">
                      Você ainda não tem receitas salvas.
                    </p>
                  )}
                </div>

                <p className="mt-4 text-xs text-stone-600">ou anexe agora:</p>
                <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={rxEnviando}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void enviarReceita(file);
                    }}
                  />
                  {rxEnviando ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Enviando…
                    </>
                  ) : (
                    "Enviar foto/PDF da receita"
                  )}
                </label>
                {rxErro && <p className="mt-2 text-xs text-red-700">{rxErro}</p>}
                {!prefill.loggedIn && (
                  <p className="mt-3 text-xs text-amber-800">
                    Qualquer pessoa pode anexar — mas para a ótica acompanhar depois,
                    vale a pena{" "}
                    <Link href="/entrar" className="underline">
                      entrar na conta
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {/* ---------- 3. Entrega ---------- */}
        <section aria-labelledby="entrega-titulo" className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 id="entrega-titulo" className="font-serif text-xl">
            <span className="mr-2 text-accent-600">3.</span> Entrega
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label htmlFor="cep">CEP *</Label>
              <Input
                id="cep"
                required
                inputMode="numeric"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                  const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                  setCep(masked);
                }}
              />
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="rua">Rua / Logradouro *</Label>
              <Input
                id="rua"
                required
                value={form.rua}
                onChange={(e) => update("rua", e.target.value)}
                autoComplete="address-line1"
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="numero">Número *</Label>
              <Input
                id="numero"
                required
                value={form.numero}
                onChange={(e) => update("numero", e.target.value)}
                autoComplete="address-line2"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={form.complemento}
                onChange={(e) => update("complemento", e.target.value)}
                placeholder="Apto, andar…"
              />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="bairro">Bairro *</Label>
              <Input
                id="bairro"
                required
                value={form.bairro}
                onChange={(e) => update("bairro", e.target.value)}
                autoComplete="address-level3"
              />
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                required
                value={form.cidade}
                onChange={(e) => update("cidade", e.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="uf">UF *</Label>
              <Select
                id="uf"
                required
                value={form.uf}
                onChange={(e) => update("uf", e.target.value.toUpperCase())}
                autoComplete="address-level1"
              >
                <option value="">—</option>
                {[
                  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
                  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
                ].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-6">
              <Label htmlFor="obs">Observações do pedido</Label>
              <Textarea
                id="obs"
                placeholder="Referência (ex.: portão azul), preferências de atendimento…"
                value={form.observacoes}
                onChange={(e) => update("observacoes", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------- 4. Frete ---------- */}
        <section aria-labelledby="frete-titulo" className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 id="frete-titulo" className="font-serif text-xl">
            <span className="mr-2 text-accent-600">4.</span> Frete
          </h2>
          {cep.replace(/\D/g, "").length !== 8 ? (
            <p className="mt-3 text-sm text-stone-500">
              Informe o CEP acima para ver as opções de frete.
            </p>
          ) : freteOptions.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-stone-500">
              <Truck size={16} className="animate-pulse" /> Calculando frete…
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {freteOptions.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="frete"
                      checked={freteId === o.id}
                      onChange={() => setFreteId(o.id)}
                      className="accent-accent-600"
                    />
                    <span>
                      <span className="font-medium">{o.service}</span>{" "}
                      <span className="text-xs text-stone-400">
                        {o.deadline ? `${o.deadline} dias úteis` : "coleta na loja"}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold text-ink">
                    {o.price === 0 ? "Grátis" : formatBRL(o.price)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* ---------- 5. Pagamento ---------- */}
        <section aria-labelledby="pag-titulo" className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 id="pag-titulo" className="font-serif text-xl">
            <span className="mr-2 text-accent-600">5.</span> Pagamento
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PAGAMENTO.map((p) => (
              <label
                key={p.id}
                className="cursor-pointer rounded-xl border border-stone-200 p-4 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
              >
                <span className="flex items-center justify-between">
                  <input
                    type="radio"
                    name="metodo"
                    checked={metodo === p.id}
                    onChange={() => setMetodo(p.id)}
                    className="accent-accent-600"
                  />
                  <p.icon size={18} className="text-stone-400" />
                </span>
                <span className="mt-3 block font-medium">{p.label}</span>
                <span className="mt-0.5 block text-xs text-stone-400">{p.hint}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-400">
            <Lock size={13} /> Você termina o pagamento na página segura do
            Mercado Pago. Não guardamos dados de cartão.
          </p>
        </section>
      </div>

      {/* ---------- Resumo lateral ---------- */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-lg">Resumo</h2>
          <ul className="space-y-3 text-sm">
            {lines.map((l) => (
              <li key={`${l.productId}-${l.variantId}-${l.lensPackageId ?? "s"}`} className="flex justify-between gap-2">
                <span className="text-stone-600">
                  {l.quantity}× {l.name}
                  {l.colorName && <span className="text-stone-400"> ({l.colorName})</span>}
                  {l.lensPackageName && (
                    <span className="block text-xs text-accent-700">com lentes: {l.lensPackageName}</span>
                  )}
                </span>
                <span className="font-medium">{formatBRL(linePrice(l))}</span>
              </li>
            ))}
          </ul>
          <hr className="border-stone-200" />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            {shipping && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Frete ({shipping.service})</dt>
                <dd>{shipping.price === 0 ? "Grátis" : formatBRL(shipping.price)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
              <dt className="font-serif text-base">Total</dt>
              <dd className="font-serif text-2xl font-semibold">{formatBRL(total)}</dd>
            </div>
          </dl>

          {error && <FieldError>{error}</FieldError>}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={submitting || !freteId || (temLentes && !receitaId)}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Criando pedido…
              </>
            ) : temLentes && !receitaId ? (
              <>
                <FileText size={18} /> Anexe a receita…
              </>
            ) : (
              <>
                <Check size={18} /> Concluir pedido
              </>
            )}
          </Button>
          <p className="text-center text-xs text-stone-400">
            Ao concluir, aceito os termos de{" "}
            <Link href="/paginas/termos-de-compra" className="underline">
              compra
            </Link>{" "}
            e{" "}
            <Link href="/paginas/privacidade" className="underline">
              privacidade
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

/**
 * sessionStorage protegido contra exceções (usado na inicialização do
 * client; o SSR nunca executa este componente).
 */
function sessionStorageSafe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
