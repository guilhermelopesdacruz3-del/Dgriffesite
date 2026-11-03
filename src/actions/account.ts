"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { deletePrivateObject } from "@/lib/storage";
import { audit } from "@/lib/admin";
import {
  addressSchema,
  changePasswordSchema,
  profileSchema,
} from "@/lib/validators/account";

/**
 * Fase 5 — ações da conta do cliente: perfil, senha, endereços e favoritos.
 * Todas exigem sessão; valida no servidor com os mesmos schemas do cliente.
 */

type ActionResult = { ok: true; faved?: boolean } | { ok: false; error: string };

/** id do logado ou null — cada ação decide como responder sem sessão. */
async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ------------------------------- Perfil -------------------------------

/** Atualiza nome/telefone/CPF do cliente. */
export async function saveProfile(values: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    // Auditoria (A18): CPF não pode já estar em uso por outra conta
    // (pode ser omitido — cadeia vazia não passa pela checagem).
    if (parsed.data.document) {
      const emUso = await db.user.count({
        where: { document: parsed.data.document, NOT: { id: userId } },
      });
      if (emUso > 0) {
        return { ok: false, error: "Este CPF já está cadastrado em outra conta." };
      }
    }

    await db.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        document: parsed.data.document || null,
      },
    });
    revalidatePath("/minha-conta", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[saveProfile]", err);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

/** Troca a senha. Contas só-Google (sem hash) podem criar a primeira senha. */
export async function changePassword(values: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) return { ok: false, error: "Conta não encontrada." };

    // Com hash existente exige a senha atual; sem hash (Google) define direto
    if (user.passwordHash) {
      const valid = await bcrypt.compare(parsed.data.current ?? "", user.passwordHash);
      if (!valid) return { ok: false, error: "Senha atual incorreta." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.next, 10);
    await db.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  } catch (err) {
    console.error("[changePassword]", err);
    return { ok: false, error: "Não foi possível trocar a senha. Tente novamente." };
  }
}

// ------------------------------- Preferências -------------------------------

/** LGPD: preferências de comunicação e fotos do provador. */
export async function savePreferences(
  values: { marketingOptIn: boolean; tryOnPhotosOpt: boolean },
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        marketingOptIn: Boolean(values.marketingOptIn),
        tryOnPhotosOpt: Boolean(values.tryOnPhotosOpt),
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[savePreferences]", err);
    return { ok: false, error: "Não foi possível salvar as preferências." };
  }
}

// ----------------------------- Endereços -----------------------------

/** Cria ou atualiza um endereço do cliente. `isDefault` desmarca os demais. */
export async function saveAddress(values: unknown, id?: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await db.$transaction(async (tx) => {
      // Ao definir como padrão, limpa o padrão atual (exceto o próprio, na edição)
      if (parsed.data.isDefault) {
        await tx.address.updateMany({
          where: { userId, ...(id ? { id: { not: id } } : {}) },
          data: { isDefault: false },
        });
      }

      if (id) {
        // Só dono edita: o where já filtra por userId
        await tx.address.updateMany({
          where: { id, userId },
          data: { ...parsed.data },
        });
        return;
      }

      // Primeiro endereço já nasce padrão
      const count = await tx.address.count({ where: { userId } });
      await tx.address.create({
        data: {
          userId,
          ...parsed.data,
          isDefault: parsed.data.isDefault || count === 0,
        },
      });
    });

    revalidatePath("/minha-conta", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[saveAddress]", err);
    return { ok: false, error: "Não foi possível salvar o endereço." };
  }
}

