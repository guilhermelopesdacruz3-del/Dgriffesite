import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Fase 6 — guardas e utilidades do admin. Middleware já bloqueia anônimos;
 * aqui garantimos papel ADMIN nas páginas e server actions.
 */

/**
 * Papel REAL do usuário, direto do banco (auditoria A21): o JWT carregado na
 * sessão pode estar velho — um admin rebaixado a cliente deixaria de ser
 * tratado como admin imediatamente, não só na próxima renovação de token.
 * Falha fechado: sem resposta do banco, o acesso é negado.
 */
export async function getRoleFromDb(
  userId: string | null | undefined,
): Promise<Role | null> {
  if (!userId) return null;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    return user?.role ?? null;
  } catch {
    return null;
  }
}

/** Redireciona quando não-ADMIN (uso em páginas server). */
export async function requireAdminPage(): Promise<Session> {
  const session: Session | null = await auth();
  if (!session) redirect("/entrar?erro=admin&callbackUrl=/admin");
  if (session.user?.role !== "ADMIN" || (await getRoleFromDb(session.user?.id)) !== "ADMIN") {
    redirect("/entrar?erro=admin&callbackUrl=/admin");
  }
  return session;
}

/** Server action: blocos retornam { ok:false } quando não-ADMIN. */
export type AdminGuard =
  | { ok: true; user: { id: string | null; email: string | null } }
  | { ok: false; error: string };

export async function requireAdminForAction(): Promise<AdminGuard> {
  const session: Session | null = await auth();
  if (!session) {
    return { ok: false, error: "Acesso restrito a administradores." };
  }
  const isAdmin =
    session.user?.role === "ADMIN" && (await getRoleFromDb(session.user?.id)) === "ADMIN";
  if (!isAdmin) {
    return { ok: false, error: "Acesso restrito a administradores." };
  }
  return { ok: true, user: { id: session.user.id, email: session.user.email ?? null } };
}

/** Log de auditoria — melhor esforço (nunca falha a operação principal). */
export async function audit(
  actor: { id?: string | null; email?: string | null },
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Record<string, unknown>,
) {
  try {
    const hdrs = await headers();
    await (db as PrismaClient).auditLog.create({
      data: {
        actorId: actor.id ?? null,
        actorEmail: actor.email ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        data: data ? (JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue) : undefined,
        ip: hdrs.get("x-forwarded-for") ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao registrar", err);
  }
}

/**
 * Converte o valor textual de preço ("199.9" | "199,90") para string Decimal
 * do Prisma. "" → null.
 */
export function toDecimalString(value: string | null | undefined): string | null {
  const v = (value ?? "").toString().trim().replace(",", ".");
  if (!v) return null;
  return v;
}
