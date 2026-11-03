"use client";

/**
 * Visão do carrinho completo (Fase 4): linhas do localStorage com controle
 * de quantidade, cupom e cotação de frete por CEP. A escolha de cupom e
 * frete é levada ao checkout via sessionStorage (o servidor revalida tudo
 * de novo na hora de criar o pedido).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Tag, Trash2, Truck } from "lucide-react";
import {
  CART_EVENT,
  cartSubtotal,
  linePrice,
  readCart,
  removeLine,
  setQuantity,
  type CartLine,
} from "@/lib/cart-store";
import { formatBRL } from "@/lib/utils";
import { storeConfig } from "@/lib/config";
import type { ShippingOption } from "@/lib/shipping";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/** Chaves de handoff carrinho → checkout (revalidados no servidor). */
const CUPOM_KEY = "pierre.cupom";
const FRETE_KEY = "pierre.frete.cep";
const FRETE_ID_KEY = "pierre.frete.id";

interface CouponState {
  code: string;
  discount: number;
  message: string;
  ok: boolean;
}

function useCartLines() {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    const load = () => setLines(readCart());
    load();
    window.addEventListener(CART_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CART_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return lines;
}

export function CartView() {
  const lines = useCartLines();

  // Undo/redo do cupom: começa carregando um eventual cupom salvo
  const [coupon, setCoupon] = useState<CouponState | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  // Frete
  const [cep, setCep] = useState("");
  const [freteOptions, setFreteOptions] = useState<ShippingOption[]>([]);
  const [freteId, setFreteId] = useState<string | null>(null);
  const [freteMessage, setFreteMessage] = useState<string | null>(null);
  const [freteBusy, setFreteBusy] = useState(false);
  const [hasFreteSaved, setHasFreteSaved] = useState(false);

  const subtotal = useMemo(() => cartSubtotal(lines), [lines]);

  // Carrega cupom/frete salvos (se o veio ordenando do fluxo anterior voltou)
  useEffect(() => {
    const savedCoupon = sessionStorage.getItem(CUPOM_KEY);
    const savedCep = sessionStorage.getItem(FRETE_KEY);
    if (savedCep) {
      setCep(savedCep);
      setHasFreteSaved(true);
    }
    if (savedCoupon) setCouponInput(savedCoupon);
  }, []);

  const shipping = useMemo(
    () => freteOptions.find((o) => o.id === freteId) ?? null,
    [freteOptions, freteId],
  );

  const discount = coupon?.ok ? coupon.discount : 0;
  const total = Math.max(0, subtotal + (shipping ? shipping.price : 0) - discount);

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code || lines.length === 0) return;
    setCouponBusy(true);
    try {
      const res = await fetch("/api/cupom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          items: lines.map((l) => ({
            productId: l.productId,
            price: l.price,
            quantity: l.quantity,
          })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; message: string; discount: number };
      setCoupon({
        code,
        ok: data.ok,
        message: data.message,
        discount: data.ok ? data.discount : 0,
      });
      sessionStorage.setItem(CUPOM_KEY, data.ok ? code : "");
      sessionStorage.setItem(`${CUPOM_KEY}.valor`, String(data.ok ? data.discount : ""));
    } catch {
      setCoupon({ code, ok: false, message: "Não foi possível aplicar o cupom agora.", discount: 0 });
    } finally {
      setCouponBusy(false);
    }
  }, [couponInput, lines]);

  const quoteFrete = useCallback(
    async (cepValue: string) => {
      const digits = cepValue.replace(/\D/g, "");
      if (digits.length !== 8) {
        setFreteMessage("Digite os 8 dígitos do seu CEP.");
        setFreteOptions([]);
        return;
      }
      setFreteBusy(true);
      try {
        const res = await fetch("/api/frete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cep: digits, subtotal }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          message?: string;
          options?: ShippingOption[];
        };
        if (!data.ok) {
          setFreteMessage(data.message ?? "Frete indisponível.");
          setFreteOptions([]);
          return;
        }
        setFreteOptions(data.options ?? []);
        setFreteMessage(null);
        if (!freteId && data.options?.length) {
          setFreteId(data.options[0].id); // PAC é a primeira opção
        }
        sessionStorage.setItem(FRETE_KEY, digits);
      } catch {
        setFreteMessage("Não foi possível calcular o frete agora.");
      } finally {
        setFreteBusy(false);
      }
    },
    // (subtotal muda o valor com frete grátis — requote quando muda)
    [subtotal, freteId],
  );

  // Requote o frete se já estiver salvo (cupom/frete grátis acima do valor)
  useEffect(() => {
    if (hasFreteSaved && cep.replace(/\D/g, "").length === 8) {
      void quoteFrete(cep);
      setHasFreteSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFreteSaved]);

  const saveFrete = useCallback(() => {
    if (freteId && cep) {
      sessionStorage.setItem(FRETE_ID_KEY, freteId);
    }
  }, [freteId, cep]);

  // Persistência de cupom+frete antes de sair para o checkout
  useEffect(() => {
    saveFrete();
  }, [saveFrete]);

  // ---------------- Estados ----------------
  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="font-serif text-xl">Seu carrinho está vazio</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Explore as armações mais vendidas da loja e volte para concluir o pedido.
        </p>
        <Button href="/produtos" variant="accent" className="mt-6">
          Ver produtos
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* ---------- Linhas ---------- */}
      <section aria-label="Itens do carrinho" className="space-y-4">
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {lines.map((line) => (
            <li
              key={`${line.productId}-${line.variantId}-${line.lensPackageId ?? "s"}`}
              className="flex gap-4 p-4"
            >
              {line.image ? (
                // Imagem servida pelo CM/host do integrador (ex.: picsum, S3)
                // Usa <img> manual por serem URLs externas, com fallback no CSS.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.image}
                  alt={line.name}
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-stone-100 font-serif text-2xl text-stone-400">
                  {line.name.slice(0, 1)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-stone-400">{line.brand}</p>
                <Link
                  href={`/produtos/${line.slug}`}
                  className="font-medium text-ink hover:text-accent-700"
                >
                  {line.name}
                </Link>
                {line.colorName && <p className="mt-0.5 text-sm text-stone-500">Cor: {line.colorName}</p>}
                {line.lensPackageId && line.lensPackageName && (
                  <p className="mt-1 text-xs text-accent-700">
                    Com lentes: {line.lensPackageName}
                    {line.lensPackagePrice
                      ? ` (+ ${formatBRL(line.lensPackagePrice)}/un).`
                      : "."}{" "}
                    A receita é anexada no checkout.
                  </p>
                )}

                <div className="mt-2 flex items-center gap-4">
                  {/* stepper */}
                  <div className="inline-flex items-center rounded-full border border-stone-300">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-100"
                      onClick={() =>
                        setQuantity(
                          line.productId,
                          line.variantId,
                          line.quantity - 1,
                          line.lensPackageId ?? null,
                        )
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-100"
                      onClick={() =>
                        setQuantity(
                          line.productId,
                          line.variantId,
                          line.quantity + 1,
                          line.lensPackageId ?? null,
                        )
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-red-600"
                    onClick={() =>
                      removeLine(line.productId, line.variantId, line.lensPackageId ?? null)
                    }
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold text-ink">{formatBRL(linePrice(line))}</p>
                {line.quantity > 1 && (
                  <p className="text-xs text-stone-400">{formatBRL(line.price + (line.lensPackagePrice ?? 0))} cada</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Resumo ---------- */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
          {/* Cupom */}
          <div>
            <Label className="mb-1 inline-flex items-center gap-1.5 text-sm">
              <Tag size={14} className="text-accent-700" /> Cupom de desconto
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex.: PRIMEIRA15"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="uppercase"
                aria-label="Código do cupom"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void applyCoupon()}
                disabled={couponBusy || !couponInput.trim()}
                className="shrink-0"
              >
                {couponBusy ? "…" : "Aplicar"}
              </Button>
            </div>
            {coupon && (
              <p
                className={
                  coupon.ok
                    ? "mt-2 text-xs font-medium text-emerald-700"
                    : "mt-2 text-xs font-medium text-red-600"
                }
              >
                {coupon.message}
              </p>
            )}
          </div>

          {/* Frete */}
          <div>
            <Label className="mb-1 inline-flex items-center gap-1.5 text-sm">
              <Truck size={14} className="text-accent-700" /> Frete
            </Label>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                  const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                  setCep(masked);
                }}
                aria-label="CEP para cálculo do frete"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void quoteFrete(cep)}
                disabled={freteBusy}
                className="shrink-0"
              >
                {freteBusy ? "…" : "Calcular"}
              </Button>
            </div>
            {freteMessage && <p className="mt-2 text-xs text-stone-500">{freteMessage}</p>}
            {freteOptions.length > 0 && (
              <div className="mt-3 space-y-2">
                {freteOptions.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="frete"
                        checked={freteId === o.id}
                        onChange={() => setFreteId(o.id)}
                        className="accent-accent-600"
                      />
                      <span className="font-medium">{o.service}</span>
                      <span className="text-xs text-stone-400">
                        {o.deadline ? `${o.deadline} dias úteis` : "coleta na loja"}
                      </span>
                    </span>
                    <span className="font-semibold text-ink">
                      {o.price === 0 ? "Grátis" : formatBRL(o.price)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <hr className="border-stone-200" />

          {/* Totais */}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd className="font-medium">{formatBRL(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Desconto ({coupon?.code})</dt>
                <dd className="font-medium">−{formatBRL(discount)}</dd>
              </div>
            )}
            {shipping && (
              <div className="flex justify-between">
                <dt className="text-stone-500">
                  Frete ({shipping.service}){shipping.deadline ? ` · ${shipping.deadline} dias úteis` : ""}
                </dt>
                <dd className="font-medium">
                  {shipping.price === 0 ? "Grátis" : formatBRL(shipping.price)}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-3">
              <dt className="font-serif text-lg">Total</dt>
              <dd className="font-serif text-2xl font-semibold">{formatBRL(total)}</dd>
            </div>
            {subtotal > 0 && (
              (() => {
                const maxParc = Math.floor(
                  Math.min(
                    storeConfig.commerce.maxInstallments,
                    subtotal / storeConfig.commerce.minParcelValue,
                  ),
                );
                if (maxParc < 2) return null;
                return (
                  <p className="text-xs text-stone-400">
                    em até {maxParc}x sem juros no cartão
                  </p>
                );
              })()
            )}
          </dl>

          <Button href="/checkout" variant="accent" size="lg" className="w-full">
            Fechar pedido
          </Button>
          <p className="text-center text-xs text-stone-400">
            Pagamento seguro via Mercado Pago (Pix, cartão ou boleto)
          </p>
        </div>
      </aside>
    </div>
  );
}
