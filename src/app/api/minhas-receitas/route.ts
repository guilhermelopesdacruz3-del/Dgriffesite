/**
 * GET /api/minhas-receitas — lista as receitas do usuário logado (usado no
 * checkout para vincular uma receita ao pedido e no painel da conta).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, receitas: [], message: "Não autenticado." }, { status: 401 });
  }
  const receitas = await db.prescription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, status: true, notes: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, receitas });
}
