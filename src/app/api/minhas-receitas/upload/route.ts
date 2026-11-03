/**
 * POST /api/minhas-receitas/upload — cliente logado envia a receita de óculos
 * (foto ou PDF, Fase 7b).
 *
 * Dado sensível: o arquivo vai para o bucket PRIVADO (`uploads`), nunca é
 * servido por link fixo — a leitura passa pela rota autenticada
 * /api/minhas-receitas/[id]/arquivo (dono ou admin), que redireciona para uma
 * URL assinada de vida curta. A receita entra como PENDING até o óptico validar.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import {
  MAX_RECEITA_BYTES,
  receitaKindFromBuffer,
  putPrivateObject,
  buildObjectKey,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Entre na sua conta para enviar a receita." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Envio inválido — tente novamente." }, { status: 400 });
  }

  const fileField = form.get("file");
  const file = fileField instanceof File ? fileField : null;
  const notesField = form.get("notes");
  const notes = typeof notesField === "string" && notesField.trim() ? notesField.trim().slice(0, 500) : null;

  if (!file) {
    return NextResponse.json({ ok: false, message: "Escolha a foto ou o PDF da receita." }, { status: 400 });
  }
  if (file.size > MAX_RECEITA_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Arquivo maior que 10 MB — envie uma foto mais leve ou um PDF comprimido." },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = receitaKindFromBuffer(buf);
  if (!kind) {
    return NextResponse.json(
      { ok: false, message: "Formato não suportado — envie a receita em foto (JPEG/PNG/WEBP) ou PDF." },
      { status: 415 },
    );
  }

  const key = buildObjectKey(`receitas/${userId}`, userId, `.${kind.ext}`);
  try {
    await putPrivateObject(key, buf, kind.contentType);

    const receita = await db.prescription.create({
      data: {
        userId,
        fileName: file.name.slice(0, 180),
        fileUrl: key, // no bucket privado guardamos a KEY (não existe URL pública)
        mimeType: kind.contentType,
        sizeBytes: buf.length,
        status: "PENDING",
        notes,
      },
    });

    return NextResponse.json({
      ok: true,
      receita: {
        id: receita.id,
        fileName: receita.fileName,
        status: receita.status,
        createdAt: receita.createdAt,
      },
    });
  } catch (err) {
    await putPrivateObjectCleanup(key);
    console.error("[receitas/upload] falha ao gravar", err);
    return NextResponse.json(
      { ok: false, message: "Não foi possível salvar a receita agora — tente novamente." },
      { status: 500 },
    );
  }
}

/** Limpeza best-effort do objeto se o registro no banco falhar. */
async function putPrivateObjectCleanup(key: string) {
  const { deletePrivateObject } = await import("@/lib/storage");
  await deletePrivateObject(key);
}
