/**
 * POST /api/admin/model3d/upload — upload do arquivo .glb de um produto
 * (Fase 7). Escreve no bucket do Neon Object Storage (chave imutável sob
 * `models/{productId}/`), desativa o modelo ativo atual e cria o novo com a
 * calibração padrão. O produto passa a carregar o modelo no provador
 * (`/provador/estudio?produto=slug`).
 *
 * É uma rota (não server action) por causa do tamanho do corpo (até 30 MB).
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminForAction, audit } from "@/lib/admin";
import {
  MAX_GLB_BYTES,
  isGlbBuffer,
  putStorageObject,
  deleteStorageObject,
  storagePublicUrl,
  storageKeyFromUrl,
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
      { ok: false, message: "Informe o produto e o arquivo .glb." },
      { status: 400 },
    );
  }
  if (file.size > MAX_GLB_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Arquivo maior que 30 MB — exporte um .glb mais leve." },
      { status: 413 },
    );
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, deletedAt: true },
  });
  if (!product || product.deletedAt) {
    return NextResponse.json({ ok: false, message: "Produto não encontrado." }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!isGlbBuffer(buf)) {
    return NextResponse.json(
      { ok: false, message: "O arquivo precisa ser um modelo .glb (glTF binário)." },
      { status: 415 },
    );
  }

  const key = buildObjectKey("models", productId, ".glb");
  await putStorageObject(key, buf, "model/gltf-binary");
  const url = storagePublicUrl(key);

  try {
    // 1) Banco: desativa o anterior, apaga linhas inativas (histórico fica no
    //    AuditLog) e cria o novo com calibração padrão.
    const replaced = await db.$transaction(async (tx) => {
      const previous = await tx.model3D.findMany({
        where: { productId: product.id, active: true },
        select: { glbUrl: true },
      });
      await tx.model3D.updateMany({
        where: { productId: product.id, active: true },
        data: { active: false },
      });
      await tx.model3D.deleteMany({
        where: { productId: product.id, active: false },
      });
      // Novos inativos: as linhas que acabaram de ser desativadas nesta transação.
      const after = await tx.model3D.findMany({
        where: { productId: product.id, active: false },
        select: { glbUrl: true },
      });
      return { urls: [...previous.map((m) => m.glbUrl), ...after.map((m) => m.glbUrl)] };
    });

    const model = await db.model3D.create({
      data: { productId: product.id, glbUrl: url, sizeBytes: buf.length },
    });

    // 2) Bucket: sobe o produto → remove os arquivos Antigos sem referência
    //    (best-effort; manter não rein/quebra nada, apenas ocupa espaço).
    const uniqueOld = new Set(replaced.urls);
    await Promise.all(
      [...uniqueOld]
        .map(storageKeyFromUrl)
        .filter((k): k is string => k !== null && k !== key)
        .map((k) => deleteStorageObject(k)),
    );

    await audit(
      { id: guard.user.id, email: guard.user.email },
      "model3d.upload",
      "Model3D",
      model.id,
      { product: product.slug, sizeBytes: buf.length, key, replacedCount: uniqueOld.size },
    );

    revalidatePath(`/produtos/${product.slug}`);
    return NextResponse.json({
      ok: true,
      model: {
        id: model.id,
        glbUrl: model.glbUrl,
        sizeBytes: model.sizeBytes,
        active: model.active,
        scale: model.scale,
        offsetX: model.offsetX,
        offsetY: model.offsetY,
        offsetZ: model.offsetZ,
        rotX: model.rotX,
        rotY: model.rotY,
        rotZ: model.rotZ,
        turn: model.turn,
        stretchX: model.stretchX,
        stretchY: model.stretchY,
        tilt: model.tilt,
      },
    });
  } catch (err) {
    // Banco falhou depois do envio: limpa o objeto para não deixar lixo.
    await deleteStorageObject(key);
    console.error("[model3d/upload] falha ao gravar", err);
    return NextResponse.json(
      { ok: false, message: "Não foi possível salvar o modelo — tente novamente." },
      { status: 500 },
    );
  }
}
