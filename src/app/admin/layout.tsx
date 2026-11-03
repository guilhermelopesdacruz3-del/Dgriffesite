import { signOut, auth } from "@/auth";
import { LogOut, Store } from "lucide-react";
import { requireAdminPage } from "@/lib/admin";
import { AdminNav, AdminNavMobile } from "@/components/admin/admin-nav";

/**
 * Shell do painel administrativo (Fase 6):
 * - desktop: coluna lateral fixa com perfil, menu e sair;
 * - celular: topo com abas horizontais roláveis e sair compacto.
 * A dupla checagem de papel acontece em requireAdminPage (además do middleware).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-svh bg-stone-50">
      {/* Barra do celular */}
      <div className="border-b border-stone-200 bg-white px-4 pt-4 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-lg">
            Painel <span className="text-accent-700">Pierre</span>
          </p>
          <div className="flex items-center gap-1">
            <a
              href="/"
              aria-label="Abrir a loja"
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
            >
              <Store size={17} strokeWidth={1.7} />
            </a>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sair do painel"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={17} strokeWidth={1.7} />
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3">
          <AdminNavMobile />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 lg:px-8">
        {/* Coluna lateral (desktop) */}
        <aside className="sticky top-8 hidden h-fit w-60 shrink-0 lg:block">
          <div className="rounded-3xl border border-stone-200 bg-white p-5">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
              Painel Pierre
            </p>
            <p className="mb-5 mt-1 truncate px-2 text-sm">
              {session.user.name ?? "admin"}
              <span className="block text-xs text-stone-500">{session.user.email}</span>
            </p>
            <AdminNav />
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="w-full cursor-pointer rounded-xl px-4 py-2.5 text-left text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-red-600"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
