/**
 * Fase 7 — ações do admin para o modelo 3D do produto.
 *
 * saveModel3dCalibration: o estúdio do provador (modo calibração, aberto pelo
 * admin) envia a calibração ajustada em tempo real e o banco atualiza o
 * `Model3D` do produto — qualquer pessoa que abrir o provador pela PDP vê o
 * encaixe salvo.
 *
 * deactivateModel3d: desativa o modelo do produto (⇒ a PDP/estúdio volta a
 * exibir a armação padrão) e libera o arquivo do bucket.
 */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminForAction, audit } from "@/lib/admin";
import { storageKeyFromUrl, deleteStorageObject } from "@/lib/storage";

const calibSchema = z.object({
  modelId: z.string().min(1),
  scale: z.number().min(0.2).max(6),
  x: z.number().min(-120).max(120),
  y: z.number().min(-120).max(120),
  z: z.number().min(-120).max(120),
  rotX: z.number().min(-180).max(180),
  rotY: z.number().min(-180).max(180),
  rotZ: z.number().min(-180).max(180),
  turn: z.boolean(),
  stretchX: z.number().min(0.5).max(2.5),
  stretchY: z.number().min(0.5).max(2.5),
  tilt: z.number().min(-40).max(40),
});

export type Model3dActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveModel3dCalibrationAction(input: unknown): Promise<Model3dActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return { ok: false, message: guard.error };

  const parsed = calibSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Ajustes fora da faixa permitida." };
  }
  const c = parsed.data;

  const model = await db.model3D.findUnique({
    where: { id: c.modelId },
    select: { id: true, product: { select: { slug: true, deletedAt: true } } },
  });
  if (!model || !model.product || model.product.deletedAt) {
    return { ok: false, message: "Modelo 3D não encontrado." };
  }

  await db.model3D.update({
    where: { id: c.modelId },
    data: {
      scale: c.scale,
      offsetX: c.x,
      offsetY: c.y,
      offsetZ: c.z,
      rotX: c.rotX,
      rotY: c.rotY,
      rotZ: c.rotZ,
      turn: c.turn,
      stretchX: c.stretchX,
      stretchY: c.stretchY,
      tilt: c.tilt,
      active: true,
    },
  });

  await audit(
    { id: guard.user.id, email: guard.user.email },
    "model3d.calibrate",
    "Model3D",
    c.modelId,
    { product: model.product.slug, calibration: { scale: c.scale, x: c.x, y: c.y, z: c.z, rotX: c.rotX, rotY: c.rotY, rotZ: c.rotZ, turn: c.turn, stretchX: c.stretchX, stretchY: c.stretchY, tilt: c.tilt } },
  );

  revalidatePath(`/produtos/${model.product.slug}`);
  return { ok: true };
}

export async function deactivateModel3dAction(modelId: string): Promise<Model3dActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return { ok: false, message: guard.error };
  if (!/^[\w-]+$/.test(modelId)) return { ok: false, message: "Referência inválida." };

  const model = await db.model3D.findUnique({
    where: { id: modelId },
    select: { id: true, glbUrl: true, product: { select: { slug: true } } },
  });
  if (!model || !model.product) return { ok: false, message: "Modelo 3D não encontrado." };

  await db.model3D.delete({ where: { id: modelId } });
  const key = storageKeyFromUrl(model.glbUrl);
  if (key) await deleteStorageObject(key);
  else await deleteStorageObject(model.glbUrl); // URL não-padrão: tenta cego

  await audit(
    { id: guard.user.id, email: guard.user.email },
    "model3d.deactivate",
    "Model3D",
    modelId,
    { product: model.product.slug },
  );

  revalidatePath(`/produtos/${model.product.slug}`);
  return { ok: true };
}
