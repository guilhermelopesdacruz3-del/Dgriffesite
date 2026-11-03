"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Abas da área logada (Fase 5). Receitas entram na Fase 7b (bucket privado
 * + validação pelo óptico no admin).
 */
const TABS = [
  { href: "/minha-conta/pedidos", label: "Pedidos" },
  { href: "/minha-conta/receitas", label: "Minhas receitas" },
  { href: "/minha-conta/enderecos", label: "Endereços" },
  { href: "/minha-conta/dados", label: "Dados e senha" },
  { href: "/favoritos", label: "Favoritos" },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Áreas da conta"
      className="mt-8 flex gap-1 overflow-x-auto border-b border-stone-200"
    >
      {[{ href: "/minha-conta", label: "Visão geral" }, ...TABS].map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-accent-600 text-ink"
                : "border-transparent text-stone-500 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
