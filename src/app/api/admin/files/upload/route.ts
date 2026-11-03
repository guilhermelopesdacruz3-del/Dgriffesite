/**
 * POST /api/admin/files/upload — upload de imagem de produto no admin
 * (Fase 7). Aceita JPEG/PNG/WEBP (checando magic bytes) até 8 MB, guarda no
 * bucket sob `produtos/{productId}/` e devolve a URL pública direta do
 * objeto — o formulário a insere na lista de imagens.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminForAction, audit } from "@/lib/admin";
import {
  MAX_IMAGE_BYTES,
  imageKindFromBuffer,
  putStorageObject,
  deleteStorageObject,
  storagePublicUrl,
  buildObjectKey,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireAdminForAction();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.error }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Envio inválido — tente novamente." },
      { status: 400 },
    );
  }

  const productField = form.get("productId");
  const fileField = form.get("file");
  const productId = typeof productField === "string" && productField ? productField : "";
  const file = fileField instanceof File ? fileField : null;

  if (!productId || !file) {
    return NextResponse.json(
      { ok: false, message: "Informe o produto e a imagem." },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Imagem maior que 8 MB — comprima o arquivo." },
      { status: 413 },
    );
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, deletedAt: true },
  });
  if (!product || product.deletedAt) {
    return NextResponse.json({ ok: false, message: "Produto não encontrado." }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = imageKindFromBuffer(buf);
  if (!kind) {
    return NextResponse.json(
      { ok: false, message: "Formato não suportado — envie JPEG, PNG ou WEBP." },
      { status: 415 },
    );
  }

  const key = buildObjectKey("produtos", productId, `.${kind.ext}`);
  await putStorageObject(key, buf, kind.contentType);
  const url = storagePublicUrl(key);

  await audit({ id: guard.user.id, email: guard.user.email }, "image.upload", "ProductImage", product.id, {
    product: product.slug,
    sizeBytes: buf.length,
    key,
  });

  return NextResponse.json({ ok: true, url, sizeBytes: buf.length });
}
