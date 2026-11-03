"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, ScanFace, User, Heart, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Drawer } from "@/components/ui/drawer";
import { CartBadge } from "@/components/layout/cart-badge";
import { storeConfig } from "@/lib/config";

export function Header({
  user,
}: {
  user: { name: string; email: string; role: string } | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q") as string | null;
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(q ? `/produtos?q=${encodeURIComponent(q)}` : "/produtos");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4 md:h-20">
        {/* Mobile: menu */}
        <button
          className="tap-target flex w-9 items-center justify-center lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>

        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-2xl tracking-tight md:text-3xl"
          aria-label={`${storeConfig.name} — página inicial`}
        >
          {storeConfig.shortName}
          <span className="text-accent-600">.</span>
        </Link>

        {/* Navegação desktop */}
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {storeConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Provador em destaque (desktop) */}
          <Link
            href="/provador"
            className="mr-1 hidden items-center gap-2 rounded-full border border-accent-600 px-4 py-1.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-50 xl:flex"
          >
            <ScanFace size={16} aria-hidden /> Provador virtual
          </Link>

          {/* Busca (desktop: expande input) */}
          <button
            className="flex w-9 items-center justify-center"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "Fechar busca" : "Abrir busca"}
            aria-expanded={searchOpen}
          >
            {searchOpen ? <X size={20} strokeWidth={1.8} /> : <Search size={20} strokeWidth={1.8} />}
          </button>

          <Link
            href={user ? "/minha-conta" : "/entrar"}
            className="flex w-9 items-center justify-center"
            aria-label={user ? "Minha conta" : "Entrar / Criar conta"}
          >
            {user ? (
              // Logado: inicial do usuário com anel de destaque
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700 ring-1 ring-accent-600"
              >
                {(user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
              </span>
            ) : (
              <User size={20} strokeWidth={1.8} />
            )}
          </Link>

          <Link href="/favoritos" className="hidden w-9 items-center justify-center md:flex" aria-label="Favoritos">
            <Heart size={20} strokeWidth={1.8} />
          </Link>

          <Link href="/carrinho" className="relative flex w-9 items-center justify-center" aria-label="Carrinho de compras">
            <ShoppingBag size={20} strokeWidth={1.8} />
            {/* Badge reativo com a contagem do mini carrinho (localStorage) */}
            <CartBadge />
          </Link>
        </div>
      </Container>

      {/* Campo de busca expandido */}
      {searchOpen && (
        <div className="border-t border-stone-200 bg-white animate-fade-in">
          <Container className="py-3">
            <form onSubmit={submitSearch} role="search" className="flex gap-2">
              <input
                type="search"
                name="q"
                autoFocus
                placeholder="Buscar armações, marcas e modelos…"
                aria-label="Buscar produtos"
                className="h-11 w-full rounded-full border border-stone-300 px-5 text-[15px] outline-none focus:border-accent-600 focus:ring-1 focus:ring-accent-600"
              />
              <button type="submit" className="h-11 rounded-full bg-ink px-6 text-sm font-medium text-white hover:bg-ink/90">
                Buscar
              </button>
            </form>
          </Container>
        </div>
      )}

      {/* Menu mobile */}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} side="left" title="Menu">
        <nav className="flex flex-col p-5" aria-label="Menu mobile">
          {storeConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-stone-100"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/provador"
            onClick={() => setMenuOpen(false)}
            className="mt-2 flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium text-accent-700 transition-colors hover:bg-accent-50"
          >
            <ScanFace size={18} aria-hidden /> Provador virtual
          </Link>

          <form onSubmit={submitSearch} role="search" className="mt-4 flex gap-2 border-t border-stone-200 pt-4">
            <input
              type="search"
              name="q"
              placeholder="Buscar…"
              aria-label="Buscar produtos"
              className="h-11 w-full rounded-full border border-stone-300 px-5 text-[15px] outline-none focus:border-accent-600"
            />
            <button type="submit" className="h-11 rounded-full bg-ink px-5 text-sm font-medium text-white">
              Ok
            </button>
          </form>
        </nav>
      </Drawer>
    </header>
  );
}
