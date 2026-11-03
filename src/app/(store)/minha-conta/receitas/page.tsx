import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AccountNav } from "@/components/account/account-nav";
import { ReceitasPanel } from "@/components/account/receitas-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minhas receitas" };

/**
 * Fase 7b — receitas do cliente: envio (foto/PDF, bucket privado) e lista com
 * o status da análise do óptico. Pedidos com lentes vinculam uma receita aqui.
 */
export default async function MyReceitasPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const receitas = await db.prescription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, status: true, notes: true, createdAt: true },
  });

  return (
    <div>
      <AccountNav />
      <h1 className="mt-8 font-serif text-2xl leading-tight md:text-3xl">Minhas receitas</h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        Guardamos suas receitas de forma privada (nada de links públicos) e usamos
        a que você escolher para montar as lentes do pedido.
      </p>
      <div className="mt-6">
        <ReceitasPanel initial={receitas} />
      </div>
    </div>
  );
}
