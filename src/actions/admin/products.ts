"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireAdminForAction, toDecimalString } from "@/lib/admin";
import { productSchema, slugify } from "@/lib/validators/admin";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Fase 6 — CRUD de produtos com variações, imagens e estoque.
 * Variações/imagens chegam sincronizadas do formulário: ids existentes são
 * atualizados, id vazio cria e o que sumiu do payload é removido.
 * Mudança de estoque gera StockMovement (trilha de auditoria).
 */
export async function saveProduct(values: unknown, id?: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const input = parsed.data;

  try {
    // Categoria/marca precisam existir (selects do form podem estar defasados)
    const [brand, category] = await Promise.all([
      db.brand.findUnique({ where: { id: input.brandId }, select: { name: true } }),
      db.category.findUnique({ where: { id: input.categoryId }, select: { name: true } }),
    ]);
    if (!brand) return { ok: false, error: "Marca não encontrada." };
    if (!category) return { ok: false, error: "Categoria não encontrada." };

    // slug/sku derivados do nome quando não informados (com fallback anti-colisão)
    let slug = slugify(input.slug || input.name) || `produto-${Date.now()}`;
    const slugTaken = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (slugTaken && slugTaken.id !== id) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const productId = await db.$transaction(async (tx) => {
      // ---------- Produto (create/update) ----------
      let pid: string;
      const data = {
        name: input.name,
        slug,
        sku:
          input.sku ||
          `SKU-${slug.toUpperCase().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        type: input.type,
        gender: input.gender,
        frameShape: input.frameShape === "" ? null : input.frameShape,
        description: input.description,
        shortDescription: input.shortDescription || null,
        material: input.material || null,
        lensWidth: input.lensWidth ? Number(input.lensWidth) : null,
        bridge: input.bridge ? Number(input.bridge) : null,
        temple: input.temple ? Number(input.temple) : null,
        price: toDecimalString(input.price) as string,
        comparePrice: toDecimalString(input.comparePrice),
        cost: toDecimalString(input.cost),
        isFeatured: input.isFeatured,
        isNew: input.isNew,
        active: input.active,
        deletedAt: null,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        brandId: input.brandId,
        categoryId: input.categoryId,
      };

      if (id) {
        const existing = await tx.product.findUnique({ where: { id }, select: { id: true, slug: true } });
        if (!existing) throw new Error("NOT_FOUND");
        const updated = await tx.product.update({ where: { id }, data, select: { id: true } });
        pid = updated.id;
      } else {
        const created = await tx.product.create({ data, select: { id: true } });
        pid = created.id;
      }

      // ---------- Variações ----------
      const keepVariantIds: string[] = [];
      for (const v of input.variants) {
        const vData = {
          productId: pid,
          colorName: v.colorName || null,
          colorHex: v.colorHex || null,
          size: v.size || null,
          stock: v.stock,
          priceOverride: toDecimalString(v.priceOverride),
          active: v.active ?? true,
        };

        if (v.id) {
          const previous = await tx.productVariant.findUnique({
            where: { id: v.id },
            select: { stock: true, productId: true },
          });
          if (previous && previous.productId === pid) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { ...vData, sku: v.sku || undefined },
            });
            keepVariantIds.push(v.id);
            // Estoque mudou manualmente → registra movimento
            if (previous.stock !== v.stock) {
              await tx.stockMovement.create({
                data: {
                  variantId: v.id,
                  delta: v.stock - previous.stock,
                  reason: "ADJUSTMENT",
                  note: `Ajuste no admin — ${input.name}`,
                  userId: guard.user.id,
                },
              });
            }
            continue;
          }
        }

        // Nova variação (id vazio ou id de outro produto — sempre cria)
        const createdVariant = await tx.productVariant.create({
          data: {
            ...vData,
            sku:
              v.sku ||
              `${data.sku}-${(v.colorName || "var").toUpperCase().replace(/\s+/g, "").slice(0, 6)}`,
          },
          select: { id: true },
        });
        keepVariantIds.push(createdVariant.id);
        if (v.stock > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: createdVariant.id,
              delta: v.stock,
              reason: id ? "ADJUSTMENT" : "INITIAL",
              note: id ? "Ajuste no admin" : "Cadastro do produto",
              userId: guard.user.id,
            },
          });
        }
      }
      // Remove variações que sumiram (cascade: imagens/model3d/estoque vão junto)
      const currentVariants = await tx.productVariant.findMany({ where: { productId: pid }, select: { id: true } });
      const doomed = currentVariants.filter((cv) => !keepVariantIds.includes(cv.id));
      if (doomed.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
      }

      // ---------- Imagens ----------
      const keepImageIds: string[] = [];
      let sawMain = false;
      for (const [index, img] of input.images.entries()) {
        if (!img.isMain && index === 0) {
          // primeira imagem é a principal quando nenhuma marcada
          img.isMain = true;
        }
        if (img.isMain) sawMain = true;

        const imgData = {
          productId: pid,
          variantId: null, // ns.: associação por cor chega na Fase 7 (upload)
          url: img.url,
          alt: img.alt || null,
          position: index,
          isMain: img.isMain ?? false,
        };

        if (img.id) {
          const existingImg = await tx.productImage.findUnique({ where: { id: img.id }, select: { productId: true } });
          if (existingImg && existingImg.productId === pid) {
            await tx.productImage.update({ where: { id: img.id }, data: imgData });
            keepImageIds.push(img.id);
            continue;
          }
        }
        const created = await tx.productImage.create({ data: imgData, select: { id: true } });
        keepImageIds.push(created.id);
      }
      if (!sawMain && keepImageIds.length > 0) {
        await tx.productImage.update({ where: { id: keepImageIds[0] }, data: { isMain: true } });
      }
      // Só uma imagem pode ser principal — mantém a primeira marcada
      const mainRows = await tx.productImage.findMany({
        where: { productId: pid, isMain: true },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (mainRows.length > 1) {
        await tx.productImage.updateMany({
          where: { productId: pid, isMain: true, id: { not: mainRows[0].id } },
          data: { isMain: false },
        });
      }
      const currentImages = await tx.productImage.findMany({ where: { productId: pid }, select: { id: true } });
      const deadImages = currentImages.filter((ci) => !keepImageIds.includes(ci.id));
      if (deadImages.length > 0) {
        await tx.productImage.deleteMany({ where: { id: { in: deadImages.map((d) => d.id) } } });
      }

      return pid;
    });

    await audit(
      { id: guard.user.id, email: guard.user.email },
      id ? "product.update" : "product.create",
      "Product",
      productId,
      { slug, name: input.name, variants: input.variants.length, images: input.images.length },
    );

    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    revalidatePath(`/produtos/${slug}`);
    return { ok: true, id: productId };
  } catch (err) {
    console.error("[saveProduct]", err);
    return { ok: false, error: "Não foi possível salvar o produto." };
  }
}

/** Exclusão lógica (o produto sai da loja, o histórico de pedidos continua). */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  try {
    const product = await db.product.findUnique({ where: { id }, select: { name: true, slug: true } });
    if (!product) return { ok: false, error: "Produto não encontrado." };

    await db.product.update({ where: { id }, data: { active: false, deletedAt: new Date() } });

    await audit(
      { id: guard.user.id, email: guard.user.email },
      "product.delete",
      "Product",
      id,
      { name: product.name, slug: product.slug },
    );

    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    return { ok: true };
  } catch (err) {
    console.error("[deleteProduct]", err);
    return { ok: false, error: "Não foi possível remover o produto." };
  }
}