/** Remove um endereço (deleteMany já filtra por dono). */
export async function deleteAddress(id: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  try {
    const res = await db.address.deleteMany({ where: { id, userId } });
    if (res.count === 0) return { ok: false, error: "Endereço não encontrado." };

    // Se apagou o padrão e ainda há endereços, promove o mais recente
    const rest = await db.address.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (rest) {
      await db.address.update({ where: { id: rest.id }, data: { isDefault: true } });
    }

    revalidatePath("/minha-conta", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[deleteAddress]", err);
    return { ok: false, error: "Não foi possível remover o endereço." };
  }
}

/** Marca um endereço como padrão. */
export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  try {
    await db.$transaction([
      db.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      db.address.updateMany({ where: { id, userId }, data: { isDefault: true } }),
    ]);

    revalidatePath("/minha-conta", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[setDefaultAddress]", err);
    return { ok: false, error: "Não foi possível definir o padrão." };
  }
}

// ------------------------------- Favoritos -------------------------------

/** Favorita/desfavorita por slug do produto (funciona nos cards do catálogo). */
export async function toggleFavorite(slug: string): Promise<ActionResult> {
  const userId = await currentUserId();
  // Visitante: a ação só existe com sessão — o coração segue local no navegador
  if (!userId) return { ok: false, error: "guest" };

  const clean = slug.trim();
  if (!/^[a-z0-9-]{1,120}$/.test(clean)) return { ok: false, error: "Produto inválido." };

  try {
    const product = await db.product.findUnique({
      where: { slug: clean },
      select: { id: true, active: true, deletedAt: true },
    });
    if (!product || !product.active || product.deletedAt) {
      return { ok: false, error: "Produto não disponível." };
    }

    const existing = await db.favorite.findFirst({
      where: { userId, productId: product.id },
      select: { id: true },
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return { ok: true, faved: false };
    }

    await db.favorite.create({ data: { userId, productId: product.id } });
    return { ok: true, faved: true };
  } catch (err) {
    console.error("[toggleFavorite]", err);
    return { ok: false, error: "Não foi possível atualizar os favoritos." };
  }
}

// ------------------------------- LGPD (A12) -------------------------------

/**
 * Exporta TODOS os dados do titular em JSON (LGPD art. 18, II).
 * Nunca inclui passwordHash nem os arquivos de receita em si — o titular
 * já possui os originais que enviou.
 */
export async function exportMyData(): Promise<
  { ok: true; json: string } | { ok: false; error: string }
> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  try {
    const [user, addresses, orders, prescriptions, favorites, cart] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          phone: true,
          document: true,
          marketingOptIn: true,
          tryOnPhotosOpt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.address.findMany({ where: { userId } }),
      db.order.findMany({
        where: { userId },
        select: {
          code: true,
          status: true,
          createdAt: true,
          subtotal: true,
          discount: true,
          shippingCost: true,
          total: true,
          couponCode: true,
          items: {
            select: {
              productName: true,
              variantSku: true,
              quantity: true,
              unitPrice: true,
              withLenses: true,
              lensPackage: { select: { name: true, price: true } },
            },
          },
          payments: { select: { method: true, status: true, amount: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.prescription.findMany({
        where: { userId },
        select: { fileName: true, status: true, createdAt: true, notes: true },
        orderBy: { createdAt: "desc" },
      }),
      db.favorite.findMany({
        where: { userId },
        select: { product: { select: { slug: true, name: true } }, createdAt: true },
      }),
      db.cart.findUnique({
        where: { userId },
        select: { items: true },
      }),
    ]);

    const json = JSON.stringify(
      {
        _aviso: "Exportação dos dados pessoais solicitada por você (LGPD art. 18).",
        exportadoEm: new Date().toISOString(),
        perfil: user,
        enderecos: addresses,
        pedidos: orders,
        receitas: prescriptions.map((r) => ({
          ...r,
          arquivo: "conteúdo do arquivo original não incluído",
        })),
        favoritos: favorites,
        carrinhoAtual: cart?.items ?? [],
      },
      null,
      2,
    );
    return { ok: true, json };
  } catch (err) {
    console.error("[exportMyData]", err);
    return { ok: false, error: "Não foi possível exportar seus dados agora. Tente de novo." };
  }
}

/**
 * Exclui a conta do titular (LGPD art. 18, VI) — exige a palavra "EXCLUIR"
 * como confirmação consciente. Efeito:
 *  • receitas médicas (dado sensível) e seus arquivos no armazenamento privado
 *    são APAGADOS de verdade;
 *  • endereços, favoritos e carrinho são apagados;
 *  • pedidos permanecem para fins fiscais/contábeis da loja, porém ANONIMIZADOS
 *    (vínculo com o cliente removido — ficam inacessíveis até para o admin).
 */
export async function deleteMyAccount(
  confirm: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sessão expirada. Entre de novo." };
  if (confirm !== "EXCLUIR") {
    return { ok: false, error: "Confirmação inválida — digite EXCLUIR." };
  }

  try {
    // 1) Armações no armazenamento privado (best-effort, fora do banco).
    const files = await db.prescription.findMany({
      where: { userId },
      select: { fileUrl: true },
    });
    await Promise.all(files.map((f) => deletePrivateObject(f.fileUrl)));

    // 2) Registro próprio do evento ANTES da exclusão (o ator perde o vínculo).
    const session = await auth();
    await audit(
      { id: userId, email: session?.user?.email ?? null },
      "account.deleted",
      "User",
      userId,
    );

    // 3) Deleção: cascade apaga receitas/endereços/favoritos/carrinho/contas OAuth
    //    e o vínculo dos pedidos vira nulo (anonimização automática).
    await db.user.delete({ where: { id: userId } });

    // 4) Encerra a sessão do cliente que acabou de se excluir.
    await signOut({ redirect: false });
    return { ok: true };
  } catch (err) {
    console.error("[deleteMyAccount]", err);
    return { ok: false, error: "Não foi possível excluir a conta agora. Fale com a ótica." };
  }
}
