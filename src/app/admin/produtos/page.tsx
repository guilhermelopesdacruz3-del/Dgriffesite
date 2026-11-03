import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produtos — Painel admin", robots: { index: false } };

/**
 * Fase 6 — catálogo interno: busca por nome/SKU, tabela com preço, estoque
 * agregado e estado. A edição fica em /admin/produtos/[id].
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();

  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q.toUpperCase() } },
              { slug: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      price: true,
      comparePrice: true,
      active: true,
      isFeatured: true,
      isNew: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      type: true,
      images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
      variants: { select: { stock: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl leading-tight lg:text-3xl">Produtos</h1>
          <p className="mt-1 text-sm text-stone-500">{products.length} produto(s) no catálogo</p>
        </div>
        <Button href="/admin/produtos/novo" variant="accent" size="sm">
          + Novo produto
        </Button>
      </header>

      <form action="/admin/produtos" className="flex max-w-md gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, SKU ou slug…"
          className="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-accent-600 focus:outline-none"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90"
        >
          Buscar
        </button>
      </form>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Nenhum produto encontrado. {q ? "Tente outra busca ou " : ""}cadastre o primeiro com “Novo produto”.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Marca</th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">Estoque</th>
                <th scope="col" className="px-4 py-3 text-right">Preço</th>
                <th scope="col" className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((p) => {
                const stock = p.variants.reduce((acc, v) => acc + v.stock, 0);
                return (
                  <tr key={p.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-3">
                        <span className="relative block h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                          {p.images[0] ? (
                            <Image src={p.images[0].url} alt="" fill sizes="36px" className="object-cover" unoptimized />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium underline-offset-2 hover:underline">{p.name}</span>
                          <span className="block text-[11px] text-stone-500">
                            {p.sku} · {p.category.name}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-600 md:table-cell">{p.brand.name}</td>
                    <td className={`hidden px-4 py-3 lg:table-cell ${stock === 0 ? "font-semibold text-red-600" : stock <= 5 ? "font-semibold text-amber-600" : "text-stone-600"}`}>
                      {stock}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatBRL(Number(p.price))}
                      {p.comparePrice ? (
                        <span className="ml-1 text-xs text-stone-400 line-through">{formatBRL(Number(p.comparePrice))}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {p.isFeatured && <Badge variant="sale">Destaque</Badge>}
                        {p.isNew && <Badge variant="neutral">Novo</Badge>}
                        {p.active ? null : <Badge variant="outline">Inativo</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
