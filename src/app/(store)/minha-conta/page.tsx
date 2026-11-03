import Link from "next/link";
import { signOut, auth } from "@/auth";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/utils";
import { ORDER_STATUS_INFO } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ReceiptText, Settings, LogOut, Camera, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Minha conta" };

/**
 * Fase 5/7b — visão geral da conta: resumo de pedidos + endereço padrão e
 * atalhos para as áreas completas (pedidos, receitas, endereços, dados,
 * favoritos).
 */
export default async function AccountOverviewPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    // Defesa em profundidade: middleware/layout já redirecionam
    return null;
  }

  const [recentOrders, defaultAddress, favoritesCount, receitasPending] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { code: true, status: true, total: true, createdAt: true },
    }),
    db.address.findFirst({
      where: { userId: user.id, isDefault: true },
      select: {
        street: true,
        number: true,
        complement: true,
        district: true,
        city: true,
        state: true,
        cep: true,
      },
    }),
    db.favorite.count({ where: { userId: user.id } }),
    db.prescription.count({ where: { userId: user.id, status: "PENDING" } }),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const areas = [
    {
      href: "/minha-conta/pedidos",
      icon: ReceiptText,
      title: "Meus pedidos",
      desc: recentOrders.length
        ? "Acompanhamento, rastreio e trocas"
        : "Aqui aparecem seus pedidos e o andamento",
    },
    {
      href: "/minha-conta/enderecos",
      icon: MapPin,
      title: "Endereços",
      desc: defaultAddress
        ? "Gerenciar endereços de entrega"
        : "Cadastre um endereço para agilizar o checkout",
    },
    {
      href: "/minha-conta/receitas",
      icon: Camera,
      title: "Minhas receitas",
      desc: receitasPending
        ? `${receitasPending} receita${receitasPending > 1 ? "s" : ""} em análise pela ótica`
        : "Envie sua receita para montar as lentes",
    },
    {
      href: "/minha-conta/dados",
      icon: Settings,
      title: "Dados e senha",
      desc: "Perfil, senha e preferências de comunicação",
    },
    {
      href: "/favoritos",
      icon: Heart,
      title: "Favoritos",
      desc: "Seus modelos salvos, sincronizados na conta",
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Resumo */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="Resumo da conta">
        <div className="rounded-2xl border border-stone-200 p-6">
          <h2 className="font-serif text-lg">Últimos pedidos</h2>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              Você ainda não fez pedidos.{" "}
              <Link href="/produtos" className="font-medium text-accent-700 hover:underline">
                Conheça o catálogo
              </Link>{" "}
              — com provador virtual nos modelos 3D.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {recentOrders.map((o) => {
                const info = ORDER_STATUS_INFO[o.status];
                return (
                  <li key={o.code} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link
                        href={`/pedido/${o.code}`}
                        className="font-mono text-sm font-medium hover:text-accent-700 hover:underline"
                      >
                        {o.code}
                      </Link>
                      <p className="mt-0.5 text-xs text-stone-500">{formatDate(o.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={info.badge}>{info.label}</Badge>
                      <span className="text-sm font-medium">{formatBRL(Number(o.total))}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 p-6">
          <h2 className="font-serif text-lg">Endereço de entrega padrão</h2>
          {defaultAddress ? (
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              {defaultAddress.street}, {defaultAddress.number}
              {defaultAddress.complement ? ` — ${defaultAddress.complement}` : ""}
              <br />
              {defaultAddress.district} — {defaultAddress.city}/{defaultAddress.state}
              <br />
              CEP {defaultAddress.cep}
            </p>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Nenhum endereço cadastrado ainda.</p>
          )}
          <Button href="/minha-conta/enderecos" variant="soft" size="sm" className="mt-4">
            Gerenciar endereços
          </Button>
        </div>
      </section>

      {/* Áreas completas */}
      <section aria-label="Áreas da sua conta" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map((a) => (
          <Link
            key={a.title}
            href={a.href}
            className="group rounded-2xl border border-stone-200 p-6 transition-all hover:border-accent-600 hover:shadow-card"
          >
            <div className="flex items-center justify-between">
              <a.icon size={20} className="text-accent-700" strokeWidth={1.7} aria-hidden />
              {a.title === "Favoritos" && favoritesCount > 0 ? (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  {favoritesCount}
                </span>
              ) : null}
              {a.title === "Minhas receitas" && receitasPending > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {receitasPending}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 font-medium">{a.title}</h3>
            <p className="mt-1 text-sm text-stone-500">{a.desc}</p>
          </Link>
        ))}

      </section>

      {/* Sair */}
      <form action={signOutAction} className="border-t border-stone-200 pt-6">
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-600 transition-colors hover:text-red-600"
        >
          <LogOut size={16} aria-hidden />
          Sair da conta
        </button>
      </form>
    </div>
  );
}
