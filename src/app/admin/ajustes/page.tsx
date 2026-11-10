import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { GOLD_MULTIPLIER, getGoldPricePerGram, GOLD_PRICE_SETTING_KEY } from "@/lib/jewelry";
import { GoldPriceForm } from "@/components/admin/gold-price-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ajustes — Painel admin", robots: { index: false } };

/** Fase 14 — ajustes da loja: cotação do ouro usada nas joias por grama. */
export default async function AdminSettingsPage() {
  const row = await db.setting.findUnique({
    where: { key: GOLD_PRICE_SETTING_KEY },
    select: { value: true, updatedAt: true },
  });
  const current = row?.value ?? "0";
  const display = Number(current) > 0 ? current : ""; // sem cotação salva ainda

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Ajustes</h1>
        <p className="mt-1 text-sm text-stone-500">
          Configurações de operação da D'Griffe.
        </p>
      </header>

      <section className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg">Cotação do ouro</h2>
          {row?.updatedAt && (
            <span className="text-xs text-stone-400">última atualização: {formatDate(row.updatedAt)}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-stone-600">
          Joias são vendidas por peso:{" "}
          <strong>preço = peso (g) × cotação × {GOLD_MULTIPLIER}</strong>. Salvar já recalcula o preço de todas as joias.
        </p>
        {display && <p className="mt-3 text-2xl font-semibold">{formatBRL(Number(display))} <span className="text-sm font-normal text-stone-500">por grama</span></p>}
        <GoldPriceForm current={display || "0"} />
      </section>
    </div>
  );
}
