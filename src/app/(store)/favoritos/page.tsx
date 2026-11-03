import { auth } from "@/auth";
import { getFavoriteProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Favoritos" };

/**
 * Fase 5 — favoritos sincronizados com a conta. Visitante vê o convite para
 * entrar (os corações do catálogo continuam clicáveis para todos).
 */
export default async function FavoritesPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
        <p className="font-serif text-xl">Entre para guardar seus favoritos</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Com uma conta, os modelos que você marcar ficam sincronizados e prontos
          na hora do checkout.
        </p>
        <Button href="/entrar?callbackUrl=/favoritos" className="mt-6">
          Entrar na minha conta
        </Button>
      </div>
    );
  }

  const products = await getFavoriteProducts(userId);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
        <p className="font-serif text-xl">Nenhum favorito salvo</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Toque no coração dos modelos que você gostou para guardá-los aqui.
        </p>
        <Button href="/produtos" variant="soft" className="mt-6">
          Explorar o catálogo
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl leading-tight md:text-4xl">Favoritos</h1>
      <p className="mt-2 text-sm text-stone-500">
        {products.length} {products.length === 1 ? "modelo salvo" : "modelos salvos"} na sua conta.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.slug} product={p} favorite priority={i < 4} />
        ))}
      </div>

      <p className="mt-8 text-sm text-stone-500">
        Procurando algo específico?{" "}
        <Link href="/provador" className="font-medium text-accent-700 hover:underline">
          Experimente no provador virtual
        </Link>
        .
      </p>
    </div>
  );
}
