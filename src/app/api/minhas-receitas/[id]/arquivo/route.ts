/**
 * GET /api/minhas-receitas/[id]/arquivo — visualização protegida da receita
 * (Fase 7b). Aceito apenas: dono da receita ou ADMIN. No lugar de servir os
 * bytes, emitimos uma URL assinada do bucket privado (15 min) e redirecionamos
 * — o link expira sozinho e nunca fica registrado em cache de página.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { presignPrivateGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[\w-]{1,40}$/.test(id)) {
    return NextResponse.json({ ok: false, message: "Referência inválida." }, { status: 400 });
  }

  const receita = await db.prescription.findUnique({
    where: { id },
    select: { userId: true, fileUrl: true, mimeType: true },
  });
  if (!receita) {
    return NextResponse.json({ ok: false, message: "Receita não encontrada." }, { status: 404 });
  }

  const isOwner = session.user.id === receita.userId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ ok: false, message: "Sem acesso a esta receita." }, { status: 403 });
  }

  try {
    const url = await presignPrivateGet(receita.fileUrl);
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Não foi possível abrir a receita agora." },
      { status: 500 },
    );
  }
}
