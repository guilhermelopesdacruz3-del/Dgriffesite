"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TicketPercent,
  Store,
  Glasses,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Itens do painel admin (Fase 6). GLB/categorias entram na Fase 7+.
 * Um só conjunto de dados alimenta o menu lateral (desktop) e a barra
 * horizontal rolável (celular) — nada de lista duplicada.
 */
const ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/lentes", label: "Lentes", icon: Glasses },
  { href: "/admin/cupons", label: "Cupons", icon: TicketPercent },
  { href: "/admin/ajustes", label: "Ajustes", icon: SlidersHorizontal },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

/** Menu lateral do desktop (coluna fixa). */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Painel admin" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100 hover:text-ink",
            )}
          >
            <item.icon size={17} strokeWidth={1.7} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="mt-4 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
      >
        <Store size={17} strokeWidth={1.7} aria-hidden />
        Ver loja
      </Link>
    </nav>
  );
}

/** Barra de abas rolável para telas pequenas (< lg). */
export function AdminNavMobile() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Painel admin (celular)"
      className="flex gap-2 overflow-x-auto pb-1 lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-ink text-white"
                : "border border-stone-300 bg-white text-stone-600 hover:border-ink hover:text-ink",
            )}
          >
            <item.icon size={15} strokeWidth={1.7} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:border-ink hover:text-ink"
      >
        <Store size={15} strokeWidth={1.7} aria-hidden />
        Loja
      </Link>
    </nav>
  );
}
