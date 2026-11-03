/**
 * Fase 7b — ações do cliente sobre as próprias receitas.
 * Exclusão: só a própria (dono), só PENDING e só quando nenhuma linha de
 * pedido vincula a receita (receita usada faz parte do histórico da compra).
 */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { deletePrivateObject } from "@/lib/storage";

export type ReceitaAction =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteMyReceita(receitaId: string): Promise<ReceitaAction> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Entre na sua conta." };
  }
  if (!/^[\w-]{1,40}$/.test(receitaId)) {
    return { ok: false, message: "Referência inválida." };
  }

  const receita = await db.prescription.findUnique({
    where: { id: receitaId },
    select: { id: true, userId: true, fileUrl: true, status: true, _count: { select: { orderItems: true, cartItems: true } } },
  });
  if (!receita || receita.userId !== session.user.id) {
    return { ok: false, message: "Receita não encontrada." };
  }
  if (receita.status !== "PENDING") {
    return { ok: false, message: "Só receitas ainda não analisadas podem ser excluídas." };
  }
  if (receita._count.orderItems > 0 || receita._count.cartItems > 0) {
    return { ok: false, message: "Esta receita está vinculada a um pedido — fale com a ótica." };
  }

  await db.prescription.delete({ where: { id: receitaId } });
  await deletePrivateObject(receita.fileUrl); // best-effort
  return { ok: true };
}
